import { Loan } from '../models/loan';

export interface ForecastResult {
  debtFreeDate: Date | null;

  monthsRequired: number;

  totalInterest: number;

  totalPrincipal: number;

  remainingBalance: number;
}

export interface TargetAnalysis {
  currentOutstanding: number;

  monthlyEMI: number;

  currentProjection: ForecastResult;

  targetDate: Date;

  targetMonths: number;

  requiredExtraMonthlyPayment: number;

  projectedDebtFreeDate: Date | null;

  monthsAheadOrBehind: number;

  status:
    | 'AHEAD'
    | 'ON_TRACK'
    | 'BEHIND';

  progressPercent: number;
}

/**
 * Simulates all active loans month by month.
 *
 * Base EMI remains attached to each loan.
 *
 * Extra payment is directed to the highest-interest
 * active loan first.
 */
export function forecastDebtFree(
  loans: Loan[],
  extraMonthlyPayment = 0
): ForecastResult {
  const activeLoans = loans
    .filter(
      (loan) =>
        loan.status === 'ACTIVE' &&
        Number(loan.currentOutstanding) > 0
    )
    .map((loan) => ({
      loan,
      balance: Number(
        loan.currentOutstanding || 0
      ),
    }));

  if (activeLoans.length === 0) {
    return {
      debtFreeDate: new Date(),
      monthsRequired: 0,
      totalInterest: 0,
      totalPrincipal: 0,
      remainingBalance: 0,
    };
  }

  let totalInterest = 0;
  let totalPrincipal = 0;

  const startDate = new Date();

  /*
   * Safety limit prevents an accidental infinite
   * forecast if invalid loan data is supplied.
   */
  const MAX_MONTHS = 1200;

  for (
    let month = 0;
    month < MAX_MONTHS;
    month++
  ) {
    let totalBalance = activeLoans.reduce(
      (sum, item) =>
        sum + item.balance,
      0
    );

    if (totalBalance <= 0.01) {
      const debtFreeDate =
        new Date(startDate);

      debtFreeDate.setMonth(
        debtFreeDate.getMonth() + month
      );

      return {
        debtFreeDate,
        monthsRequired: month,
        totalInterest,
        totalPrincipal,
        remainingBalance: 0,
      };
    }

    /*
     * First process the normal EMI for
     * every loan.
     */
    for (const item of activeLoans) {
      if (item.balance <= 0) {
        continue;
      }

      const annualRate =
        Number(
          item.loan.annualInterestRate
        );

      const monthlyRate =
        annualRate / 100 / 12;

      const interest =
        item.balance *
        monthlyRate;

      const scheduledEMI =
        Number(item.loan.emi);

      const payment = Math.min(
        scheduledEMI,
        item.balance + interest
      );

      const principal = Math.max(
        0,
        payment - interest
      );

      item.balance =
        Math.max(
          0,
          item.balance - principal
        );

      totalInterest += interest;
      totalPrincipal += principal;
    }

    /*
     * Apply additional monthly payment
     * using highest-interest-first.
     */
    let extraRemaining =
      Math.max(
        0,
        Number(extraMonthlyPayment)
      );

    if (extraRemaining > 0) {
      const loansByRate =
        [...activeLoans].sort(
          (a, b) =>
            Number(
              b.loan.annualInterestRate
            ) -
            Number(
              a.loan.annualInterestRate
            )
        );

      for (const item of loansByRate) {
        if (
          extraRemaining <= 0 ||
          item.balance <= 0
        ) {
          continue;
        }

        const extra =
          Math.min(
            extraRemaining,
            item.balance
          );

        item.balance -= extra;

        totalPrincipal += extra;

        extraRemaining -= extra;
      }
    }

    totalBalance =
      activeLoans.reduce(
        (sum, item) =>
          sum + item.balance,
        0
      );

    if (totalBalance <= 0.01) {
      const debtFreeDate =
        new Date(startDate);

      debtFreeDate.setMonth(
        debtFreeDate.getMonth() +
          month +
          1
      );

      return {
        debtFreeDate,
        monthsRequired:
          month + 1,
        totalInterest,
        totalPrincipal,
        remainingBalance: 0,
      };
    }
  }

  const remainingBalance =
    activeLoans.reduce(
      (sum, item) =>
        sum + item.balance,
      0
    );

  return {
    debtFreeDate: null,
    monthsRequired: MAX_MONTHS,
    totalInterest,
    totalPrincipal,
    remainingBalance,
  };
}

/**
 * Calculates how much additional monthly
 * payment is approximately required to reach
 * the selected target date.
 */
export function analyzeDebtFreeTarget(
  loans: Loan[],
  targetDate: Date
): TargetAnalysis {
  const activeLoans = loans.filter(
    (loan) =>
      loan.status === 'ACTIVE'
  );

  const currentOutstanding =
    activeLoans.reduce(
      (sum, loan) =>
        sum +
        Number(
          loan.currentOutstanding || 0
        ),
      0
    );

  const monthlyEMI =
    activeLoans.reduce(
      (sum, loan) =>
        sum +
        Number(loan.emi || 0),
      0
    );

  const currentProjection =
    forecastDebtFree(
      activeLoans,
      0
    );

  const targetMonths =
    monthsBetween(
      new Date(),
      targetDate
    );

  /*
   * Already debt free.
   */
  if (
    currentOutstanding <= 0
  ) {
    return {
      currentOutstanding,
      monthlyEMI,
      currentProjection,
      targetDate,
      targetMonths: 0,
      requiredExtraMonthlyPayment: 0,
      projectedDebtFreeDate:
        currentProjection.debtFreeDate,
      monthsAheadOrBehind: 0,
      status: 'AHEAD',
      progressPercent: 100,
    };
  }

  /*
   * Find the additional monthly amount
   * required to finish by the target.
   */
  let requiredExtra = 0;

  if (
    currentProjection.debtFreeDate &&
    currentProjection.debtFreeDate >
      targetDate
  ) {
    let low = 0;

    let high =
      Math.max(
        monthlyEMI,
        currentOutstanding /
          Math.max(
            1,
            targetMonths
          )
      );

    /*
     * Increase upper boundary until the
     * target is achievable.
     */
    for (let i = 0; i < 20; i++) {
      const result =
        forecastDebtFree(
          activeLoans,
          high
        );

      if (
        result.debtFreeDate &&
        result.debtFreeDate <=
          targetDate
      ) {
        break;
      }

      high *= 2;
    }

    /*
     * Binary search.
     */
    for (let i = 0; i < 40; i++) {
      const mid =
        (low + high) / 2;

      const result =
        forecastDebtFree(
          activeLoans,
          mid
        );

      if (
        result.debtFreeDate &&
        result.debtFreeDate <=
          targetDate
      ) {
        high = mid;
      } else {
        low = mid;
      }
    }

    requiredExtra = Math.ceil(high);
  }

  const projectedWithRequired =
    forecastDebtFree(
      activeLoans,
      requiredExtra
    );

  const projectedDate =
    currentProjection.debtFreeDate;

  let monthsAheadOrBehind = 0;

  if (projectedDate) {
    monthsAheadOrBehind =
      monthsBetween(
        targetDate,
        projectedDate
      );
  }

  let status:
    | 'AHEAD'
    | 'ON_TRACK'
    | 'BEHIND';

  if (!projectedDate) {
    status = 'BEHIND';
  } else if (
    projectedDate < targetDate
  ) {
    status = 'AHEAD';
  } else if (
    isSameMonth(
      projectedDate,
      targetDate
    )
  ) {
    status = 'ON_TRACK';
  } else {
    status = 'BEHIND';
  }

  /*
   * Progress is based on time elapsed
   * toward the target, not simply principal
   * divided by original principal.
   */
  const totalTargetMonths =
    Math.max(
      1,
      monthsBetween(
        new Date(),
        targetDate
      )
    );

  const elapsedMonths =
    Math.max(
      0,
      monthsBetween(
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        ),
        new Date()
      )
    );

  const progressPercent =
    Math.min(
      100,
      Math.max(
        0,
        (
          elapsedMonths /
          totalTargetMonths
        ) *
        100
      )
    );

  return {
    currentOutstanding,
    monthlyEMI,
    currentProjection,
    targetDate,
    targetMonths,
    requiredExtraMonthlyPayment:
      requiredExtra,
    projectedDebtFreeDate:
      projectedWithRequired.debtFreeDate,
    monthsAheadOrBehind,
    status,
    progressPercent,
  };
}

function monthsBetween(
  from: Date,
  to: Date
): number {
  return (
    (to.getFullYear() -
      from.getFullYear()) *
      12 +
    (to.getMonth() -
      from.getMonth())
  );
}

function isSameMonth(
  a: Date,
  b: Date
): boolean {
  return (
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() ===
      b.getMonth()
  );
}