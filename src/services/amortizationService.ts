import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Loan } from '../models/loan';
import { calculateEMI, EMIScheduleRow } from '../engine/emiCalculator';
import {
  AmortizationEntry,
  AmortizationEntryInput,
  AmortizationSource,
  AmortizationStatus,
  AmortizationStatusSource,
  AmortizationValidationIssue,
  AmortizationValidationResult,
} from '../models/amortization';

const SUBCOLLECTION = 'amortization';

function roundMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

function dateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function ref(loanId: string) {
  return collection(db, 'loans', loanId, SUBCOLLECTION);
}

function normalize(loanId: string, input: AmortizationEntryInput, sequenceNo: number): Omit<AmortizationEntry, 'id'> {
  if (!loanId) throw new Error('Loan ID is required.');
  if (!input.dueDate) throw new Error('Due date is required.');

  // Firestore does not accept undefined values. Build the object using only
  // fields that actually have values, while preserving optional fields.
  const data: Omit<AmortizationEntry, 'id'> = {
    loanId,
    sequenceNo: input.sequenceNo ?? sequenceNo,
    dueDate: dateOnly(input.dueDate),
    openingBalance: roundMoney(input.openingBalance),
    emi: roundMoney(input.emi),
    principal: roundMoney(input.principal),
    interest: roundMoney(input.interest),
    closingBalance: roundMoney(input.closingBalance),
    status: input.status ?? 'SCHEDULED',
    source: input.source ?? 'MANUAL',
    entryType: input.entryType ?? 'EMI',
    isManuallyAdjusted: input.isManuallyAdjusted ?? false,
    notes: input.notes?.trim() ?? '',
    updatedAt: new Date().toISOString(),
  };

  const installmentNo =
    input.installmentNo == null || Number.isNaN(Number(input.installmentNo))
      ? undefined
      : Math.round(Number(input.installmentNo));
  if (installmentNo !== undefined) data.installmentNo = installmentNo;

  if (input.statusSource !== undefined) {
    data.statusSource = input.statusSource;
  }

  if (input.paidDate) {
    data.paidDate = dateOnly(input.paidDate);
  }

  if (input.paidAmount !== undefined && input.paidAmount !== null) {
    data.paidAmount = roundMoney(input.paidAmount);
  }

  return data;
}

export async function getAmortizationSchedule(loanId: string): Promise<AmortizationEntry[]> {
  if (!loanId) throw new Error('Loan ID is required.');
  const snapshot = await getDocs(query(ref(loanId), orderBy('sequenceNo', 'asc')));
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AmortizationEntry, 'id'>) }));
}

export async function hasAmortizationSchedule(loanId: string): Promise<boolean> {
  return (await getAmortizationSchedule(loanId)).length > 0;
}

export async function addAmortizationEntry(loanId: string, input: AmortizationEntryInput): Promise<string> {
  const data = normalize(loanId, input, input.sequenceNo ?? 1);
  const now = new Date().toISOString();
  const result = await addDoc(ref(loanId), { ...data, createdAt: now, updatedAt: now });
  return result.id;
}

export async function updateAmortizationEntry(loanId: string, entryId: string, input: AmortizationEntryInput): Promise<void> {
  await updateDoc(doc(db, 'loans', loanId, SUBCOLLECTION, entryId), normalize(loanId, input, input.sequenceNo ?? 1));
}

export async function deleteAmortizationEntry(loanId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'loans', loanId, SUBCOLLECTION, entryId));
}

export async function updateAmortizationStatus(
  loanId: string,
  entryId: string,
  status: AmortizationStatus,
  options?: {
    source?: AmortizationStatusSource;
    paidDate?: string;
    paidAmount?: number;
    notes?: string;
  }
): Promise<void> {
  const data: Record<string, unknown> = {
    status,
    statusSource: options?.source ?? 'MANUAL',
    updatedAt: new Date().toISOString(),
  };
  if (options?.paidDate !== undefined) data.paidDate = options.paidDate ? dateOnly(options.paidDate) : '';
  if (options?.paidAmount !== undefined) data.paidAmount = roundMoney(options.paidAmount);
  if (options?.notes !== undefined) data.notes = options.notes.trim();
  if (status !== 'PAID') {
    data.paidDate = '';
    data.paidAmount = 0;
  }
  await updateDoc(doc(db, 'loans', loanId, SUBCOLLECTION, entryId), data);
}

/**
 * Automatically marks past EMI rows as PAID only when they have never been
 * manually overridden. A manual UNPAID choice is always respected.
 */
export async function syncAutomaticEmiStatuses(loanId: string, asOfDate: Date = new Date()): Promise<AmortizationEntry[]> {
  const entries = await getAmortizationSchedule(loanId);
  const today = dateOnly(asOfDate);
  const batch = writeBatch(db);
  let changed = false;

  for (const entry of entries) {
    if (entry.entryType !== 'EMI' || !entry.id) continue;
    const due = dateOnly(entry.dueDate);
    if (due >= today) continue;

    // Never overwrite a manual decision.
    if (entry.statusSource === 'MANUAL') continue;
    if (entry.status === 'PAID' && entry.statusSource === 'AUTO') continue;

    batch.update(doc(db, 'loans', loanId, SUBCOLLECTION, entry.id), {
      status: 'PAID',
      statusSource: 'AUTO',
      paidDate: due,
      paidAmount: roundMoney(entry.emi),
      updatedAt: new Date().toISOString(),
    });
    changed = true;
  }

  if (changed) await batch.commit();
  return changed ? getAmortizationSchedule(loanId) : entries;
}

export async function initializeAmortizationSchedule(loan: Loan, source: AmortizationSource = 'CALCULATED') {
  if (!loan.id) throw new Error('Loan ID is required to initialize the amortization schedule.');
  const existing = await getAmortizationSchedule(loan.id);
  if (existing.length) return { created: false, count: existing.length };
  if (loan.repaymentType === 'INTEREST_ONLY') throw new Error('Interest-only schedules should be entered separately.');

  const result = calculateEMI({
    principal: Number(loan.originalPrincipal),
    annualInterestRate: Number(loan.annualInterestRate),
    tenureMonths: Number(loan.tenureMonths),
    firstEmiDate: new Date(loan.firstEmiDate),
  });
  await replaceAmortizationSchedule(loan.id, result.schedule.map((row, i) => ({
    sequenceNo: i + 1,
    installmentNo: row.installmentNo,
    dueDate: dateOnly(row.dueDate),
    openingBalance: row.openingBalance,
    emi: row.emi,
    principal: row.principal,
    interest: row.interest,
    closingBalance: row.closingBalance,
    status: 'SCHEDULED',
    source,
    entryType: 'EMI',
    isManuallyAdjusted: false,
  })));
  return { created: true, count: result.schedule.length };
}

export async function replaceAmortizationSchedule(loanId: string, entries: AmortizationEntryInput[]): Promise<void> {
  if (!loanId) throw new Error('Loan ID is required.');
  if (!entries.length) throw new Error('At least one amortization entry is required.');
  const ordered = [...entries].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const normalized = ordered.map((e, i) => normalize(loanId, { ...e, sequenceNo: i + 1 }, i + 1));
  const old = await getAmortizationSchedule(loanId);
  for (const e of old) if (e.id) await deleteAmortizationEntry(loanId, e.id);

  for (let start = 0; start < normalized.length; start += 400) {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    normalized.slice(start, start + 400).forEach((data) => {
      const r = doc(ref(loanId));
      batch.set(r, { ...data, createdAt: now, updatedAt: now });
    });
    await batch.commit();
  }
}

export function validateAmortizationSchedule(entries: AmortizationEntry[]): AmortizationValidationResult {
  const issues: AmortizationValidationIssue[] = [];
  const sorted = entries.slice().sort((a, b) => a.sequenceNo - b.sequenceNo);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (previous && current.dueDate < previous.dueDate) issues.push({ installmentNo: current.installmentNo ?? 0, field: 'dueDate', message: 'Due date is earlier than the previous schedule row.' });
    if (previous && Math.abs(current.openingBalance - previous.closingBalance) > 0.01) issues.push({ installmentNo: current.installmentNo ?? 0, field: 'openingBalance', message: `Opening balance ₹${current.openingBalance} does not match previous closing balance ₹${previous.closingBalance}.` });
    if (current.entryType === 'EMI') {
      const expectedEmi = roundMoney(current.principal + current.interest);
      if (Math.abs(current.emi - expectedEmi) > 0.01) issues.push({ installmentNo: current.installmentNo ?? 0, field: 'emi', message: `EMI should normally equal principal + interest (₹${expectedEmi}), but is ₹${current.emi}.` });
    }
  }
  return { valid: issues.length === 0, issues };
}

export function mapEMIScheduleToAmortization(loanId: string, schedule: EMIScheduleRow[], source: AmortizationSource = 'CALCULATED'): AmortizationEntryInput[] {
  return schedule.map((row, i) => ({ sequenceNo: i + 1, installmentNo: row.installmentNo, dueDate: dateOnly(row.dueDate), openingBalance: row.openingBalance, emi: row.emi, principal: row.principal, interest: row.interest, closingBalance: row.closingBalance, status: 'SCHEDULED', source, entryType: 'EMI', isManuallyAdjusted: false }));
}

/**
 * Calculate the current principal outstanding from the persisted lender
 * amortization schedule.
 *
 * Rules:
 * - Only PAID rows reduce principal.
 * - EMI rows reduce by their principal component.
 * - PREPAYMENT / PART_PREPAYMENT rows reduce by their principal component
 *   (falling back to paidAmount when principal is not supplied).
 * - UNPAID and UPCOMING rows do not reduce outstanding.
 * - ADJUSTMENT rows are effective schedule/balance events. Their closing
 *   balance determines outstanding, and their principal/amount is included
 *   in paid/repaid totals when the adjustment is effective.
 *
 * This intentionally does not use today's date to decide whether an EMI was
 * paid. The status on the authoritative amortization row decides that.
 */
export function calculateAuthoritativeOutstanding(
  loan: Loan,
  entries: AmortizationEntry[],
  asOfDate: Date = new Date()
): number {
  return calculateAuthoritativeLoanMetrics(loan, entries, asOfDate).currentOutstanding;
}

/**
 * Returns the outstanding amount and the principal actually repaid from the
 * authoritative amortization schedule.
 */
export interface AuthoritativeLoanMetrics {
  originalPrincipal: number;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  currentOutstanding: number;
  principalPaidPercent: number;
}

/**
 * Calculates ALL loan position metrics from the persisted amortization
 * schedule.  The row status is the source of truth.
 *
 * PAID EMI: principal + interest are counted.
 * PAID prepayment/part-prepayment: principal is counted.
 * Effective ADJUSTMENT: principal/interest/amount are counted as additional
 *   financial value even when the row is not marked PAID.
 * UNPAID/UPCOMING EMI/prepayment: nothing is counted.
 *
 * This function deliberately does not use the due date to infer an EMI
 * payment. ADJUSTMENT rows are different: their effective date makes the
 * schedule/balance correction effective.
 */
export function calculateAuthoritativeLoanMetrics(
  loan: Loan,
  entries: AmortizationEntry[],
  asOfDate: Date = new Date()
): AuthoritativeLoanMetrics {
  const originalPrincipal = Math.max(0, roundMoney(loan.originalPrincipal));
  if (!entries.length) {
    return {
      originalPrincipal,
      principalPaid: 0,
      interestPaid: 0,
      totalPaid: 0,
      currentOutstanding: originalPrincipal,
      principalPaidPercent: 0,
    };
  }

  const today = new Date(asOfDate);
  today.setHours(23, 59, 59, 999);

  const ordered = [...entries].sort((a, b) =>
    String(a.dueDate).slice(0, 10).localeCompare(String(b.dueDate).slice(0, 10)) ||
    Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0)
  );

  let principalPaid = 0;
  let interestPaid = 0;
  let totalPaid = 0;
  let currentOutstanding = originalPrincipal;

  /*
   * IMPORTANT:
   *
   * The persisted amortization schedule is the financial source of truth.
   * Do not derive outstanding as originalPrincipal - sum(principal), because
   * lender schedules can contain adjustments, rescheduling, manual opening
   * balances and other corrections.
   *
   * Instead, the latest effective row's CLOSING BALANCE is the outstanding
   * balance. This is what makes the dashboard follow the amortization screen.
   */
  for (const entry of ordered) {
    const due = new Date(String(entry.dueDate).slice(0, 10) + 'T23:59:59');
    if (Number.isNaN(due.getTime()) || due.getTime() > today.getTime()) continue;

    const isEmi = entry.entryType === 'EMI';
    const isPrepayment =
      entry.entryType === 'PREPAYMENT' ||
      entry.entryType === 'PART_PREPAYMENT';
    const isAdjustment = entry.entryType === 'ADJUSTMENT';

    // EMI/prepayment rows affect the paid position only when they are PAID.
    // An adjustment is a schedule/balance correction, so once its effective
    // date is reached it affects the balance even though it is not a payment.
    const effective =
      (isEmi || isPrepayment) && entry.status === 'PAID'
        ? true
        : isAdjustment;

    if (!effective) {
      // A due EMI explicitly marked UNPAID is a break in the paid balance
      // chain. Do not let later rows make the dashboard appear ahead of it.
      if (isEmi && entry.status !== 'PAID') break;
      continue;
    }

    currentOutstanding = Math.max(0, roundMoney(entry.closingBalance));

    if (entry.status === 'PAID' && (isEmi || isPrepayment)) {
      let principal = Math.max(0, roundMoney(entry.principal));
      if (principal <= 0 && isPrepayment) {
        principal = Math.max(0, roundMoney(entry.paidAmount));
      }

      const interest = isEmi
        ? Math.max(0, roundMoney(entry.interest))
        : 0;

      const paidAmount = Math.max(
        0,
        roundMoney(
          entry.paidAmount == null
            ? entry.emi
            : entry.paidAmount
        )
      );

      principalPaid += principal;
      interestPaid += interest;
      totalPaid += paidAmount > 0 ? paidAmount : principal + interest;
    }

    /*
     * ADJUSTMENT rows are also financial events.  They are not normal EMI
     * payments and therefore do not need a PAID status, but they can contain
     * an additional principal amount (for example a lender part-prepayment
     * or rescheduling adjustment).  Those values must be included everywhere
     * the application reports paid/repaid amounts.
     *
     * Prefer the explicit principal/interest fields from the lender schedule.
     * If principal is missing, use the actual reduction in the schedule
     * balance.  This prevents an adjustment such as:
     *   opening  ₹4,10,699
     *   principal ₹10,699
     *   closing  ₹4,00,000
     * from being ignored in the paid/principal totals.
     */
    if (isAdjustment) {
      const balanceReduction = Math.max(
        0,
        roundMoney(entry.openingBalance - entry.closingBalance)
      );
      const adjustmentPrincipal = Math.max(
        0,
        roundMoney(
          entry.principal > 0
            ? entry.principal
            : balanceReduction > 0
              ? balanceReduction
              : entry.paidAmount ?? 0
        )
      );
      const adjustmentInterest = Math.max(
        0,
        roundMoney(entry.interest)
      );
      const adjustmentAmount = Math.max(
        0,
        roundMoney(
          entry.paidAmount != null
            ? entry.paidAmount
            : entry.emi > 0
              ? entry.emi
              : adjustmentPrincipal + adjustmentInterest
        )
      );

      principalPaid += adjustmentPrincipal;
      interestPaid += adjustmentInterest;
      totalPaid += adjustmentAmount > 0
        ? adjustmentAmount
        : adjustmentPrincipal + adjustmentInterest;
    }
  }

  principalPaid = roundMoney(Math.max(0, principalPaid));
  interestPaid = roundMoney(Math.max(0, interestPaid));
  totalPaid = roundMoney(Math.max(0, totalPaid));
  currentOutstanding = roundMoney(Math.max(0, currentOutstanding));

  return {
    originalPrincipal,
    principalPaid,
    interestPaid,
    totalPaid,
    currentOutstanding,
    principalPaidPercent:
      originalPrincipal > 0
        ? roundMoney(Math.min(100, (principalPaid / originalPrincipal) * 100))
        : 0,
  };
}

/** Backward-compatible outstanding-only summary. */
export function getAuthoritativeOutstandingSummary(
  loan: Loan,
  entries: AmortizationEntry[]
): {
  originalPrincipal: number;
  principalRepaid: number;
  currentOutstanding: number;
} {
  const metrics = calculateAuthoritativeLoanMetrics(loan, entries);

  return {
    originalPrincipal: metrics.originalPrincipal,
    principalRepaid: metrics.principalPaid,
    currentOutstanding: metrics.currentOutstanding,
  };
}
