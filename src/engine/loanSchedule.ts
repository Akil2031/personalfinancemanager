import {
  calculateEMI,
  EMIScheduleRow,
} from './emiCalculator';

import { Loan } from '../models/loan';
import { Payment } from '../models/payment';

import {
  AmortizationEntry,
  AmortizationStatus,
} from '../models/amortization';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

export interface LoanScheduleResult {
  emi: number;

  totalPrincipal: number;

  totalInterest: number;

  totalPayment: number;

  maturityDate: Date;

  schedule: EMIScheduleRow[];

  currentOutstanding: number;

  paidInstallments: number;

  remainingMonths: number;

  nextEmiDate?: Date;

  lastEmiDate?: Date;
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function safeNumber(
  value: unknown
): number {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function roundMoney(
  value: number
): number {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) * 100
    ) / 100
  );
}

function normalizeDate(
  value: unknown
): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : new Date(value);
  }

  const text =
    String(value)
      .substring(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      text
    );

  if (match) {
    const date =
      new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const date =
    new Date(
      String(value)
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function dateOnly(
  date: Date
): Date {
  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function isInterestOnlyLoan(
  loan: Loan
): boolean {
  return (
    loan.repaymentType ===
    'INTEREST_ONLY'
  );
}

function calculateMonthlyInterest(
  loan: Loan,
  outstanding: number
): number {
  return roundMoney(
    outstanding *
      safeNumber(
        loan.annualInterestRate
      ) /
      100 /
      12
  );
}

function toEMIRow(
  entry: AmortizationEntry
): EMIScheduleRow {
  const dueDate =
    normalizeDate(
      entry.dueDate
    );

  if (!dueDate) {
    throw new Error(
      `Invalid amortization due date for installment ${entry.installmentNo}.`
    );
  }

  return {
    installmentNo:
      Number(entry.installmentNo),

    dueDate,

    openingBalance:
      roundMoney(
        entry.openingBalance
      ),

    emi:
      roundMoney(
        entry.emi
      ),

    principal:
      roundMoney(
        entry.principal
      ),

    interest:
      roundMoney(
        entry.interest
      ),

    closingBalance:
      roundMoney(
        entry.closingBalance
      ),
  };
}

/*
 * =========================================================
 * AUTHORITATIVE SCHEDULE RESULT
 * =========================================================
 *
 * THIS is the new source-of-truth calculation.
 *
 * It does not call calculateRemainingEMI().
 * It does not change lender values because a payment exists.
 * It reads the persisted schedule exactly as stored.
 */

export function buildLoanScheduleResultFromAmortization(
  loan: Loan,
  entries: AmortizationEntry[],
  payments: Payment[] = [],
  asOfDate: Date = new Date()
): LoanScheduleResult {
  if (!entries.length) {
    throw new Error(
      'No amortization schedule exists for this loan.'
    );
  }

  const sorted =
    entries
      .slice()
      .sort(
        (a, b) =>
          Number(a.installmentNo) -
          Number(b.installmentNo)
      );

  const schedule =
    sorted.map(toEMIRow);

  const totalPrincipal =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum +
          safeNumber(
            row.principal
          ),
        0
      )
    );

  const totalInterest =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum +
          safeNumber(
            row.interest
          ),
        0
      )
    );

  const totalPayment =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum +
          safeNumber(
            row.emi
          ),
        0
      )
    );

  const today =
    dateOnly(
      asOfDate
    );

  /*
   * The schedule's closing balance is authoritative.
   *
   * We use the last due row as the current principal position.
   * Actual payments are used only for payment status/count;
   * they do not silently alter the lender schedule.
   */
  let currentOutstanding =
    safeNumber(
      schedule[0]?.openingBalance
    );

  let lastDueIndex =
    -1;

  for (
    let index = 0;
    index < schedule.length;
    index++
  ) {
    const row =
      schedule[index];

    const due =
      dateOnly(
        row.dueDate
      );

    if (
      due.getTime() <=
      today.getTime()
    ) {
      lastDueIndex =
        index;
      currentOutstanding =
        safeNumber(
          row.closingBalance
        );
    } else {
      break;
    }
  }

  /*
   * Before the first due date, the outstanding is the
   * first opening balance.
   */
  if (
    lastDueIndex < 0
  ) {
    currentOutstanding =
      safeNumber(
        schedule[0]?.openingBalance
      );
  }

  currentOutstanding =
    roundMoney(
      Math.max(
        0,
        currentOutstanding
      )
    );

  const nextRow =
    schedule.find(row =>
      dateOnly(
        row.dueDate
      ).getTime() >
      today.getTime()
    );

  /*
   * Payment status is determined by actual payment records.
   *
   * We support both the new scheduleId field and the old
   * installmentNo field without requiring old Firestore data
   * to be migrated immediately.
   */
  const paidInstallments =
    new Set<number>();

  for (
    const payment of payments
  ) {
    if (
      payment.status !==
        'PAID' &&
      payment.status !==
        'PREPAYMENT'
    ) {
      continue;
    }

    const installmentNo =
      safeNumber(
        payment.installmentNo
      );

    if (
      installmentNo > 0
    ) {
      paidInstallments.add(
        installmentNo
      );
    }
  }

  let paidCount =
    0;

  for (
    const row of schedule
  ) {
    const due =
      dateOnly(
        row.dueDate
      );

    if (
      due.getTime() >
      today.getTime()
    ) {
      break;
    }

    if (
      paidInstallments.has(
        row.installmentNo
      )
    ) {
      paidCount++;
    } else {
      /*
       * Keep the count sequential.
       */
      break;
    }
  }

  const firstRow =
    schedule[0];

  const lastRow =
    schedule[
      schedule.length - 1
    ];

  return {
    emi:
      isInterestOnlyLoan(loan)
        ? 0
        : roundMoney(
            firstRow?.emi ||
            loan.emi ||
            0
          ),

    totalPrincipal,

    totalInterest,

    totalPayment,

    maturityDate:
      lastRow?.dueDate ||
      normalizeDate(
        loan.maturityDate
      ) ||
      new Date(),

    schedule,

    currentOutstanding,

    paidInstallments:
      paidCount,

    remainingMonths:
      schedule.filter(row =>
        dateOnly(
          row.dueDate
        ).getTime() >
        today.getTime()
      ).length,

    nextEmiDate:
      nextRow?.dueDate,

    lastEmiDate:
      lastRow?.dueDate,
  };
}

/*
 * =========================================================
 * LEGACY CALCULATED SCHEDULE
 * =========================================================
 *
 * Kept so existing screens do not break immediately.
 *
 * IMPORTANT:
 * New screens should use
 * buildLoanScheduleResultFromAmortization()
 * after loading the persisted schedule.
 */

export function generateLoanSchedule(
  loan: Loan
): LoanScheduleResult {
  if (
    isInterestOnlyLoan(loan)
  ) {
    return generateInterestOnlySchedule(
      loan
    );
  }

  const result =
    calculateEMI({
      principal:
        safeNumber(
          loan.originalPrincipal
        ),

      annualInterestRate:
        safeNumber(
          loan.annualInterestRate
        ),

      tenureMonths:
        safeNumber(
          loan.tenureMonths
        ),

      firstEmiDate:
        normalizeDate(
          loan.firstEmiDate
        ) ||
        new Date(),
    });

  return {
    ...result,

    currentOutstanding:
      safeNumber(
        loan.originalPrincipal
      ),

    paidInstallments:
      0,

    remainingMonths:
      result.schedule.length,

    nextEmiDate:
      result.schedule[0]?.dueDate,

    lastEmiDate:
      result.maturityDate,
  };
}

/*
 * =========================================================
 * INTEREST-ONLY FALLBACK
 * =========================================================
 */

function generateInterestOnlySchedule(
  loan: Loan
): LoanScheduleResult {
  const principal =
    safeNumber(
      loan.originalPrincipal
    );

  const firstDate =
    normalizeDate(
      loan.firstEmiDate
    ) ||
    new Date();

  const maturity =
    normalizeDate(
      loan.maturityDate
    );

  const maturityDate =
    maturity ||
    (() => {
      const result =
        new Date(firstDate);

      result.setMonth(
        result.getMonth() +
        Math.max(
          1,
          Math.round(
            safeNumber(
              loan.tenureMonths
            )
          )
        ) -
        1
      );

      return result;
    })();

  const schedule:
    EMIScheduleRow[] = [];

  let installmentNo =
    1;

  let dueDate =
    new Date(firstDate);

  while (
    dateOnly(dueDate).getTime() <=
    dateOnly(maturityDate).getTime()
  ) {
    const interest =
      calculateMonthlyInterest(
        loan,
        principal
      );

    schedule.push({
      installmentNo,

      dueDate:
        new Date(dueDate),

      openingBalance:
        principal,

      emi:
        interest,

      principal:
        0,

      interest,

      closingBalance:
        principal,
    });

    installmentNo++;

    const next =
      new Date(firstDate);

    next.setDate(1);
    next.setMonth(
      next.getMonth() +
      installmentNo -
      1
    );

    const lastDay =
      new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0
      ).getDate();

    next.setDate(
      Math.min(
        firstDate.getDate(),
        lastDay
      )
    );

    dueDate =
      next;

    if (
      installmentNo > 600
    ) {
      break;
    }
  }

  const totalInterest =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum +
          row.interest,
        0
      )
    );

  return {
    emi: 0,

    totalPrincipal:
      principal,

    totalInterest,

    totalPayment:
      roundMoney(
        principal +
        totalInterest
      ),

    maturityDate,

    schedule,

    currentOutstanding:
      principal,

    paidInstallments:
      0,

    remainingMonths:
      schedule.length,

    nextEmiDate:
      schedule[0]?.dueDate,

    lastEmiDate:
      schedule[
        schedule.length - 1
      ]?.dueDate,
  };
}

/*
 * =========================================================
 * BACKWARD-COMPATIBLE PAYMENT-AWARE POSITION
 * =========================================================
 *
 * Existing screens still call this function while the app is
 * being migrated to the persisted amortization schedule.
 * Keep it exported so older screens do not crash.
 *
 * IMPORTANT:
 * The authoritative amortization screen is the source of truth
 * for lender schedule values. This helper only supplies a
 * lightweight calculated position for legacy callers.
 */
export function generateAdjustedLoanSchedule(
  loan: Loan,
  payments: Payment[] = [],
  asOfDate: Date = new Date()
): LoanScheduleResult {
  const base = generateLoanSchedule(loan);
  const today = dateOnly(asOfDate);
  const originalPrincipal = safeNumber(loan.originalPrincipal);

  const validPayments = payments.filter(payment => {
    const paymentDate = normalizeDate(payment.paymentDate);
    return !paymentDate || dateOnly(paymentDate).getTime() <= today.getTime();
  });

  let principalPaid = 0;
  let interestPaid = 0;
  const paidInstallmentNos = new Set<number>();

  for (const payment of validPayments) {
    let principal = Math.max(0, safeNumber(payment.principal));
    let interest = Math.max(0, safeNumber(payment.interest));
    const amount = Math.max(0, safeNumber(payment.amount));
    const status = String(payment.status || '').toUpperCase();

    // Older prepayment records may contain only amount.
    if (principal <= 0 && status === 'PREPAYMENT') {
      principal = amount;
    }

    principalPaid += principal;
    interestPaid += interest;

    if (status === 'PAID') {
      const installmentNo = resolvePaymentInstallmentNo(
        payment,
        base.schedule
      );
      if (installmentNo > 0) {
        paidInstallmentNos.add(installmentNo);
      }
    }
  }

  const currentOutstanding = roundMoney(
    Math.max(0, originalPrincipal - principalPaid)
  );

  const futureSchedule = base.schedule.filter(row =>
    dateOnly(new Date(row.dueDate)).getTime() > today.getTime()
  );

  return {
    ...base,
    totalPrincipal: roundMoney(principalPaid),
    totalInterest: roundMoney(interestPaid),
    totalPayment: roundMoney(principalPaid + interestPaid),
    currentOutstanding,
    paidInstallments: paidInstallmentNos.size,
    remainingMonths: futureSchedule.length,
    nextEmiDate: futureSchedule[0]?.dueDate,
    lastEmiDate: base.lastEmiDate,
  };
}


/*
 * =========================================================
 * AUTHORITATIVE / CALCULATED SWITCH
 * =========================================================
 *
 * Convenience function for callers that already have both
 * sources. If entries exist, they win.
 */

export function generateLoanScheduleFromSource(
  loan: Loan,
  amortizationEntries?: AmortizationEntry[],
  payments: Payment[] = [],
  asOfDate: Date = new Date()
): LoanScheduleResult {
  if (
    amortizationEntries &&
    amortizationEntries.length > 0
  ) {
    return buildLoanScheduleResultFromAmortization(
      loan,
      amortizationEntries,
      payments,
      asOfDate
    );
  }

  return generateLoanSchedule(
    loan
  );
}

/*
 * =========================================================
 * PAYMENT / SCHEDULE MATCHING HELPER
 * =========================================================
 *
 * Used during the transition period before scheduleId is
 * added to every existing Payment document.
 */

export function resolvePaymentInstallmentNo(
  payment: Payment,
  schedule: EMIScheduleRow[]
): number {
  const explicit =
    safeNumber(
      payment.installmentNo
    );

  if (
    explicit > 0
  ) {
    return explicit;
  }

  const paymentDate =
    normalizeDate(
      payment.paymentDate
    );

  if (!paymentDate) {
    return 0;
  }

  const target =
    dateOnly(
      paymentDate
    ).getTime();

  const exact =
    schedule.find(row =>
      dateOnly(
        row.dueDate
      ).getTime() ===
      target
    );

  if (exact) {
    return exact.installmentNo;
  }

  let matched =
    0;

  for (
    const row of schedule
  ) {
    const due =
      dateOnly(
        row.dueDate
      ).getTime();

    if (
      due <= target
    ) {
      matched =
        row.installmentNo;
    } else {
      break;
    }
  }

  return matched;
}

/*
 * =========================================================
 * STATUS HELPER
 * =========================================================
 */

export function getAmortizationStatusFromPayments(
  entry: AmortizationEntry,
  payments: Payment[]
): AmortizationStatus {
  const matchingPayments =
    payments.filter(
      payment =>
        safeNumber(
          payment.installmentNo
        ) ===
        Number(
          entry.installmentNo
        )
    );

  if (
    matchingPayments.some(
      payment =>
        payment.status ===
        'PREPAYMENT'
    )
  ) {
    return 'PREPAYMENT';
  }

  if (
    matchingPayments.some(
      payment =>
        payment.status ===
        'PAID'
    )
  ) {
    return 'PAID';
  }

  if (
    matchingPayments.some(
      payment =>
        payment.status ===
        'PARTIAL'
    )
  ) {
    return 'PARTIAL';
  }

  return entry.status;
}
