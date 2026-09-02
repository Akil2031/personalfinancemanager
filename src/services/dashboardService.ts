import {
  collection,
  getDocs,
} from 'firebase/firestore';

import { db } from '../config/firebase';

import { Loan } from '../models/loan';

import {
  getDebtFreeTarget,
} from './debtFreeTargetService';

import {
  DebtFreeTarget,
} from '../models/debtFreeTarget';

import {
  calculateLoanPosition,
  LoanPosition,
} from '../engine/loanPosition';


export interface DashboardLoan {
  loan: Loan;

  position: LoanPosition;

  principalPaid: number;

  interestPaid: number;
}


export interface DashboardSummary {
  activeLoans: number;

  totalOriginalPrincipal: number;

  totalOutstanding: number;

  totalMonthlyEMI: number;

  totalPrincipalPaid: number;

  totalInterestPaid: number;

  nextEMIAmount: number | null;

  nextEMIDate: string | null;

  nextEMILoanCount: number;

  loans: DashboardLoan[];

  target: DebtFreeTarget | null;
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


/*
 * Parse YYYY-MM-DD as a local date.
 *
 * This avoids UTC date shifting.
 */

function parseDateString(
  value?: string | null
): Date | null {
  if (!value) {
    return null;
  }

  const normalized =
    String(value).substring(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );

  if (!match) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

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


/*
 * Return YYYY-MM-DD for comparing EMI dates.
 */

function emiDateKey(
  value?: string | null
): string | null {
  if (!value) {
    return null;
  }

  const date =
    parseDateString(value);

  if (!date) {
    return null;
  }

  return (
    `${date.getFullYear()}-` +
    `${String(
      date.getMonth() + 1
    ).padStart(2, '0')}-` +
    `${String(
      date.getDate()
    ).padStart(2, '0')}`
  );
}


/*
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [
    loansSnapshot,
    target,
  ] = await Promise.all([
    getDocs(
      collection(
        db,
        'loans'
      )
    ),

    getDebtFreeTarget(),
  ]);


  /*
   * =======================================================
   * LOAD LOANS
   * =======================================================
   */

  const loans: Loan[] =
    loansSnapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...(doc.data() as Loan),
      })
    );


  /*
   * =======================================================
   * TODAY
   * =======================================================
   */

  const today =
    new Date();


  /*
   * =======================================================
   * ACTIVE LOANS + POSITION
   * =======================================================
   *
   * IMPORTANT:
   *
   * Do NOT use loan.currentOutstanding here.
   *
   * The current position is calculated from the same
   * loan-position engine used by Financial Insights.
   */

  const dashboardLoans:
    DashboardLoan[] =
    loans
      .filter(
        (loan) =>
          loan.status === 'ACTIVE'
      )
      .map(
        (loan) => {

          const position =
            calculateLoanPosition(
              loan,
              today
            );

          return {
            loan,

            position,

            principalPaid:
              safeNumber(
                position.principalPaid
              ),

            interestPaid:
              safeNumber(
                position.interestPaid
              ),
          };
        }
      );


  /*
   * =======================================================
   * TOTAL ORIGINAL PRINCIPAL
   * =======================================================
   */

  const totalOriginalPrincipal =
    dashboardLoans.reduce(
      (
        sum,
        item
      ) =>
        sum +
        safeNumber(
          item.loan
            .originalPrincipal
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL OUTSTANDING
   * =======================================================
   */

  const totalOutstanding =
    dashboardLoans.reduce(
      (
        sum,
        item
      ) =>
        sum +
        safeNumber(
          item.position
            .currentOutstanding
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL MONTHLY EMI
   * =======================================================
   */

  const totalMonthlyEMI =
    dashboardLoans.reduce(
      (
        sum,
        item
      ) =>
        sum +
        safeNumber(
          item.loan.emi
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL PRINCIPAL PAID
   * =======================================================
   */

  const totalPrincipalPaid =
    dashboardLoans.reduce(
      (
        sum,
        item
      ) =>
        sum +
        safeNumber(
          item.position.principalPaid
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL INTEREST PAID
   * =======================================================
   */

  const totalInterestPaid =
    dashboardLoans.reduce(
      (
        sum,
        item
      ) =>
        sum +
        safeNumber(
          item.position.interestPaid
        ),
      0
    );


  /*
   * =======================================================
   * NEXT EMI
   * =======================================================
   *
   * Find the EARLIEST upcoming EMI date.
   *
   * If multiple loans have the same date,
   * combine all their EMI amounts.
   */

  let nextEMIDate:
    string | null = null;

  let nextEMIAmount:
    number | null = null;

  let nextEMILoanCount =
    0;


  const upcomingLoans =
    dashboardLoans.filter(
      (item) =>
        !!item.position
          .nextEmiDate
    );


  /*
   * Find earliest date.
   */

  for (
    const item of upcomingLoans
  ) {
    const date =
      item.position.nextEmiDate;

    if (!date) {
      continue;
    }

    if (!nextEMIDate) {
      nextEMIDate = date;
      continue;
    }

    const currentDate =
      parseDateString(date);

    const existingDate =
      parseDateString(
        nextEMIDate
      );

    if (
      currentDate &&
      existingDate &&
      currentDate.getTime() <
        existingDate.getTime()
    ) {
      nextEMIDate = date;
    }
  }


  /*
   * Sum every loan whose next EMI falls on
   * the same earliest date.
   */

  if (nextEMIDate) {
    const earliestKey =
      emiDateKey(
        nextEMIDate
      );

    let combinedAmount = 0;

    let loanCount = 0;

    for (
      const item of upcomingLoans
    ) {
      const itemKey =
        emiDateKey(
          item.position
            .nextEmiDate
        );

      if (
        itemKey &&
        earliestKey &&
        itemKey === earliestKey
      ) {
        combinedAmount +=
          safeNumber(
            item.loan.emi
          );

        loanCount += 1;
      }
    }

    nextEMIAmount =
      combinedAmount;

    nextEMILoanCount =
      loanCount;
  }


  /*
   * =======================================================
   * RETURN
   * =======================================================
   */

  return {
    activeLoans:
      dashboardLoans.length,

    totalOriginalPrincipal,

    totalOutstanding,

    totalMonthlyEMI,

    totalPrincipalPaid,

    totalInterestPaid,

    nextEMIAmount,

    nextEMIDate,

    nextEMILoanCount,

    loans: dashboardLoans,

    target,
  };
}