import { Loan } from '../models/loan';
import { Payment } from '../models/payment';

export type TargetStatus =
  | 'AHEAD'
  | 'ON_TRACK'
  | 'BEHIND';

export interface TargetPerformance {
  targetDate: Date;
  currentOutstanding: number;
  currentMonthlyEMI: number;
  currentMonthEMIPrincipal: number;
  requiredAdditionalPrincipal: number;
  requiredTotalMonthlyPayment: number;
  additionalPrincipalPaidThisMonth: number;
  additionalPrincipalRemainingThisMonth: number;
  additionalPrincipalProgressPercent: number;
  projectedDebtFreeDate: Date | null;
  monthsToTarget: number;
  status: TargetStatus;
}

interface TargetScheduleEntry {
  dueDate: string | Date;
  openingBalance?: number;
  emi?: number;
  principal?: number;
  interest?: number;
  closingBalance?: number;
  entryType?: string;
}

interface SimulationLoan {
  balance: number;
  rate: number;
  emi: number;
  monthlyInterest: number;
  repaymentType: string;
  maturityDate: Date | null;
  schedule: TargetScheduleEntry[];
}

/**
 * Debt-free target calculation.
 *
 * The important rule is that a target later than the loan's natural payoff
 * date does NOT require an artificial extra payment. We first determine what
 * happens with the current repayment plan, then only calculate extra money
 * when the requested target is earlier than that natural payoff.
 */
export function calculateTargetPerformance(
  loans: Loan[],
  targetDate: Date,
  payments: Payment[] = [],
  plannedExtraMonthlyPayment: number = 0,
): TargetPerformance {
  const asOfDate = startOfDay(new Date());

  const safeLoans = loans
    .map(normalizeLoan)
    .filter(loan => loan.balance > 0.01);

  const currentOutstanding = roundMoney(
    safeLoans.reduce((sum, loan) => sum + loan.balance, 0),
  );

  const currentMonthlyEMI = roundMoney(
    safeLoans.reduce((sum, loan) => sum + getRegularMonthlyCommitment(loan), 0),
  );

  const monthsToTarget = calculateMonthsToTarget(asOfDate, targetDate);

  const currentMonthEMIPrincipal = roundMoney(
    calculateRegularEMIPrincipal(safeLoans),
  );

  // First establish the natural payoff date with NO extra payment.
  const naturalDebtFreeDate = projectDebtFreeDate(safeLoans, 0, asOfDate);

  // If the requested target is on/after the natural payoff date, no extra
  // payment is necessary. This is the key correction for very late targets.
  const targetIsAfterNaturalPayoff =
    !!naturalDebtFreeDate &&
    startOfDay(targetDate).getTime() >= naturalDebtFreeDate.getTime();

  const requiredAdditionalPrincipal =
    targetIsAfterNaturalPayoff || monthsToTarget <= 0
      ? 0
      : roundMoney(
          findRequiredAdditionalPrincipal(
            safeLoans,
            monthsToTarget,
            asOfDate,
          ),
        );

  const requiredTotalMonthlyPayment = roundMoney(
    currentMonthlyEMI + requiredAdditionalPrincipal,
  );

  const additionalPrincipalPaidThisMonth = roundMoney(
    getAdditionalPrincipalPaidThisMonth(payments),
  );

  const additionalPrincipalRemainingThisMonth = roundMoney(
    Math.max(
      0,
      requiredAdditionalPrincipal - additionalPrincipalPaidThisMonth,
    ),
  );

  const additionalPrincipalProgressPercent =
    requiredAdditionalPrincipal > 0
      ? roundMoney(
          Math.min(
            100,
            Math.max(
              0,
              (additionalPrincipalPaidThisMonth /
                requiredAdditionalPrincipal) *
                100,
            ),
          ),
        )
      : 100;

  const plannedExtra = Math.max(
    0,
    Number(plannedExtraMonthlyPayment) || 0,
  );

  const projectedDebtFreeDate = projectDebtFreeDate(
    safeLoans,
    plannedExtra,
    asOfDate,
  );

  let status: TargetStatus;

  if (!projectedDebtFreeDate) {
    status = 'BEHIND';
  } else if (projectedDebtFreeDate.getTime() < startOfDay(targetDate).getTime()) {
    status = 'AHEAD';
  } else if (sameDayOrMonth(projectedDebtFreeDate, targetDate)) {
    status = 'ON_TRACK';
  } else {
    status = 'BEHIND';
  }

  return {
    targetDate: startOfDay(targetDate),
    currentOutstanding,
    currentMonthlyEMI,
    currentMonthEMIPrincipal,
    requiredAdditionalPrincipal,
    requiredTotalMonthlyPayment,
    additionalPrincipalPaidThisMonth,
    additionalPrincipalRemainingThisMonth,
    additionalPrincipalProgressPercent,
    projectedDebtFreeDate,
    monthsToTarget,
    status,
  };
}

function normalizeLoan(loan: Loan): SimulationLoan {
  const rawSchedule = (loan as any).__amortizationSchedule;
  const schedule: TargetScheduleEntry[] = Array.isArray(rawSchedule)
    ? rawSchedule
        .map((entry: any) => ({ ...entry }))
        .filter((entry: TargetScheduleEntry) => !!normalizeDate(entry.dueDate))
        .sort(
          (a, b) =>
            normalizeDate(a.dueDate)!.getTime() -
            normalizeDate(b.dueDate)!.getTime(),
        )
    : [];

  return {
    balance: Math.max(0, Number(loan.currentOutstanding) || 0),
    rate: Math.max(0, Number(loan.annualInterestRate) || 0),
    emi: Math.max(0, Number(loan.emi) || 0),
    monthlyInterest: Math.max(0, Number(loan.monthlyInterest) || 0),
    repaymentType: String(loan.repaymentType || '').toUpperCase(),
    maturityDate: normalizeDate((loan as any).maturityDate),
    schedule,
  };
}

function isInterestOnly(loan: SimulationLoan): boolean {
  return loan.repaymentType === 'INTEREST_ONLY';
}

function getRegularMonthlyCommitment(loan: SimulationLoan): number {
  if (isInterestOnly(loan)) return Math.max(0, loan.monthlyInterest);
  if (loan.schedule.length > 0) {
    const first = getFutureEmiRows(loan, new Date())[0];
    if (first && Number(first.emi) > 0) return Math.max(0, Number(first.emi));
  }
  return Math.max(0, loan.emi);
}

function getFutureEmiRows(
  loan: SimulationLoan,
  asOfDate: Date,
): TargetScheduleEntry[] {
  const today = startOfDay(asOfDate).getTime();
  return loan.schedule.filter(entry => {
    const date = normalizeDate(entry.dueDate);
    return !!date && date.getTime() > today && String(entry.entryType || 'EMI').toUpperCase() === 'EMI';
  });
}

function getMonthlyRate(loan: SimulationLoan, row?: TargetScheduleEntry): number {
  if (row) {
    const opening = Number(row.openingBalance) || 0;
    const interest = Number(row.interest) || 0;
    if (opening > 0 && interest > 0) {
      const inferred = interest / opening;
      if (Number.isFinite(inferred) && inferred > 0) return inferred;
    }
  }
  return Math.max(0, loan.rate) / 100 / 12;
}

function findRequiredAdditionalPrincipal(
  loans: SimulationLoan[],
  monthsToTarget: number,
  asOfDate: Date,
): number {
  if (loans.length === 0 || monthsToTarget <= 0) return 0;

  if (simulateDebt(loans, 0, monthsToTarget, asOfDate) <= 0.01) return 0;

  let low = 0;
  let high = loans.reduce((sum, loan) => sum + loan.balance, 0);

  while (
    simulateDebt(loans, high, monthsToTarget, asOfDate) > 0.01 &&
    high < 100_000_000
  ) {
    high *= 2;
  }

  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (simulateDebt(loans, middle, monthsToTarget, asOfDate) <= 0.01) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
}

function simulateDebt(
  sourceLoans: SimulationLoan[],
  extraMonthlyPayment: number,
  months: number,
  asOfDate: Date,
): number {
  const loans = sourceLoans.map(loan => ({ ...loan }));

  for (let month = 0; month < months; month++) {
    for (const loan of loans) {
      if (loan.balance <= 0.01) continue;

      const row = getFutureEmiRows(loan, asOfDate)[month];

      if (isInterestOnly(loan)) {
        continue;
      }

      const monthlyRate = getMonthlyRate(loan, row);
      const interest = loan.balance * monthlyRate;
      const scheduledEmi = Number(row?.emi) || loan.emi;
      const regularPayment = Math.min(
        Math.max(0, scheduledEmi),
        loan.balance + interest,
      );
      const principal = Math.max(0, regularPayment - interest);

      loan.balance = Math.max(0, loan.balance - principal);
    }

    applyExtraPayment(loans, extraMonthlyPayment);

    if (loans.every(loan => loan.balance <= 0.01)) return 0;
  }

  return loans.reduce((sum, loan) => sum + Math.max(0, loan.balance), 0);
}

function applyExtraPayment(loans: SimulationLoan[], extraMonthlyPayment: number): void {
  let extraRemaining = Math.max(0, extraMonthlyPayment);

  const ordered = loans
    .filter(loan => loan.balance > 0.01)
    .sort((a, b) => b.rate - a.rate);

  for (const loan of ordered) {
    if (extraRemaining <= 0) break;
    const applied = Math.min(loan.balance, extraRemaining);
    loan.balance = Math.max(0, loan.balance - applied);
    extraRemaining -= applied;
  }
}

function calculateRegularEMIPrincipal(loans: SimulationLoan[]): number {
  return loans.reduce((sum, loan) => {
    if (loan.balance <= 0.01 || isInterestOnly(loan)) return sum;

    const row = getFutureEmiRows(loan, new Date())[0];
    const monthlyRate = getMonthlyRate(loan, row);
    const interest = loan.balance * monthlyRate;
    const scheduledEmi = Number(row?.emi) || loan.emi;
    const payment = Math.min(scheduledEmi, loan.balance + interest);
    return sum + Math.max(0, payment - interest);
  }, 0);
}

/**
 * Returns the payoff date under the CURRENT plan, or under a supplied extra.
 *
 * Persisted amortization schedules are used to establish the natural maturity
 * where available. For interest-only loans, maturity is the normal payoff
 * date because regular interest payments do not reduce principal.
 */
function projectDebtFreeDate(
  sourceLoans: SimulationLoan[],
  extraMonthlyPayment: number,
  asOfDate: Date,
): Date | null {
  if (sourceLoans.length === 0) return startOfDay(asOfDate);

  // With no extra payment, use the authoritative schedule/maturity where it
  // exists. This is what prevents a target such as 2094 from being treated as
  // if the loan had to be stretched until 2094.
  if (extraMonthlyPayment <= 0) {
    const naturalDates = sourceLoans.map(loan => naturalPayoffDate(loan, asOfDate));
    if (naturalDates.every(Boolean)) {
      return naturalDates.reduce(
        (latest, current) =>
          current!.getTime() > latest!.getTime() ? current : latest,
        naturalDates[0]!,
      );
    }
  }

  const loans = sourceLoans.map(loan => ({ ...loan }));
  let date = startOfDay(asOfDate);
  const MAX_MONTHS = 1200;

  for (let month = 0; month < MAX_MONTHS; month++) {
    for (const loan of loans) {
      if (loan.balance <= 0.01) continue;

      const futureRows = getFutureEmiRows(loan, asOfDate);
      const row = futureRows[month];

      if (isInterestOnly(loan)) continue;

      const monthlyRate = getMonthlyRate(loan, row);
      const interest = loan.balance * monthlyRate;
      const scheduledEmi = Number(row?.emi) || loan.emi;
      const payment = Math.min(
        Math.max(0, scheduledEmi),
        loan.balance + interest,
      );
      const principal = Math.max(0, payment - interest);
      loan.balance = Math.max(0, loan.balance - principal);
    }

    applyExtraPayment(loans, extraMonthlyPayment);
    date = addMonths(date, 1);

    if (loans.every(loan => loan.balance <= 0.01)) return date;
  }

  return null;
}

function naturalPayoffDate(loan: SimulationLoan, asOfDate: Date): Date | null {
  const futureEmiRows = getFutureEmiRows(loan, asOfDate);

  if (futureEmiRows.length > 0) {
    const finalRow = futureEmiRows[futureEmiRows.length - 1];
    const finalDate = normalizeDate(finalRow.dueDate);
    if (finalDate) return finalDate;
  }

  if (isInterestOnly(loan)) {
    return loan.maturityDate;
  }

  // No persisted schedule: use the actual loan maturity if supplied.
  if (loan.maturityDate) return loan.maturityDate;

  // Last-resort calculated projection for legacy loans without maturity.
  return projectCalculatedPayoffDate(loan, asOfDate);
}

function projectCalculatedPayoffDate(loan: SimulationLoan, asOfDate: Date): Date | null {
  if (loan.balance <= 0.01) return startOfDay(asOfDate);

  let balance = loan.balance;
  let date = startOfDay(asOfDate);
  const MAX_MONTHS = 1200;

  for (let month = 0; month < MAX_MONTHS; month++) {
    if (isInterestOnly(loan)) return loan.maturityDate;

    const monthlyRate = loan.rate / 100 / 12;
    const interest = balance * monthlyRate;
    const payment = Math.min(loan.emi, balance + interest);
    const principal = Math.max(0, payment - interest);

    // Prevent an infinite loop when EMI cannot cover monthly interest.
    if (principal <= 0.000001) return loan.maturityDate;

    balance = Math.max(0, balance - principal);
    date = addMonths(date, 1);

    if (balance <= 0.01) return date;
  }

  return null;
}

function getAdditionalPrincipalPaidThisMonth(payments: Payment[]): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return payments.reduce((sum, payment) => {
    const status = String(payment.status || '').toUpperCase();
    if (status !== 'PREPAYMENT') return sum;

    const paymentDate = normalizeDate(payment.paymentDate);
    if (!paymentDate) return sum;
    if (paymentDate.getFullYear() !== year || paymentDate.getMonth() !== month) return sum;

    return sum + Math.max(0, Number(payment.principal) || Number(payment.amount) || 0);
  }, 0);
}

function calculateMonthsToTarget(from: Date, target: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(target);
  if (end <= start) return 0;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return Math.max(1, months);
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }

  const text = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return startOfDay(result);
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function sameDayOrMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}
