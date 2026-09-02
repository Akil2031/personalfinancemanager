import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import {
  db,
} from '../config/firebase';

import {
  Loan,
  RepaymentType,
} from '../models/loan';


/*
 * =========================================================
 * FIRESTORE COLLECTION
 * =========================================================
 */

const loansCollection =
  collection(
    db,
    'loans'
  );


/*
 * =========================================================
 * HELPERS
 * =========================================================
 */


/**
 * Safely convert a value to a number.
 */
function safeNumber(
  value: unknown,
  fallback = 0
): number {

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}


/**
 * Safely convert a value to a string.
 */
function safeString(
  value: unknown,
  fallback = ''
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value);
}


/**
 * Keep dates stored as YYYY-MM-DD.
 *
 * This avoids timezone problems when a date
 * such as 2026-09-01 is converted through UTC.
 */
function normalizeDate(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }


  /*
   * Firestore Timestamp.
   */
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === 'function'
  ) {

    const date =
      (
        value as {
          toDate: () => Date;
        }
      ).toDate();

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return formatDate(
        date
      );
    }
  }


  /*
   * JavaScript Date.
   */
  if (
    value instanceof Date
  ) {

    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return '';
    }

    return formatDate(
      value
    );
  }


  const stringValue =
    String(value).trim();


  if (!stringValue) {
    return '';
  }


  /*
   * Already YYYY-MM-DD or ISO.
   */
  const match =
    /^(\d{4})-(\d{2})-(\d{2})/.exec(
      stringValue
    );

  if (match) {

    return (
      `${match[1]}-` +
      `${match[2]}-` +
      `${match[3]}`
    );
  }


  /*
   * Last attempt.
   */
  const parsed =
    new Date(
      stringValue
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return '';
  }

  return formatDate(
    parsed
  );
}


/**
 * Format Date as local YYYY-MM-DD.
 */
function formatDate(
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


/**
 * Normalize repayment type.
 *
 * Existing loans do not have repaymentType,
 * therefore they remain normal EMI loans.
 */
function normalizeRepaymentType(
  value: unknown
): RepaymentType {

  if (
    value ===
    'INTEREST_ONLY'
  ) {
    return 'INTEREST_ONLY';
  }

  return 'EMI';
}


/**
 * Convert a Firestore document into the
 * application Loan model.
 */
function mapLoanDocument(
  snapshot: any
): Loan {

  const data =
    snapshot.data() || {};


  const repaymentType =
    normalizeRepaymentType(
      data.repaymentType
    );


  /*
   * Backward compatibility:
   *
   * Old Firestore loans have no repaymentType.
   * They are treated as normal EMI loans.
   */
  const originalPrincipal =
    safeNumber(
      data.originalPrincipal
    );


  const currentOutstanding =
    safeNumber(
      data.currentOutstanding,
      originalPrincipal
    );


  const annualInterestRate =
    safeNumber(
      data.annualInterestRate
    );


  const emi =
    repaymentType ===
    'INTEREST_ONLY'
      ? 0
      : safeNumber(
          data.emi
        );


  const monthlyInterest =
    repaymentType ===
    'INTEREST_ONLY'
      ? safeNumber(
          data.monthlyInterest
        )
      : 0;


  return {

    id:
      snapshot.id,


    lender:
      safeString(
        data.lender
      ),


    loanName:
      safeString(
        data.loanName
      ),


    loanType:
      data.loanType ||
      'OTHER',


    repaymentType,


    originalPrincipal,


    currentOutstanding,


    annualInterestRate,


    interestType:
      data.interestType ||
      'FIXED',


    emi,


    monthlyInterest,


    tenureMonths:
      safeNumber(
        data.tenureMonths
      ),


    remainingMonths:
      safeNumber(
        data.remainingMonths,
        safeNumber(
          data.tenureMonths
        )
      ),


    loanStartDate:
      normalizeDate(
        data.loanStartDate
      ),


    firstEmiDate:
      normalizeDate(
        data.firstEmiDate
      ),


    maturityDate:
      normalizeDate(
        data.maturityDate
      ),


    status:
      data.status ||
      'ACTIVE',
  };
}


/*
 * =========================================================
 * CLEAN LOAN DATA
 * =========================================================
 *
 * This is the only place where application Loan objects
 * are converted into Firestore-safe data.
 *
 * IMPORTANT:
 *
 * - Never save calculated helper properties.
 * - Never save undefined.
 * - Interest-only loans always have emi = 0.
 * =========================================================
 */

function cleanLoanData(
  loan: Loan
) {

  const repaymentType =
    normalizeRepaymentType(
      loan.repaymentType
    );


  const originalPrincipal =
    safeNumber(
      loan.originalPrincipal
    );


  /*
   * For a newly-created loan this should normally
   * equal originalPrincipal.
   *
   * For an edited loan, preserve the supplied value.
   */
  const currentOutstanding =
    Math.max(
      0,
      safeNumber(
        loan.currentOutstanding,
        originalPrincipal
      )
    );


  const annualInterestRate =
    Math.max(
      0,
      safeNumber(
        loan.annualInterestRate
      )
    );


  /*
   * Normal EMI loan:
   *     use the calculated EMI.
   *
   * Interest-only:
   *     EMI is always zero.
   */
  const emi =
    repaymentType ===
    'INTEREST_ONLY'
      ? 0
      : Math.max(
          0,
          safeNumber(
            loan.emi
          )
        );


  /*
   * Interest-only monthly interest.
   *
   * If AddLoanScreen has already calculated this,
   * preserve it.
   *
   * If it hasn't, calculate it here from:
   *
   * principal × annual rate / 12
   */
  let monthlyInterest =
    0;


  if (
    repaymentType ===
    'INTEREST_ONLY'
  ) {

    monthlyInterest =
      safeNumber(
        loan.monthlyInterest
      );


    if (
      monthlyInterest <=
      0 &&
      originalPrincipal > 0 &&
      annualInterestRate >= 0
    ) {

      monthlyInterest =
        Math.round(
          (
            originalPrincipal *
            annualInterestRate /
            100 /
            12
          ) +
          Number.EPSILON
        );
    }
  }


  const data: Record<
    string,
    unknown
  > = {

    lender:
      safeString(
        loan.lender
      ).trim(),


    loanName:
      safeString(
        loan.loanName
      ).trim(),


    loanType:
      loan.loanType ||
      'OTHER',


    repaymentType,


    originalPrincipal,


    currentOutstanding,


    annualInterestRate,


    interestType:
      loan.interestType ||
      'FIXED',


    emi,


    monthlyInterest,


    tenureMonths:
      Math.max(
        0,
        Math.round(
          safeNumber(
            loan.tenureMonths
          )
        )
      ),


    remainingMonths:
      Math.max(
        0,
        Math.round(
          safeNumber(
            loan.remainingMonths,
            safeNumber(
              loan.tenureMonths
            )
          )
        )
      ),


    loanStartDate:
      normalizeDate(
        loan.loanStartDate
      ),


    firstEmiDate:
      normalizeDate(
        loan.firstEmiDate
      ),


    status:
      loan.status ||
      'ACTIVE',
  };


  /*
   * Maturity date is meaningful primarily for
   * interest-only loans, but we preserve it
   * if supplied.
   */
  if (
    loan.maturityDate
  ) {

    data.maturityDate =
      normalizeDate(
        loan.maturityDate
      );

  } else {

    data.maturityDate =
      '';
  }


  return data;
}


/*
 * =========================================================
 * ADD LOAN
 * =========================================================
 */

export async function addLoan(
  loan: Loan
): Promise<string> {

  console.log(
    '[LOAN SERVICE] Adding loan:',
    loan
  );


  try {

    const data =
      cleanLoanData(
        loan
      );


    /*
     * Basic validation.
     */
    if (
      !data.lender
    ) {
      throw new Error(
        'Lender name is required.'
      );
    }


    if (
      !data.loanName
    ) {
      throw new Error(
        'Loan name is required.'
      );
    }


    if (
      safeNumber(
        data.originalPrincipal
      ) <= 0
    ) {
      throw new Error(
        'Original loan amount must be greater than zero.'
      );
    }


    if (
      safeNumber(
        data.annualInterestRate
      ) < 0
    ) {
      throw new Error(
        'Interest rate cannot be negative.'
      );
    }


    if (
      safeNumber(
        data.tenureMonths
      ) <= 0
    ) {
      throw new Error(
        'Loan tenure must be greater than zero.'
      );
    }


    /*
     * Create Firestore document.
     */
    const documentData = {

      ...data,


      /*
       * Audit field.
       */
      createdAt:
        serverTimestamp(),


      updatedAt:
        serverTimestamp(),
    };


    const documentReference =
      await addDoc(
        loansCollection,
        documentData
      );


    console.log(
      '[LOAN SERVICE] Loan created:',
      documentReference.id
    );


    return documentReference.id;

  } catch (
    error
  ) {

    console.error(
      '[LOAN SERVICE] addLoan failed:',
      error
    );


    if (
      error instanceof Error
    ) {
      throw error;
    }


    throw new Error(
      'Unable to add loan.'
    );
  }
}


/*
 * =========================================================
 * GET ALL LOANS
 * =========================================================
 */

export async function getLoans(): Promise<
  Loan[]
> {

  console.log(
    '[LOAN SERVICE] Loading loans...'
  );


  try {

    const snapshot =
      await getDocs(
        loansCollection
      );


    const loans =
      snapshot.docs.map(
        (
          document
        ) =>
          mapLoanDocument(
            document
          )
      );


    /*
     * Sort newest first.
     *
     * We intentionally sort in JavaScript rather
     * than requiring a Firestore index.
     */
    loans.sort(
      (
        a,
        b
      ) => {

        const dateA =
          normalizeDate(
            a.loanStartDate
          );

        const dateB =
          normalizeDate(
            b.loanStartDate
          );


        return dateB.localeCompare(
          dateA
        );
      }
    );


    console.log(
      '[LOAN SERVICE] Loans loaded:',
      loans.length
    );


    return loans;

  } catch (
    error
  ) {

    console.error(
      '[LOAN SERVICE] getLoans failed:',
      error
    );


    if (
      error instanceof Error
    ) {
      throw error;
    }


    throw new Error(
      'Unable to load loans.'
    );
  }
}


/*
 * =========================================================
 * GET SINGLE LOAN
 * =========================================================
 */

export async function getLoan(
  loanId: string
): Promise<Loan | null> {

  if (
    !loanId
  ) {
    throw new Error(
      'Loan ID is required.'
    );
  }


  try {

    const snapshot =
      await getDocs(
        loansCollection
      );


    const document =
      snapshot.docs.find(
        item =>
          item.id ===
          loanId
      );


    if (
      !document
    ) {
      return null;
    }


    return mapLoanDocument(
      document
    );

  } catch (
    error
  ) {

    console.error(
      '[LOAN SERVICE] getLoan failed:',
      error
    );


    if (
      error instanceof Error
    ) {
      throw error;
    }


    throw new Error(
      'Unable to load loan.'
    );
  }
}


/*
 * =========================================================
 * UPDATE LOAN
 * =========================================================
 */

export async function updateLoan(
  loanId: string,
  changes: Partial<Loan>
): Promise<void> {

  if (
    !loanId
  ) {
    throw new Error(
      'Loan ID is required.'
    );
  }


  console.log(
    '[LOAN SERVICE] Updating loan:',
    loanId,
    changes
  );


  try {

    /*
     * We deliberately build the update object
     * field-by-field.
     *
     * This prevents helper fields such as
     * __actualPayments from accidentally being
     * written to Firestore.
     */
    const data: Record<
      string,
      unknown
    > = {};


    if (
      changes.lender !==
      undefined
    ) {

      data.lender =
        safeString(
          changes.lender
        ).trim();
    }


    if (
      changes.loanName !==
      undefined
    ) {

      data.loanName =
        safeString(
          changes.loanName
        ).trim();
    }


    if (
      changes.loanType !==
      undefined
    ) {

      data.loanType =
        changes.loanType;
    }


    /*
     * -------------------------------------------------------
     * REPAYMENT TYPE
     * -------------------------------------------------------
     */

    const repaymentType =
      changes.repaymentType !==
      undefined
        ? normalizeRepaymentType(
            changes.repaymentType
          )
        : undefined;


    if (
      repaymentType !==
      undefined
    ) {

      data.repaymentType =
        repaymentType;


      /*
       * Interest-only loans must not retain
       * a normal EMI value.
       */
      if (
        repaymentType ===
        'INTEREST_ONLY'
      ) {

        data.emi =
          0;
      }
    }


    if (
      changes.originalPrincipal !==
      undefined
    ) {

      data.originalPrincipal =
        Math.max(
          0,
          safeNumber(
            changes.originalPrincipal
          )
        );
    }


    if (
      changes.currentOutstanding !==
      undefined
    ) {

      data.currentOutstanding =
        Math.max(
          0,
          safeNumber(
            changes.currentOutstanding
          )
        );
    }


    if (
      changes.annualInterestRate !==
      undefined
    ) {

      data.annualInterestRate =
        Math.max(
          0,
          safeNumber(
            changes.annualInterestRate
          )
        );
    }


    if (
      changes.interestType !==
      undefined
    ) {

      data.interestType =
        changes.interestType;
    }


    /*
     * Only write EMI when this update explicitly
     * supplies it AND the loan is not being changed
     * to interest-only.
     */
    if (
      changes.emi !==
      undefined &&
      repaymentType !==
      'INTEREST_ONLY'
    ) {

      data.emi =
        Math.max(
          0,
          safeNumber(
            changes.emi
          )
        );
    }


    /*
     * Monthly interest.
     */
    if (
      changes.monthlyInterest !==
      undefined
    ) {

      data.monthlyInterest =
        Math.max(
          0,
          safeNumber(
            changes.monthlyInterest
          )
        );
    }


    if (
      changes.tenureMonths !==
      undefined
    ) {

      data.tenureMonths =
        Math.max(
          0,
          Math.round(
            safeNumber(
              changes.tenureMonths
            )
          )
        );
    }


    if (
      changes.remainingMonths !==
      undefined
    ) {

      data.remainingMonths =
        Math.max(
          0,
          Math.round(
            safeNumber(
              changes.remainingMonths
            )
          )
        );
    }


    if (
      changes.loanStartDate !==
      undefined
    ) {

      data.loanStartDate =
        normalizeDate(
          changes.loanStartDate
        );
    }


    if (
      changes.firstEmiDate !==
      undefined
    ) {

      data.firstEmiDate =
        normalizeDate(
          changes.firstEmiDate
        );
    }


    if (
      changes.maturityDate !==
      undefined
    ) {

      data.maturityDate =
        normalizeDate(
          changes.maturityDate
        );
    }


    if (
      changes.status !==
      undefined
    ) {

      data.status =
        changes.status;
    }


    /*
     * If no actual fields were supplied,
     * don't perform an empty Firestore update.
     */
    if (
      Object.keys(data).length ===
      0
    ) {

      console.warn(
        '[LOAN SERVICE] No fields to update:',
        loanId
      );

      return;
    }


    /*
     * Always update modified timestamp.
     */
    data.updatedAt =
      serverTimestamp();


    const loanReference =
      doc(
        db,
        'loans',
        loanId
      );


    await updateDoc(
      loanReference,
      data
    );


    console.log(
      '[LOAN SERVICE] Loan updated successfully:',
      loanId
    );

  } catch (
    error
  ) {

    console.error(
      '[LOAN SERVICE] updateLoan failed:',
      loanId,
      error
    );


    if (
      error instanceof Error
    ) {
      throw error;
    }


    throw new Error(
      'Unable to update loan.'
    );
  }
}


/*
 * =========================================================
 * DELETE LOAN
 * =========================================================
 */

export async function deleteLoan(
  loanId: string
): Promise<void> {

  if (
    !loanId
  ) {
    throw new Error(
      'Loan ID is required.'
    );
  }


  console.log(
    '[LOAN SERVICE] Deleting loan:',
    loanId
  );


  try {

    const loanReference =
      doc(
        db,
        'loans',
        loanId
      );


    await deleteDoc(
      loanReference
    );


    console.log(
      '[LOAN SERVICE] Loan deleted:',
      loanId
    );

  } catch (
    error
  ) {

    console.error(
      '[LOAN SERVICE] deleteLoan failed:',
      loanId,
      error
    );


    if (
      error instanceof Error
    ) {
      throw error;
    }


    throw new Error(
      'Unable to delete loan.'
    );
  }
}