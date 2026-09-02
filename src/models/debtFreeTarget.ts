export interface DebtFreeTarget {
  id?: string;

  /*
   * Date by which the user wants all loans
   * to be completely paid.
   *
   * Stored as YYYY-MM-DD.
   */
  targetDate: string;

  /*
   * Outstanding debt when the target was created.
   *
   * This is automatically captured from the
   * current loan position.
   */
  baselineOutstanding: number;

  /*
   * Date on which baselineOutstanding was captured.
   *
   * Stored as YYYY-MM-DD.
   */
  baselineDate: string;

  /*
   * Optional extra monthly amount the user
   * intends to pay above regular EMIs.
   */
  additionalMonthlyPayment: number;

  createdAt?: unknown;

  updatedAt?: unknown;
}