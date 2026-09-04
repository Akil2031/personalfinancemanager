import { Loan } from '../models/loan';
import { AmortizationEntry } from '../models/amortization';

export type AmortizationChangedField =
  | 'EMI'
  | 'OPENING_BALANCE'
  | 'PRINCIPAL'
  | 'INTEREST'
  | 'CLOSING_BALANCE'
  | 'ENTRY_TYPE'
  | 'DATE';

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const money = (v: number) =>
  Math.round((v + Number.EPSILON) * 100) / 100;

const positiveMoney = (v: unknown) =>
  Math.max(0, money(n(v)));

/**
 * Recalculate all rows AFTER an edited amortization row.
 *
 * The edited row is authoritative: its financial values are never changed by
 * this function.  The edited field tells us what should be carried forward:
 *
 * - EMI              -> carry the new EMI to later EMI rows.
 * - INTEREST         -> use the edited row's effective monthly rate for later
 *                       EMI rows (interest / opening balance).
 * - PRINCIPAL        -> use the edited balance as the starting point.
 * - CLOSING_BALANCE  -> use the edited closing balance as the starting point.
 * - OPENING_BALANCE  -> use the edited row's closing balance as the starting
 *                       point; the row itself remains exactly as entered.
 *
 * Future rows that were individually manually adjusted remain individually
 * authoritative.  This allows a lender schedule to contain multiple special
 * corrections without losing them when an earlier EMI/rate is changed.
 */
export function recalculateFutureAmortization(
  loan: Loan,
  entries: AmortizationEntry[],
  changedIndex: number,
  changedField: AmortizationChangedField = 'CLOSING_BALANCE',
): AmortizationEntry[] {
  if (!entries.length || changedIndex < 0 || changedIndex >= entries.length) {
    return entries;
  }

  const ordered = [...entries].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );

  const defaultMonthlyRate =
    Math.max(0, n(loan.annualInterestRate)) / 100 / 12;

  const anchor = ordered[changedIndex];

  // If interest was explicitly edited, preserve the implied monthly rate for
  // the future schedule. Otherwise use the loan's configured annual rate.
  let monthlyRate = defaultMonthlyRate;
  if (changedField === 'INTEREST') {
    const anchorOpening = positiveMoney(anchor.openingBalance);
    if (anchorOpening > 0 && n(anchor.interest) >= 0) {
      monthlyRate = n(anchor.interest) / anchorOpening;
    }
  }

  // If EMI was edited, that EMI becomes the new scheduled EMI for later normal
  // EMI rows until another individually adjusted EMI is encountered.
  let carriedEmi: number | undefined =
    changedField === 'EMI' && anchor.entryType === 'EMI'
      ? positiveMoney(anchor.emi)
      : undefined;

  let balance = positiveMoney(anchor.closingBalance);

  for (let i = changedIndex + 1; i < ordered.length; i++) {
    const row = ordered[i];
    const next = { ...row };

    next.openingBalance = money(balance);

    // A future row explicitly edited by the user is another authority point.
    // We still repair its opening balance so the balance chain remains valid,
    // but we preserve its manually entered EMI/interest/principal economics.
    const preserveManualEconomics =
      row.isManuallyAdjusted === true &&
      row.entryType === 'EMI';

    if (row.entryType === 'PREPAYMENT' || row.entryType === 'PART_PREPAYMENT') {
      const scheduledPrincipal = Math.max(
        0,
        n(row.principal),
      );

      next.interest = 0;
      next.emi = money(scheduledPrincipal);
      next.principal = money(
        Math.min(next.openingBalance, scheduledPrincipal),
      );
      next.closingBalance = money(
        Math.max(0, next.openingBalance - next.principal),
      );
    } else if (row.entryType === 'ADJUSTMENT') {
      // Adjustment rows retain their entered principal/interest economics but
      // are connected to the new opening balance.
      const principal = Math.max(0, n(row.principal));
      const interest = Math.max(0, n(row.interest));

      next.principal = money(
        Math.min(next.openingBalance, principal),
      );
      next.interest = money(interest);
      next.emi = money(next.principal + next.interest);
      next.closingBalance = money(
        Math.max(0, next.openingBalance - next.principal),
      );
    } else {
      let emi: number;
      let interest: number;

      if (preserveManualEconomics) {
        // Preserve this row's manually entered EMI/interest.  Principal is
        // recalculated from them so the balance chain remains mathematically
        // connected to the previous row.
        emi = positiveMoney(row.emi);
        interest = positiveMoney(row.interest);
      } else {
        emi =
          carriedEmi !== undefined
            ? carriedEmi
            : positiveMoney(row.emi);
        interest = money(next.openingBalance * monthlyRate);
      }

      // Never create a negative balance. The last EMI naturally becomes a
      // smaller final payment if the scheduled EMI is larger than the amount
      // required to clear the loan.
      const maxPayment = money(next.openingBalance + interest);
      emi = Math.min(maxPayment, emi || maxPayment);
      const principal = money(Math.max(0, emi - interest));

      next.interest = money(interest);
      next.emi = money(emi);
      next.principal = money(
        Math.min(next.openingBalance, principal),
      );
      next.closingBalance = money(
        Math.max(0, next.openingBalance - next.principal),
      );

      // Once we encounter an individually adjusted EMI row, that row becomes
      // the new EMI anchor for subsequent ordinary EMI rows.
      if (preserveManualEconomics) {
        carriedEmi = emi;
      }
    }

    ordered[i] = next;
    balance = next.closingBalance;
  }

  return ordered.map((row, i) => ({
    ...row,
    loanId: loan.id || row.loanId,
    sequenceNo: i + 1,
  }));
}
