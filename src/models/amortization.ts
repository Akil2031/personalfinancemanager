export type AmortizationStatus =
  | 'SCHEDULED'
  | 'UPCOMING'
  | 'PAID'
  | 'UNPAID'
  | 'PARTIAL'
  | 'PREPAYMENT'
  | 'ADJUSTED';

export type AmortizationSource =
  | 'CALCULATED'
  | 'BANK'
  | 'MANUAL';

export type AmortizationEntryType =
  | 'EMI'
  | 'PART_PREPAYMENT'
  | 'PREPAYMENT'
  | 'ADJUSTMENT';

export type AmortizationStatusSource = 'AUTO' | 'MANUAL';

export interface AmortizationEntry {
  id?: string;
  loanId: string;
  sequenceNo: number;
  installmentNo?: number;
  dueDate: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
  status: AmortizationStatus;
  statusSource?: AmortizationStatusSource;
  paidDate?: string;
  paidAmount?: number;
  entryType: AmortizationEntryType;
  source: AmortizationSource;
  isManuallyAdjusted?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AmortizationEntryInput {
  sequenceNo?: number;
  installmentNo?: number;
  dueDate: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
  status?: AmortizationStatus;
  statusSource?: AmortizationStatusSource;
  paidDate?: string;
  paidAmount?: number;
  source?: AmortizationSource;
  entryType?: AmortizationEntryType;
  isManuallyAdjusted?: boolean;
  notes?: string;
}

export interface AmortizationValidationIssue {
  installmentNo: number;
  field: 'openingBalance' | 'emi' | 'closingBalance' | 'sequence' | 'dueDate';
  message: string;
}

export interface AmortizationValidationResult {
  valid: boolean;
  issues: AmortizationValidationIssue[];
}
