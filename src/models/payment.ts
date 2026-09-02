export type PaymentStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'MISSED'
  | 'PREPAYMENT';

export interface Payment {
  id?: string;

  loanId: string;

  installmentNo?: number;

  paymentDate: string;

  amount: number;

  principal: number;

  interest: number;

  status: PaymentStatus;

  notes?: string;

  createdAt?: unknown;
}