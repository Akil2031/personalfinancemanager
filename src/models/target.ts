export type TargetStrategy =
  | 'EMI_ONLY'
  | 'EMI_PLUS_EXTRA';

export interface DebtFreeTarget {
  id?: string;

  targetDate: string;

  strategy: TargetStrategy;

  extraMonthlyPayment: number;

  // Debt position when the target was created.
  baselineOutstanding: number;

  // Date from which target performance is measured.
  baselineDate: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}