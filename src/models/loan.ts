export type LoanType =
  | 'HOME_LOAN'
  | 'VEHICLE_LOAN'
  | 'PERSONAL_LOAN'
  | 'BUSINESS_LOAN'
  | 'GOLD_LOAN'
  | 'OTHER';


export type InterestType =
  | 'FIXED'
  | 'FLOATING';


export type LoanStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED';


/*
 * HOW THE PRINCIPAL IS REPAYED
 *
 * EMI:
 *     Normal principal + interest EMI.
 *
 * INTEREST_ONLY:
 *     Periodic payment is interest only.
 *     Principal reduces ONLY when a payment
 *     containing principal is recorded.
 */
export type RepaymentType =
  | 'EMI'
  | 'INTEREST_ONLY';


export interface Loan {

  id?: string;

  lender: string;

  loanName: string;

  loanType: LoanType;

  /*
   * New field.
   *
   * Optional so existing Firestore loans
   * continue to work as normal EMI loans.
   */
  repaymentType?: RepaymentType;


  originalPrincipal: number;

  currentOutstanding: number;

  annualInterestRate: number;

  interestType: InterestType;


  /*
   * Normal EMI.
   *
   * For INTEREST_ONLY loans this is 0.
   */
  emi: number;


  /*
   * Monthly interest-only commitment.
   *
   * Example:
   *
   * Principal = ₹5,00,000
   * Rate      = 12%
   *
   * Monthly Interest = ₹5,000
   */
  monthlyInterest?: number;


  tenureMonths: number;

  remainingMonths: number;

  loanStartDate: string;

  firstEmiDate: string;


  /*
   * Optional maturity date.
   *
   * Particularly useful for Gold Loans
   * and private borrowings.
   */
  maturityDate?: string;


  status: LoanStatus;

}