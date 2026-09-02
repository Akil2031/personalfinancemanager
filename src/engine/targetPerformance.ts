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

  /*
   * Principal automatically paid through
   * the normal EMI for the current month.
   */
  currentMonthEMIPrincipal: number;

  /*
   * EXTRA principal required above normal EMI.
   */
  requiredAdditionalPrincipal: number;

  /*
   * Normal EMI + required extra principal.
   */
  requiredTotalMonthlyPayment: number;

  /*
   * Actual extra principal recorded this month.
   */
  additionalPrincipalPaidThisMonth: number;

  /*
   * How much of this month's target is still pending.
   */
  additionalPrincipalRemainingThisMonth: number;

  /*
   * Percentage of this month's additional
   * principal target achieved.
   */
  additionalPrincipalProgressPercent: number;

  projectedDebtFreeDate: Date | null;

  monthsToTarget: number;

  status: TargetStatus;
}

/*
 * =========================================================
 * MAIN
 * =========================================================
 */

export function calculateTargetPerformance(
  loans: Loan[],
  targetDate: Date,
  payments: Payment[] = []
): TargetPerformance {

  const safeLoans = loans
    .map(normalizeLoan)
    .filter(
      loan =>
        loan.balance > 0.01
    );

  const currentOutstanding =
    roundMoney(
      safeLoans.reduce(
        (sum, loan) =>
          sum + loan.balance,
        0
      )
    );

  const currentMonthlyEMI =
    roundMoney(
      safeLoans.reduce(
        (sum, loan) =>
          sum + loan.emi,
        0
      )
    );

  const monthsToTarget =
    calculateMonthsToTarget(
      new Date(),
      targetDate
    );

  /*
   * Calculate how much principal the
   * regular EMI is expected to reduce
   * this month.
   */
  const currentMonthEMIPrincipal =
    roundMoney(
      calculateRegularEMIPrincipal(
        safeLoans
      )
    );

  /*
   * Find the minimum constant extra
   * principal payment required every
   * month so that the debt reaches zero
   * by the target date.
   */
  const requiredAdditionalPrincipal =
    roundMoney(
      findRequiredAdditionalPrincipal(
        safeLoans,
        monthsToTarget
      )
    );

  const requiredTotalMonthlyPayment =
    roundMoney(
      currentMonthlyEMI +
        requiredAdditionalPrincipal
    );

  /*
   * Actual target payment made this month.
   *
   * We deliberately count PREPAYMENT
   * payments as target-extra payments.
   *
   * Normal EMI = PAID
   * Extra principal = PREPAYMENT
   */
  const additionalPrincipalPaidThisMonth =
    roundMoney(
      getAdditionalPrincipalPaidThisMonth(
        payments
      )
    );

  const additionalPrincipalRemainingThisMonth =
    roundMoney(
      Math.max(
        0,
        requiredAdditionalPrincipal -
          additionalPrincipalPaidThisMonth
      )
    );

  const additionalPrincipalProgressPercent =
    requiredAdditionalPrincipal > 0
      ? roundMoney(
          Math.min(
            100,
            Math.max(
              0,
              (
                additionalPrincipalPaidThisMonth /
                requiredAdditionalPrincipal
              ) *
                100
            )
          )
        )
      : 100;

  /*
   * Project the debt-free date using
   * current EMI + required extra.
   */
  const projectedDebtFreeDate =
    projectDebtFreeDate(
      safeLoans,
      requiredAdditionalPrincipal
    );

  let status: TargetStatus;

  if (!projectedDebtFreeDate) {
    status = 'BEHIND';
  } else if (
    projectedDebtFreeDate.getTime() <
    startOfDay(targetDate).getTime()
  ) {
    status = 'AHEAD';
  } else if (
    sameMonth(
      projectedDebtFreeDate,
      targetDate
    )
  ) {
    status = 'ON_TRACK';
  } else {
    status = 'BEHIND';
  }

  return {
    targetDate:
      startOfDay(targetDate),

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


/*
 * =========================================================
 * LOAN NORMALIZATION
 * =========================================================
 */

interface SimulationLoan {
  balance: number;
  rate: number;
  emi: number;
}

function normalizeLoan(
  loan: Loan
): SimulationLoan {

  return {
    balance:
      Math.max(
        0,
        Number(
          loan.currentOutstanding
        ) || 0
      ),

    rate:
      Math.max(
        0,
        Number(
          loan.annualInterestRate
        ) || 0
      ),

    emi:
      Math.max(
        0,
        Number(
          loan.emi
        ) || 0
      ),
  };
}


/*
 * =========================================================
 * REQUIRED EXTRA PAYMENT
 * =========================================================
 *
 * Binary-search the smallest extra monthly
 * principal amount that clears all loans
 * within the target number of months.
 */

function findRequiredAdditionalPrincipal(
  loans: SimulationLoan[],
  monthsToTarget: number
): number {

  if (
    loans.length === 0 ||
    monthsToTarget <= 0
  ) {
    return 0;
  }

  /*
   * First check whether normal EMI alone
   * already clears the debt.
   */
  if (
    simulateDebt(
      loans,
      0,
      monthsToTarget
    ) <= 0.01
  ) {
    return 0;
  }

  let low = 0;

  /*
   * Start with current outstanding as
   * a safe upper bound.
   */
  let high =
    loans.reduce(
      (sum, loan) =>
        sum + loan.balance,
      0
    );

  /*
   * If somehow the upper bound isn't
   * sufficient, keep increasing it.
   */
  while (
    simulateDebt(
      loans,
      high,
      monthsToTarget
    ) > 0.01 &&
    high < 100_000_000
  ) {
    high *= 2;
  }

  /*
   * Binary search.
   */
  for (
    let i = 0;
    i < 60;
    i++
  ) {

    const middle =
      (low + high) / 2;

    const remaining =
      simulateDebt(
        loans,
        middle,
        monthsToTarget
      );

    if (
      remaining <= 0.01
    ) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
}


/*
 * =========================================================
 * MONTHLY SIMULATION
 * =========================================================
 */

function simulateDebt(
  sourceLoans: SimulationLoan[],
  extraMonthlyPayment: number,
  months: number
): number {

  const loans =
    sourceLoans.map(
      loan => ({
        ...loan,
      })
    );

  for (
    let month = 0;
    month < months;
    month++
  ) {

    /*
     * -----------------------------------------
     * 1. Normal EMI
     * -----------------------------------------
     */

    for (
      const loan of loans
    ) {

      if (
        loan.balance <= 0.01
      ) {
        continue;
      }

      const monthlyRate =
        loan.rate /
        100 /
        12;

      const interest =
        loan.balance *
        monthlyRate;

      const regularPayment =
        Math.min(
          loan.emi,
          loan.balance +
            interest
        );

      const principal =
        Math.max(
          0,
          regularPayment -
            interest
        );

      loan.balance =
        Math.max(
          0,
          loan.balance -
            principal
        );
    }


    /*
     * -----------------------------------------
     * 2. EXTRA PRINCIPAL
     * -----------------------------------------
     *
     * Highest interest rate first.
     */

    let extraRemaining =
      Math.max(
        0,
        extraMonthlyPayment
      );

    const ordered =
      loans
        .filter(
          loan =>
            loan.balance >
            0.01
        )
        .sort(
          (a, b) =>
            b.rate -
            a.rate
        );

    for (
      const loan of ordered
    ) {

      if (
        extraRemaining <= 0
      ) {
        break;
      }

      const applied =
        Math.min(
          loan.balance,
          extraRemaining
        );

      loan.balance -=
        applied;

      extraRemaining -=
        applied;
    }

    if (
      loans.every(
        loan =>
          loan.balance <=
          0.01
      )
    ) {
      return 0;
    }
  }

  return loans.reduce(
    (sum, loan) =>
      sum +
      Math.max(
        0,
        loan.balance
      ),
    0
  );
}


/*
 * =========================================================
 * CURRENT MONTH EMI PRINCIPAL
 * =========================================================
 */

function calculateRegularEMIPrincipal(
  loans: SimulationLoan[]
): number {

  return loans.reduce(
    (sum, loan) => {

      if (
        loan.balance <= 0.01
      ) {
        return sum;
      }

      const monthlyRate =
        loan.rate /
        100 /
        12;

      const interest =
        loan.balance *
        monthlyRate;

      const payment =
        Math.min(
          loan.emi,
          loan.balance +
            interest
        );

      const principal =
        Math.max(
          0,
          payment -
            interest
        );

      return (
        sum +
        principal
      );
    },
    0
  );
}


/*
 * =========================================================
 * ACTUAL EXTRA PAYMENT
 * =========================================================
 */

function getAdditionalPrincipalPaidThisMonth(
  payments: Payment[]
): number {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    now.getMonth();

  return payments.reduce(
    (sum, payment) => {

      /*
       * Target extra payments are
       * recorded as PREPAYMENT.
       */
      if (
        payment.status !==
        'PREPAYMENT'
      ) {
        return sum;
      }

      const paymentDate =
        new Date(
          payment.paymentDate
        );

      if (
        Number.isNaN(
          paymentDate.getTime()
        )
      ) {
        return sum;
      }

      if (
        paymentDate.getFullYear() !==
          year ||
        paymentDate.getMonth() !==
          month
      ) {
        return sum;
      }

      return (
        sum +
        Math.max(
          0,
          Number(
            payment.principal
          ) || 0
        )
      );
    },
    0
  );
}


/*
 * =========================================================
 * PROJECT DEBT-FREE DATE
 * =========================================================
 */

function projectDebtFreeDate(
  sourceLoans: SimulationLoan[],
  extraMonthlyPayment: number
): Date | null {

  const loans =
    sourceLoans.map(
      loan => ({
        ...loan,
      })
    );

  if (
    loans.length === 0
  ) {
    return new Date();
  }

  let date =
    startOfDay(
      new Date()
    );

  const MAX_MONTHS =
    1200;

  for (
    let month = 0;
    month < MAX_MONTHS;
    month++
  ) {

    /*
     * Regular EMI.
     */
    for (
      const loan of loans
    ) {

      if (
        loan.balance <=
        0.01
      ) {
        continue;
      }

      const monthlyRate =
        loan.rate /
        100 /
        12;

      const interest =
        loan.balance *
        monthlyRate;

      const payment =
        Math.min(
          loan.emi,
          loan.balance +
            interest
        );

      const principal =
        Math.max(
          0,
          payment -
            interest
        );

      loan.balance =
        Math.max(
          0,
          loan.balance -
            principal
        );
    }

    /*
     * Extra principal.
     */
    let extraRemaining =
      Math.max(
        0,
        extraMonthlyPayment
      );

    const ordered =
      loans
        .filter(
          loan =>
            loan.balance >
            0.01
        )
        .sort(
          (a, b) =>
            b.rate -
            a.rate
        );

    for (
      const loan of ordered
    ) {

      if (
        extraRemaining <=
        0
      ) {
        break;
      }

      const applied =
        Math.min(
          loan.balance,
          extraRemaining
        );

      loan.balance -=
        applied;

      extraRemaining -=
        applied;
    }

    date =
      addMonths(
        date,
        1
      );

    if (
      loans.every(
        loan =>
          loan.balance <=
          0.01
      )
    ) {
      return date;
    }
  }

  return null;
}


/*
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

function calculateMonthsToTarget(
  from: Date,
  target: Date
): number {

  const start =
    startOfDay(from);

  const end =
    startOfDay(target);

  if (
    end <= start
  ) {
    return 0;
  }

  const months =
    (
      end.getFullYear() -
      start.getFullYear()
    ) *
      12 +
    (
      end.getMonth() -
      start.getMonth()
    );

  /*
   * If target day is after the current
   * day, that month is still available.
   */
  if (
    end.getDate() >
    start.getDate()
  ) {
    return months;
  }

  return Math.max(
    1,
    months
  );
}


function addMonths(
  date: Date,
  months: number
): Date {

  const result =
    new Date(date);

  const day =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() +
      months
  );

  const lastDay =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      day,
      lastDay
    )
  );

  return startOfDay(
    result
  );
}


function startOfDay(
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


function sameMonth(
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


function roundMoney(
  value: number
): number {

  return Math.round(
    (
      Number(value) || 0
    ) +
      Number.EPSILON
  );
}