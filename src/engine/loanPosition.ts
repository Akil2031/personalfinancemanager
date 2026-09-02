import { Loan } from '../models/loan';
import { Payment } from '../models/payment';

export interface LoanPosition {
  originalPrincipal: number;

  currentOutstanding: number;

  principalPaid: number;

  interestPaid: number;

  installmentsDue: number;

  installmentsRemaining: number;

  remainingMonths: number;

  repaymentPercentage: number;

  nextEmiDate: string | null;

  maturityDate: string | null;

  asOfDate: string;
}


/*
 * =========================================================
 * PUBLIC FUNCTION
 * =========================================================
 */

export function calculateLoanPosition(
  loan: Loan,
  asOfDate: Date = new Date(),
  payments: Payment[] = []
): LoanPosition {

  const originalPrincipal =
    Math.max(
      0,
      toNumber(
        loan.originalPrincipal
      )
    );


  /*
   * INTEREST-ONLY / GOLD LOAN
   */
  if (
    loan.repaymentType ===
    'INTEREST_ONLY'
  ) {

    return calculateInterestOnlyPosition(
      loan,
      payments,
      asOfDate
    );
  }


  /*
   * NORMAL EMI LOAN
   */
  return calculateEMIPosition(
    loan,
    asOfDate
  );
}


/*
 * =========================================================
 * INTEREST-ONLY POSITION
 * =========================================================
 *
 * Rules:
 *
 * 1. Principal is NOT automatically reduced.
 *
 * 2. Interest payment does NOT reduce principal.
 *
 * 3. Only payment.principal reduces outstanding.
 *
 * 4. Monthly interest is calculated from the
 *    CURRENT outstanding balance.
 *
 * 5. Therefore:
 *
 *    ₹5,00,000 @ 12%
 *       = ₹5,000/month
 *
 *    After ₹50,000 principal payment:
 *
 *    ₹4,50,000 @ 12%
 *       = ₹4,500/month
 */

function calculateInterestOnlyPosition(
  loan: Loan,
  payments: Payment[],
  asOfDate: Date
): LoanPosition {

  const originalPrincipal =
    Math.max(
      0,
      toNumber(
        loan.originalPrincipal
      )
    );


  const today =
    startOfDay(
      asOfDate
    );


  /*
   * Start with original principal.
   */
  let currentOutstanding =
    originalPrincipal;


  let principalPaid =
    0;


  let interestPaid =
    0;


  /*
   * Only payments up to today.
   */
  const validPayments =
    payments
      .filter(
        payment => {

          if (
            !payment.paymentDate
          ) {
            return true;
          }


          const date =
            parseDate(
              payment.paymentDate
            );


          if (!date) {
            return false;
          }


          return (
            date.getTime() <=
            today.getTime()
          );
        }
      )
      .slice()
      .sort(
        (
          a,
          b
        ) => {

          const dateA =
            parseDate(
              a.paymentDate
            );


          const dateB =
            parseDate(
              b.paymentDate
            );


          return (
            (
              dateA?.getTime() ||
              0
            ) -
            (
              dateB?.getTime() ||
              0
            )
          );
        }
      );


  /*
   * =======================================================
   * APPLY PAYMENTS
   * =======================================================
   */

  for (
    const payment of validPayments
  ) {

    /*
     * Principal component.
     */
    let principalComponent =
      Math.max(
        0,
        toNumber(
          payment.principal
        )
      );


    /*
     * PREPAYMENT compatibility.
     *
     * If old data has PREPAYMENT with principal = 0,
     * amount is considered principal.
     */
    if (
      principalComponent <= 0 &&
      payment.status ===
        'PREPAYMENT'
    ) {

      principalComponent =
        Math.max(
          0,
          toNumber(
            payment.amount
          )
        );
    }


    /*
     * Never allow principal payment above
     * current outstanding.
     */
    principalComponent =
      Math.min(
        principalComponent,
        currentOutstanding
      );


    if (
      principalComponent > 0
    ) {

      currentOutstanding =
        roundMoney(
          currentOutstanding -
          principalComponent
        );


      principalPaid =
        roundMoney(
          principalPaid +
          principalComponent
        );
    }


    /*
     * Interest payment.
     *
     * Interest NEVER reduces outstanding.
     */
    const interestComponent =
      Math.max(
        0,
        toNumber(
          payment.interest
        )
      );


    interestPaid =
      roundMoney(
        interestPaid +
        interestComponent
      );
  }


  currentOutstanding =
    roundMoney(
      Math.max(
        0,
        currentOutstanding
      )
    );


  /*
   * =======================================================
   * MATURITY DATE
   * =======================================================
   */

  const firstEmiDate =
    parseDate(
      loan.firstEmiDate
    );


  const maturityDate =
    parseDate(
      loan.maturityDate
    );


  /*
   * If maturityDate exists, use it.
   *
   * Otherwise calculate from tenure.
   */
  let finalMaturityDate:
    Date | null =
    maturityDate;


  if (
    !finalMaturityDate &&
    firstEmiDate
  ) {

    const tenure =
      Math.max(
        1,
        Math.floor(
          toNumber(
            loan.tenureMonths
          )
        )
      );


    finalMaturityDate =
      addMonths(
        firstEmiDate,
        tenure - 1
      );
  }


  /*
   * =======================================================
   * SCHEDULE / DUE INSTALLMENTS
   * =======================================================
   */

  let installmentsDue =
    0;


  let installmentsRemaining =
    0;


  let nextEmiDate:
    string | null =
    null;


  if (
    firstEmiDate &&
    finalMaturityDate
  ) {

    let date =
      new Date(
        firstEmiDate
      );


    let installmentNo =
      1;


    const paidInstallments =
      new Set<number>();


    /*
     * Only an explicitly paid installment is
     * considered paid.
     */
    for (
      const payment of validPayments
    ) {

      const no =
        toNumber(
          payment.installmentNo
        );


      if (
        no > 0 &&
        (
          payment.status ===
            'PAID'
          ||
          payment.status ===
            'PREPAYMENT'
        )
      ) {

        paidInstallments.add(
          no
        );
      }
    }


    while (
      dateOnly(
        date
      ).getTime() <=
      dateOnly(
        finalMaturityDate
      ).getTime()
    ) {

      const due =
        dateOnly(
          date
        );


      if (
        due.getTime() <=
        today.getTime()
      ) {

        installmentsDue++;
      }


      /*
       * Find the next installment that has
       * not actually been paid.
       */
      if (
        !nextEmiDate &&
        due.getTime() >
          today.getTime()
      ) {

        if (
          !paidInstallments.has(
            installmentNo
          )
        ) {

          nextEmiDate =
            formatDateKey(
              due
            );
        }
      }


      date =
        addMonths(
          firstEmiDate,
          installmentNo
        );


      installmentNo++;


      if (
        installmentNo >
        600
      ) {
        break;
      }
    }


    installmentsRemaining =
      Math.max(
        0,
        installmentNo -
        1 -
        installmentsDue
      );
  }


  /*
   * =======================================================
   * REPAYMENT %
   * =======================================================
   */

  const repaymentPercentage =
    originalPrincipal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              principalPaid /
              originalPrincipal
            ) *
            100
          )
        )
      : 0;


  /*
   * If principal has been completely paid,
   * no outstanding remains.
   */
  if (
    currentOutstanding <=
    0.01
  ) {

    currentOutstanding =
      0;

    installmentsRemaining =
      0;

    nextEmiDate =
      null;
  }


  return {

    originalPrincipal,

    currentOutstanding,

    principalPaid,

    interestPaid,

    installmentsDue,

    installmentsRemaining,

    remainingMonths:
      installmentsRemaining,

    repaymentPercentage,

    nextEmiDate,

    maturityDate:
      finalMaturityDate
        ? formatDateKey(
            finalMaturityDate
          )
        : null,

    asOfDate:
      formatDateKey(
        today
      ),
  };
}


/*
 * =========================================================
 * NORMAL EMI POSITION
 * =========================================================
 *
 * Existing EMI behavior is preserved.
 */

function calculateEMIPosition(
  loan: Loan,
  asOfDate: Date
): LoanPosition {

  const originalPrincipal =
    Math.max(
      0,
      toNumber(
        loan.originalPrincipal
      )
    );


  const annualInterestRate =
    Math.max(
      0,
      toNumber(
        loan.annualInterestRate
      )
    );


  const emi =
    Math.max(
      0,
      toNumber(
        loan.emi
      )
    );


  const tenureMonths =
    Math.max(
      0,
      Math.floor(
        toNumber(
          loan.tenureMonths
        )
      )
    );


  const firstEmiDate =
    parseDate(
      loan.firstEmiDate
    );


  const today =
    startOfDay(
      asOfDate
    );


  if (
    !firstEmiDate ||
    tenureMonths <= 0 ||
    originalPrincipal <= 0
  ) {

    return {

      originalPrincipal,

      currentOutstanding:
        originalPrincipal,

      principalPaid:
        0,

      interestPaid:
        0,

      installmentsDue:
        0,

      installmentsRemaining:
        tenureMonths,

      remainingMonths:
        tenureMonths,

      repaymentPercentage:
        0,

      nextEmiDate:
        loan.firstEmiDate ||
        null,

      maturityDate:
        null,

      asOfDate:
        formatDateKey(
          today
        ),
    };
  }


  const installmentsDue =
    countDueInstallments(
      firstEmiDate,
      tenureMonths,
      today
    );


  const calculation =
    calculateAmortizationPosition(
      originalPrincipal,
      annualInterestRate,
      emi,
      installmentsDue
    );


  const installmentsRemaining =
    Math.max(
      0,
      tenureMonths -
      installmentsDue
    );


  let nextEmiDate:
    string | null =
    null;


  if (
    installmentsRemaining >
    0
  ) {

    nextEmiDate =
      formatDateKey(
        addMonths(
          firstEmiDate,
          installmentsDue
        )
      );
  }


  const maturity =
    addMonths(
      firstEmiDate,
      tenureMonths - 1
    );


  const maturityDate =
    formatDateKey(
      maturity
    );


  const repaymentPercentage =
    originalPrincipal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              calculation.principalPaid /
              originalPrincipal
            ) *
            100
          )
        )
      : 0;


  const remainingMonths =
    calculation.currentOutstanding <=
    0.01
      ? 0
      : installmentsRemaining;


  return {

    originalPrincipal,

    currentOutstanding:
      roundMoney(
        calculation.currentOutstanding
      ),

    principalPaid:
      roundMoney(
        calculation.principalPaid
      ),

    interestPaid:
      roundMoney(
        calculation.interestPaid
      ),

    installmentsDue,

    installmentsRemaining,

    remainingMonths,

    repaymentPercentage,

    nextEmiDate,

    maturityDate,

    asOfDate:
      formatDateKey(
        today
      ),
  };
}


/*
 * =========================================================
 * NORMAL EMI AMORTIZATION
 * =========================================================
 */

function calculateAmortizationPosition(
  principal: number,
  annualRate: number,
  emi: number,
  paymentsMade: number
) {

  if (
    paymentsMade <= 0
  ) {

    return {

      currentOutstanding:
        principal,

      principalPaid:
        0,

      interestPaid:
        0,
    };
  }


  if (
    annualRate === 0
  ) {

    const principalPaid =
      Math.min(
        principal,
        emi *
        paymentsMade
      );


    return {

      currentOutstanding:
        Math.max(
          0,
          principal -
          principalPaid
        ),

      principalPaid,

      interestPaid:
        0,
    };
  }


  const monthlyRate =
    annualRate /
    100 /
    12;


  if (
    emi <= 0
  ) {

    return {

      currentOutstanding:
        principal,

      principalPaid:
        0,

      interestPaid:
        0,
    };
  }


  let balance =
    principal;


  let principalPaid =
    0;


  let interestPaid =
    0;


  for (
    let month = 1;
    month <= paymentsMade;
    month++
  ) {

    if (
      balance <=
      0.01
    ) {

      balance =
        0;

      break;
    }


    const interest =
      balance *
      monthlyRate;


    let principalComponent =
      emi -
      interest;


    if (
      principalComponent <=
      0
    ) {

      return {

        currentOutstanding:
          balance,

        principalPaid,

        interestPaid,
      };
    }


    if (
      principalComponent >
      balance
    ) {

      principalComponent =
        balance;
    }


    balance =
      Math.max(
        0,
        balance -
        principalComponent
      );


    principalPaid +=
      principalComponent;


    interestPaid +=
      interest;
  }


  if (
    balance <
    0.01
  ) {

    balance =
      0;
  }


  return {

    currentOutstanding:
      balance,

    principalPaid,

    interestPaid,
  };
}


/*
 * =========================================================
 * DUE INSTALLMENTS
 * =========================================================
 */

function countDueInstallments(
  firstEmiDate: Date,
  tenureMonths: number,
  asOfDate: Date
): number {

  if (
    asOfDate <
    firstEmiDate
  ) {

    return 0;
  }


  let count =
    0;


  for (
    let index = 0;
    index < tenureMonths;
    index++
  ) {

    const dueDate =
      addMonths(
        firstEmiDate,
        index
      );


    if (
      dueDate <=
      asOfDate
    ) {

      count++;

    } else {

      break;
    }
  }


  return count;
}


/*
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

function parseDate(
  value?: string
): Date | null {

  if (
    !value
  ) {

    return null;
  }


  const normalized =
    String(value)
      .substring(
        0,
        10
      );


  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );


  if (
    !match
  ) {

    return null;
  }


  const date =
    new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;
  }


  return startOfDay(
    date
  );
}


function addMonths(
  date: Date,
  months: number
): Date {

  const result =
    new Date(date);


  const originalDay =
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
      originalDay,
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


function dateOnly(
  date: Date
): Date {

  return startOfDay(
    date
  );
}


function formatDateKey(
  date: Date
): string {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );


  return (
    `${year}-${month}-${day}`
  );
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


function toNumber(
  value: unknown
): number {

  const result =
    Number(value);


  return Number.isFinite(
    result
  )
    ? result
    : 0;
}