import {
  calculateEMI,
  calculateRemainingEMI,
  EMIScheduleRow,
} from './emiCalculator';

import { Loan } from '../models/loan';
import { Payment } from '../models/payment';


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


function isInterestOnlyLoan(
  loan: Loan
): boolean {
  return (
    loan.repaymentType ===
    'INTEREST_ONLY'
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
      ) *
        100
    ) / 100
  );
}


function normalizeDate(
  value: unknown
): Date | null {

  if (
    !value
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : new Date(value);
  }

  /*
   * YYYY-MM-DD must be parsed as local date.
   */
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

  /*
   * Prevent month overflow.
   */
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

  return result;
}


/*
 * =========================================================
 * INTEREST-ONLY MONTHLY INTEREST
 * =========================================================
 */

function calculateMonthlyInterest(
  loan: Loan,
  outstanding: number
): number {

  /*
   * IMPORTANT:
   *
   * Interest-only interest must always be calculated
   * from the CURRENT outstanding principal.
   *
   * Do not use loan.monthlyInterest as the source of truth
   * because a principal payment changes the monthly interest.
   *
   * Example:
   * ₹5,00,000 @ 12% = ₹5,000/month
   * ₹4,50,000 @ 12% = ₹4,500/month
   */
  const rate =
    safeNumber(
      loan.annualInterestRate
    );

  return roundMoney(
    outstanding *
      rate /
      100 /
      12
  );
}


/*
 * =========================================================
 * ORIGINAL CONTRACTUAL EMI SCHEDULE
 * =========================================================
 *
 * For normal EMI loans this uses the existing EMI engine.
 *
 * For interest-only loans we create a monthly schedule
 * containing interest only and ZERO principal.
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


  /*
   * If no maturity date is supplied, use tenure.
   */
  let maturityDate: Date;

  if (
    maturity
  ) {

    maturityDate =
      maturity;

  } else {

    const tenure =
      Math.max(
        1,
        Math.round(
          safeNumber(
            loan.tenureMonths
          )
        )
      );

    maturityDate =
      addMonths(
        firstDate,
        tenure - 1
      );
  }


  const schedule:
    EMIScheduleRow[] = [];


  let installmentNo =
    1;


  let dueDate =
    new Date(
      firstDate
    );


  while (
    dateOnly(
      dueDate
    ).getTime() <=
    dateOnly(
      maturityDate
    ).getTime()
  ) {

    const interest =
      calculateMonthlyInterest(
        loan,
        principal
      );


    /*
     * IMPORTANT:
     *
     * Principal is ZERO.
     */
    schedule.push({
      installmentNo,

      dueDate:
        new Date(
          dueDate
        ),

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


    installmentNo += 1;


    dueDate =
      addMonths(
        firstDate,
        installmentNo - 1
      );


    /*
     * Safety limit.
     */
    if (
      installmentNo >
      600
    ) {
      break;
    }
  }


  return {

    emi: 0,

    // The monthly schedule contains zero principal.
    // This value represents the principal balloon due at maturity.
    totalPrincipal:
      principal,

    totalInterest:
      roundMoney(
        schedule.reduce(
          (
            sum,
            row
          ) =>
            sum +
            safeNumber(
              row.interest
            ),
          0
        )
      ),

    totalPayment:
      roundMoney(
        principal +
        schedule.reduce(
          (
            sum,
            row
          ) =>
            sum +
            safeNumber(
              row.interest
            ),
          0
        )
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
 * ORIGINAL LOAN SCHEDULE
 * =========================================================
 */

export function generateLoanSchedule(
  loan: Loan
): LoanScheduleResult {

  const embeddedPayments =
    (
      loan as Loan & {
        __actualPayments?: Payment[];
      }
    ).__actualPayments;


  if (
    embeddedPayments
  ) {

    return generateAdjustedLoanSchedule(
      loan,
      embeddedPayments,
      new Date()
    );
  }


  /*
   * INTEREST-ONLY
   */
  if (
    isInterestOnlyLoan(
      loan
    )
  ) {

    return generateInterestOnlySchedule(
      loan
    );
  }


  /*
   * NORMAL EMI
   */
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
 * ADJUSTED / CURRENT LOAN SCHEDULE
 * =========================================================
 *
 * NORMAL EMI:
 *
 *   Due EMI
 *       ↓
 *   Principal + Interest
 *       ↓
 *   Outstanding reduces
 *
 *
 * INTEREST ONLY:
 *
 *   Due payment
 *       ↓
 *   Interest only
 *       ↓
 *   Principal = 0
 *       ↓
 *   Outstanding unchanged
 *
 *
 * ACTUAL PRINCIPAL PAYMENT:
 *
 *   Principal payment
 *       ↓
 *   Outstanding reduces
 * =========================================================
 */

export function generateAdjustedLoanSchedule(
  loan: Loan,
  payments: Payment[] = [],
  asOfDate: Date = new Date()
): LoanScheduleResult {

  /*
   * -------------------------------------------------------
   * INTEREST-ONLY LOAN
   * -------------------------------------------------------
   */

  if (
    isInterestOnlyLoan(
      loan
    )
  ) {

    return generateAdjustedInterestOnlySchedule(
      loan,
      payments,
      asOfDate
    );
  }


  /*
   * -------------------------------------------------------
   * NORMAL EMI LOAN
   * -------------------------------------------------------
   */

  return generateAdjustedEMISchedule(
    loan,
    payments,
    asOfDate
  );
}


/*
 * =========================================================
 * INTEREST-ONLY CURRENT POSITION
 * =========================================================
 */

function generateAdjustedInterestOnlySchedule(
  loan: Loan,
  payments: Payment[],
  asOfDate: Date
): LoanScheduleResult {

  const original =
    generateInterestOnlySchedule(
      loan
    );


  const today =
    dateOnly(
      asOfDate
    );


  /*
   * -------------------------------------------------------
   * ORIGINAL PRINCIPAL
   * -------------------------------------------------------
   */

  const originalPrincipal =
    safeNumber(
      loan.originalPrincipal
    );


  /*
   * -------------------------------------------------------
   * CURRENT OUTSTANDING
   *
   * IMPORTANT:
   *
   * Interest payments NEVER reduce this value.
   * Only actual principal payments do.
   * -------------------------------------------------------
   */

  let currentOutstanding =
    originalPrincipal;


  let principalPaid =
    0;


  let interestPaid =
    0;


  /*
   * -------------------------------------------------------
   * VALID ACTUAL PAYMENTS
   * -------------------------------------------------------
   */

  const validPayments =
    payments
      .filter(
        payment => {

          if (
            !payment
          ) {
            return false;
          }


          if (
            !payment.paymentDate
          ) {
            return true;
          }


          const paymentDate =
            normalizeDate(
              payment.paymentDate
            );


          if (
            !paymentDate
          ) {
            return false;
          }


          return (
            dateOnly(
              paymentDate
            ).getTime() <=
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
            normalizeDate(
              a.paymentDate
            );


          const dateB =
            normalizeDate(
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
   * -------------------------------------------------------
   * APPLY ACTUAL PAYMENTS
   * -------------------------------------------------------
   *
   * We DO NOT automatically deduct principal.
   *
   * Only payment.principal can reduce outstanding.
   */

  for (
    const payment of validPayments
  ) {

    let paymentPrincipal =
      safeNumber(
        payment.principal
      );


    /*
     * PREPAYMENT compatibility.
     *
     * Older records may not have principal.
     */
    if (
      paymentPrincipal <= 0 &&
      payment.status ===
        'PREPAYMENT'
    ) {

      const amount =
        safeNumber(
          payment.amount
        );


      if (
        amount > 0
      ) {
        paymentPrincipal =
          amount;
      }
    }


    /*
     * NEVER let principal payment exceed
     * the outstanding balance.
     */
    paymentPrincipal =
      Math.min(
        paymentPrincipal,
        currentOutstanding
      );


    if (
      paymentPrincipal > 0
    ) {

      currentOutstanding =
        Math.max(
          0,
          currentOutstanding -
            paymentPrincipal
        );


      principalPaid +=
        paymentPrincipal;
    }


    /*
     * Interest is tracked separately.
     *
     * Interest does NOT reduce outstanding.
     */
    const paymentInterest =
      safeNumber(
        payment.interest
      );


    if (
      paymentInterest > 0
    ) {

      interestPaid +=
        paymentInterest;
    }
  }


  currentOutstanding =
    roundMoney(
      currentOutstanding
    );


  principalPaid =
    roundMoney(
      principalPaid
    );


  interestPaid =
    roundMoney(
      interestPaid
    );


  /*
   * -------------------------------------------------------
   * FULLY PAID
   * -------------------------------------------------------
   */

  if (
    currentOutstanding <=
    0.01
  ) {

    return {

      emi: 0,

      totalPrincipal:
        originalPrincipal,

      totalInterest:
        interestPaid,

      totalPayment:
        roundMoney(
          originalPrincipal +
          interestPaid
        ),

      maturityDate:
        original.maturityDate,

      schedule: [],

      currentOutstanding:
        0,

      paidInstallments:
        countPaidInterestInstallments(
          original.schedule,
          validPayments,
          today
        ),

      remainingMonths:
        0,

      nextEmiDate:
        undefined,

      lastEmiDate:
        original.maturityDate,
    };
  }


  /*
   * -------------------------------------------------------
   * NEXT INTEREST DATE
   * -------------------------------------------------------
   */

  const nextOriginalRow =
    original.schedule.find(
      row => {

        const dueDate =
          dateOnly(
            new Date(
              row.dueDate
            )
          );

        return (
          dueDate.getTime() >
          today.getTime()
        );
      }
    );


  const nextEmiDate =
    nextOriginalRow?.dueDate ||
    original.maturityDate;


  /*
   * -------------------------------------------------------
   * REMAINING INTEREST SCHEDULE
   * -------------------------------------------------------
   *
   * Principal remains unchanged.
   *
   * Monthly interest is recalculated using the
   * current outstanding.
   */

  const remainingSchedule:
    EMIScheduleRow[] = [];


  if (
    nextEmiDate
  ) {

    let dueDate =
      new Date(
        nextEmiDate
      );


    let installmentNo =
      nextOriginalRow?.installmentNo ||
      1;


    const maturityDate =
      original.maturityDate;


    while (
      dateOnly(
        dueDate
      ).getTime() <=
      dateOnly(
        maturityDate
      ).getTime()
    ) {

      const interest =
        calculateMonthlyInterest(
          loan,
          currentOutstanding
        );


      remainingSchedule.push({

        installmentNo,

        dueDate:
          new Date(
            dueDate
          ),

        openingBalance:
          currentOutstanding,

        emi:
          interest,

        principal:
          0,

        interest,

        closingBalance:
          currentOutstanding,
      });


      installmentNo += 1;


      dueDate =
        addMonths(
          nextEmiDate,
          installmentNo -
            (
              nextOriginalRow
                ?.installmentNo ||
              1
            )
        );


      if (
        installmentNo >
        600
      ) {
        break;
      }
    }
  }


  return {

    emi: 0,

    totalPrincipal:
      roundMoney(
        principalPaid
      ),

    totalInterest:
      interestPaid,

    totalPayment:
      roundMoney(
        principalPaid +
        interestPaid
      ),

    maturityDate:
      original.maturityDate,

    schedule:
      remainingSchedule,

    currentOutstanding,

    paidInstallments:
      countPaidInterestInstallments(
        original.schedule,
        validPayments,
        today
      ),

    remainingMonths:
      remainingSchedule.length,

    nextEmiDate:
      remainingSchedule[0]?.dueDate ||
      nextEmiDate,

    lastEmiDate:
      original.maturityDate,
  };
}


/*
 * =========================================================
 * COUNT PAID INTEREST INSTALLMENTS
 * =========================================================
 */

function resolvePaymentInstallmentNo(
  payment: Payment,
  schedule: EMIScheduleRow[]
): number {
  const explicit = safeNumber(payment.installmentNo);

  if (explicit > 0) {
    return explicit;
  }

  const paymentDate = normalizeDate(payment.paymentDate);

  if (!paymentDate) {
    return 0;
  }

  const target = dateOnly(paymentDate).getTime();

  const exact = schedule.find(row =>
    dateOnly(new Date(row.dueDate)).getTime() === target
  );

  if (exact) {
    return exact.installmentNo;
  }

  // If the payment date falls between two scheduled dates,
  // associate it with the most recent scheduled installment.
  let matched = 0;

  for (const row of schedule) {
    const due = dateOnly(new Date(row.dueDate)).getTime();

    if (due <= target) {
      matched = row.installmentNo;
    } else {
      break;
    }
  }

  return matched;
}


function countPaidInterestInstallments(
  schedule: EMIScheduleRow[],
  payments: Payment[],
  today: Date
): number {

  /*
   * An interest installment is PAID only when an actual
   * payment record exists with status PAID.
   *
   * A due date by itself does NOT mean that the interest
   * has been paid.
   */
  const paidInstallments =
    new Set<number>();

  for (
    const payment of payments
  ) {

    const installmentNo =
      resolvePaymentInstallmentNo(
        payment,
        schedule
      );

    if (
      installmentNo <= 0
    ) {
      continue;
    }

    if (
      payment.status === 'PAID'
    ) {
      paidInstallments.add(
        installmentNo
      );
    }
  }

  let count = 0;

  for (
    const row of schedule
  ) {

    const dueDate =
      dateOnly(
        new Date(
          row.dueDate
        )
      );

    /*
     * Future installments are not yet due.
     */
    if (
      dueDate.getTime() >
      dateOnly(today).getTime()
    ) {
      break;
    }

    /*
     * Stop at the first unpaid due installment.
     * This keeps the schedule's paid count sequential.
     */
    if (
      !paidInstallments.has(
        row.installmentNo
      )
    ) {
      break;
    }

    count++;
  }

  return Math.min(
    count,
    schedule.length
  );
}


/*
 * =========================================================
 * NORMAL EMI CURRENT POSITION
 * =========================================================
 *
 * This is your existing behavior, preserved.
 * =========================================================
 */

function generateAdjustedEMISchedule(
  loan: Loan,
  payments: Payment[],
  asOfDate: Date
): LoanScheduleResult {

  /*
   * -------------------------------------------------------
   * ORIGINAL CONTRACTUAL SCHEDULE
   * -------------------------------------------------------
   */

  const original =
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


  const originalPrincipal =
    safeNumber(
      loan.originalPrincipal
    );


  const calculatedEmi =
    safeNumber(
      original.emi
    );


  const storedEmi =
    safeNumber(
      loan.emi
    ) ||
    calculatedEmi;


  /*
   * -------------------------------------------------------
   * NORMALIZE AS-OF DATE
   * -------------------------------------------------------
   */

  const today =
    new Date(
      asOfDate
    );


  today.setHours(
    23,
    59,
    59,
    999
  );


  /*
   * -------------------------------------------------------
   * AUTOMATICALLY PAID EMIs
   * -------------------------------------------------------
   */

  const automaticPaidInstallments =
    countAutomaticallyPaidInstallments(
      original.schedule,
      today
    );


  /*
   * -------------------------------------------------------
   * INITIAL POSITION
   * -------------------------------------------------------
   */

  let currentOutstanding =
    originalPrincipal;


  let principalPaid =
    0;


  let interestPaid =
    0;


  for (
    let index = 0;
    index <
      automaticPaidInstallments;
    index++
  ) {

    const row =
      original.schedule[index];


    if (
      !row
    ) {
      break;
    }


    const principalComponent =
      safeNumber(
        row.principal
      );


    const interestComponent =
      safeNumber(
        row.interest
      );


    currentOutstanding =
      Math.max(
        0,
        currentOutstanding -
          principalComponent
      );


    principalPaid +=
      principalComponent;


    interestPaid +=
      interestComponent;
  }


  /*
   * -------------------------------------------------------
   * VALID ACTUAL PAYMENTS
   * -------------------------------------------------------
   */

  const validPayments =
    payments
      .filter(
        payment => {

          if (
            !payment
          ) {
            return false;
          }


          if (
            payment.paymentDate
          ) {

            const paymentDate =
              normalizeDate(
                payment.paymentDate
              );


            if (
              !paymentDate
            ) {
              return false;
            }


            paymentDate.setHours(
              23,
              59,
              59,
              999
            );


            return (
              paymentDate.getTime() <=
              today.getTime()
            );
          }


          return true;
        }
      )
      .slice()
      .sort(
        (
          a,
          b
        ) => {

          const da =
            normalizeDate(
              a.paymentDate
            );


          const db =
            normalizeDate(
              b.paymentDate
            );


          return (
            (
              da?.getTime() ||
              0
            ) -
            (
              db?.getTime() ||
              0
            )
          );
        }
      );


  /*
   * -------------------------------------------------------
   * TRACK ACTUAL INSTALLMENTS
   * -------------------------------------------------------
   */

  const paidInstallmentSet =
    new Set<number>();


  for (
    let installmentNo = 1;
    installmentNo <=
      automaticPaidInstallments;
    installmentNo++
  ) {

    paidInstallmentSet.add(
      installmentNo
    );
  }


  for (
    const payment of validPayments
  ) {

    const installmentNo =
      safeNumber(
        payment.installmentNo
      );


    if (
      installmentNo <= 0
    ) {
      continue;
    }


    if (
      payment.status ===
        'PAID' ||
      payment.status ===
        'PREPAYMENT'
    ) {

      paidInstallmentSet.add(
        installmentNo
      );
    }
  }


  /*
   * -------------------------------------------------------
   * APPLY ACTUAL PAYMENTS
   * -------------------------------------------------------
   */

  for (
    const payment of validPayments
  ) {

    const installmentNo =
      safeNumber(
        payment.installmentNo
      );


    const status =
      payment.status;


    /*
     * Avoid double-counting normal EMI payments
     * that were already automatically included.
     */
    if (
      status === 'PAID' &&
      Number.isFinite(
        installmentNo
      ) &&
      installmentNo >= 1 &&
      installmentNo <=
        automaticPaidInstallments
    ) {

      continue;
    }


    /*
     * PRINCIPAL
     */

    let paymentPrincipal =
      safeNumber(
        payment.principal
      );


    /*
     * Compatibility with older records.
     */
    if (
      paymentPrincipal <= 0 &&
      (
        status === 'PAID' ||
        status === 'PREPAYMENT'
      )
    ) {

      const amount =
        safeNumber(
          payment.amount
        );


      if (
        amount > 0
      ) {

        paymentPrincipal =
          amount;
      }
    }


    /*
     * Never deduct more than outstanding.
     */
    paymentPrincipal =
      Math.min(
        paymentPrincipal,
        currentOutstanding
      );


    if (
      paymentPrincipal > 0
    ) {

      currentOutstanding =
        Math.max(
          0,
          currentOutstanding -
            paymentPrincipal
        );


      principalPaid +=
        paymentPrincipal;
    }


    /*
     * INTEREST
     */

    const paymentInterest =
      safeNumber(
        payment.interest
      );


    if (
      paymentInterest > 0
    ) {

      interestPaid +=
        paymentInterest;
    }
  }


  /*
   * -------------------------------------------------------
   * ROUND
   * -------------------------------------------------------
   */

  currentOutstanding =
    roundMoney(
      currentOutstanding
    );


  principalPaid =
    roundMoney(
      principalPaid
    );


  interestPaid =
    roundMoney(
      interestPaid
    );


  /*
   * -------------------------------------------------------
   * FULLY PAID
   * -------------------------------------------------------
   */

  if (
    currentOutstanding <=
    0.01
  ) {

    currentOutstanding =
      0;


    const lastPaidInstallment =
      Math.max(
        automaticPaidInstallments,
        ...Array.from(
          paidInstallmentSet
        )
      );


    const lastPaidRow =
      original.schedule.find(
        row =>
          row.installmentNo ===
          lastPaidInstallment
      ) ||
      original.schedule[
        original.schedule.length - 1
      ];


    const paidInstallments =
      Math.min(
        original.schedule.length,
        Math.max(
          automaticPaidInstallments,
          paidInstallmentSet.size
        )
      );


    return {

      emi:
        Math.round(
          storedEmi
        ),

      totalPrincipal:
        originalPrincipal,

      totalInterest:
        interestPaid,

      totalPayment:
        roundMoney(
          originalPrincipal +
          interestPaid
        ),

      maturityDate:
        lastPaidRow?.dueDate ||
        original.maturityDate,

      schedule: [],

      currentOutstanding:
        0,

      paidInstallments,

      remainingMonths:
        0,

      nextEmiDate:
        undefined,

      lastEmiDate:
        lastPaidRow?.dueDate,
    };
  }


  /*
   * -------------------------------------------------------
   * NEXT CONTRACTUAL EMI
   * -------------------------------------------------------
   */

  const nextOriginalRow =
    original.schedule.find(
      row => {

        const dueDate =
          dateOnly(
            new Date(
              row.dueDate
            )
          );


        const currentDay =
          dateOnly(
            today
          );


        return (
          dueDate.getTime() >
          currentDay.getTime()
        );
      }
    );


  const nextEmiDate =
    nextOriginalRow?.dueDate ||
    original.schedule[
      original.schedule.length - 1
    ]?.dueDate ||
    new Date(today);


  /*
   * -------------------------------------------------------
   * REMAINING EMI SCHEDULE
   * -------------------------------------------------------
   */

  const startingInstallmentNo =
    nextOriginalRow?.installmentNo ||
    automaticPaidInstallments + 1;


  const adjusted =
    calculateRemainingEMI({

      principal:
        currentOutstanding,

      annualInterestRate:
        safeNumber(
          loan.annualInterestRate
        ),

      emi:
        storedEmi,

      firstEmiDate:
        nextEmiDate,

      startingInstallmentNo,

      maxMonths:
        600,
    });


  const remainingMonths =
    adjusted.schedule.length;


  /*
   * -------------------------------------------------------
   * PAID INSTALLMENTS
   * -------------------------------------------------------
   */

  const paidInstallments =
    Array.from(
      paidInstallmentSet
    ).filter(
      installmentNo =>
        installmentNo >= 1 &&
        installmentNo <=
          original.schedule.length
    ).length;


  /*
   * -------------------------------------------------------
   * RETURN
   * -------------------------------------------------------
   */

  return {

    emi:
      Math.round(
        storedEmi
      ),

    totalPrincipal:
      principalPaid,

    totalInterest:
      interestPaid,

    totalPayment:
      roundMoney(
        principalPaid +
        interestPaid
      ),

    maturityDate:
      adjusted.maturityDate,

    schedule:
      adjusted.schedule,

    currentOutstanding,

    paidInstallments,

    remainingMonths,

    nextEmiDate:
      adjusted.schedule[0]?.dueDate ||
      nextEmiDate,

    lastEmiDate:
      adjusted.maturityDate,
  };
}


/*
 * =========================================================
 * AUTOMATIC EMI COUNT
 * =========================================================
 */

function countAutomaticallyPaidInstallments(
  schedule: EMIScheduleRow[],
  asOfDate: Date
): number {

  const today =
    dateOnly(
      asOfDate
    );


  let count =
    0;


  for (
    const row of schedule
  ) {

    const dueDate =
      dateOnly(
        new Date(
          row.dueDate
        )
      );


    if (
      dueDate.getTime() <=
      today.getTime()
    ) {

      count++;

    } else {

      break;
    }
  }


  return count;
}