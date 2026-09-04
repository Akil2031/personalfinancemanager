import { Loan } from "../models/loan";
import { Payment } from "../models/payment";
import { AmortizationEntry } from "../models/amortization";
import { generateLoanSchedule } from "../engine/loanSchedule";
import { getAmortizationSchedule, syncAutomaticEmiStatuses, calculateAuthoritativeLoanMetrics, AuthoritativeLoanMetrics } from "./amortizationService";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }
function day(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : new Date(v);
  const s = String(v).slice(0,10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function sameOrBefore(a: Date, b: Date): boolean {
  const x = new Date(a); x.setHours(0,0,0,0);
  const y = new Date(b); y.setHours(0,0,0,0);
  return x.getTime() <= y.getTime();
}

export interface LoanPositionMetrics extends AuthoritativeLoanMetrics {
  hasAuthoritativeSchedule: boolean;
  remainingMonths: number;
  nextEmiDate?: Date;
  lastEmiDate?: Date;
}

/**
 * Single entry point used by loan screens.
 * Persisted amortization is authoritative. If a loan has no persisted
 * schedule yet, we build a virtual schedule and use actual payment records
 * to calculate the current position without writing anything to Firestore.
 */
export async function getLoanPositionMetrics(
  loan: Loan,
  payments: Payment[] = [],
  asOfDate: Date = new Date()
): Promise<LoanPositionMetrics> {
  const originalPrincipal = Math.max(0, num(loan.originalPrincipal));

  // -----------------------------------------------------------------------
  // 1. PERSISTED LENDER SCHEDULE IS ALWAYS PREFERRED
  // -----------------------------------------------------------------------
  if (loan.id) {
    try {
      let entries = await getAmortizationSchedule(loan.id);

      if (entries.length > 0) {
        // Past EMI rows become PAID automatically unless the user manually
        // changed their status. This is the source of truth for the loan.
        entries = await syncAutomaticEmiStatuses(loan.id, asOfDate);

        const metrics = calculateAuthoritativeLoanMetrics(loan, entries, asOfDate);
        const today = new Date(asOfDate);
        today.setHours(23, 59, 59, 999);

        const emiEntries = entries.filter(e => e.entryType === 'EMI');
        const futureEmi = emiEntries.filter(e => {
          const d = day(e.dueDate);
          return !!d && d.getTime() > today.getTime();
        });

        const last = entries.length
          ? day(entries[entries.length - 1].dueDate) ?? undefined
          : undefined;

        const firstFuture = futureEmi[0];

        return {
          ...metrics,
          hasAuthoritativeSchedule: true,
          remainingMonths: futureEmi.length,
          nextEmiDate: firstFuture ? day(firstFuture.dueDate) ?? undefined : undefined,
          lastEmiDate: last,
        };
      }
    } catch (error) {
      // A missing/temporarily unreadable amortization collection must NOT
      // cause the UI to silently fall back to the original loan amount.
      console.warn('[LoanMetrics] Amortization schedule unavailable; using calculated schedule.', error);
    }
  }

  // -----------------------------------------------------------------------
  // 2. NO PERSISTED SCHEDULE -> BUILD A VIRTUAL CALCULATED SCHEDULE
  // -----------------------------------------------------------------------
  // Do NOT call generateAdjustedLoanSchedule() here. That legacy engine can
  // itself depend on embedded payment state and can throw before the metrics
  // calculation starts. calculateEMI() gives us a clean, deterministic base.
  const calculated =
    loan.repaymentType === 'INTEREST_ONLY'
      ? null
      : generateLoanSchedule({
          ...loan,
          __actualPayments: undefined,
        } as Loan).schedule;

  const today = new Date(asOfDate);
  today.setHours(23, 59, 59, 999);

  // The application's agreed rule is that a past EMI is automatically
  // considered paid unless a persisted amortization row has a manual UNPAID
  // override. For a virtual schedule there is no manual override yet, so past
  // EMIs are treated as PAID.
  let principalPaid = 0;
  let interestPaid = 0;
  let totalPaid = 0;
  let paidInstallments = 0;

  const paidInstallmentsSet = new Set<number>();

  if (calculated) {
    for (const row of calculated) {
      const due = day(row.dueDate);
      if (!due || due.getTime() > today.getTime()) continue;

      const principal = Math.max(0, num(row.principal));
      const interest = Math.max(0, num(row.interest));
      const emi = Math.max(0, num(row.emi));

      principalPaid += principal;
      interestPaid += interest;
      totalPaid += emi;
      paidInstallmentsSet.add(num(row.installmentNo));
    }

    paidInstallments = paidInstallmentsSet.size;
  }

  // Apply explicit prepayments and any actual payment that is not already
  // represented by an automatically-paid calculated EMI. This prevents the
  // same EMI being counted twice.
  for (const payment of payments) {
    const pd = day(payment.paymentDate);
    if (pd && pd.getTime() > today.getTime()) continue;
    if (String(payment.status || '').toUpperCase() !== 'PAID' &&
        String(payment.status || '').toUpperCase() !== 'PREPAYMENT') continue;

    const installmentNo = num(payment.installmentNo);
    const isAlreadyAutoPaidEmi =
      installmentNo > 0 && paidInstallmentsSet.has(installmentNo) &&
      String(payment.status || '').toUpperCase() === 'PAID';

    if (isAlreadyAutoPaidEmi) continue;

    let principal = Math.max(0, num(payment.principal));
    let interest = Math.max(0, num(payment.interest));
    const amount = Math.max(0, num(payment.amount));

    // Older prepayment records may only contain amount.
    if (principal <= 0 && String(payment.status || '').toUpperCase() === 'PREPAYMENT') {
      principal = amount;
    }

    // Older normal EMI payment records may only contain amount. Match the
    // amount to the calculated installment and use its principal/interest
    // split.
    if (principal <= 0 && interest <= 0 && amount > 0 && calculated) {
      const row = installmentNo > 0
        ? calculated.find(r => num(r.installmentNo) === installmentNo)
        : pd
          ? calculated.find(r => {
              const d = day(r.dueDate);
              return !!d && d.getTime() === pd.getTime();
            })
          : undefined;

      if (row && Math.abs(num(row.emi) - amount) <= 1) {
        principal = num(row.principal);
        interest = num(row.interest);
      }
    }

    principalPaid += principal;
    interestPaid += interest;
    totalPaid += amount > 0 ? amount : principal + interest;
  }

  principalPaid = money(Math.min(originalPrincipal, principalPaid));
  interestPaid = money(interestPaid);
  totalPaid = money(totalPaid);

  const currentOutstanding = money(
    Math.max(0, originalPrincipal - principalPaid)
  );

  const future = calculated
    ? calculated.filter(r => {
        const d = day(r.dueDate);
        return !!d && d.getTime() > today.getTime();
      })
    : [];

  return {
    originalPrincipal,
    principalPaid,
    interestPaid,
    totalPaid,
    currentOutstanding,
    principalPaidPercent:
      originalPrincipal > 0
        ? money(Math.min(100, (principalPaid / originalPrincipal) * 100))
        : 0,
    hasAuthoritativeSchedule: false,
    remainingMonths: future.length,
    nextEmiDate: future[0]?.dueDate,
    lastEmiDate: calculated?.[calculated.length - 1]?.dueDate,
  };
}
