import {
  EMIScheduleRow,
} from './emiCalculator';

export interface PaymentAllocation {
  amount: number;
  interest: number;
  principal: number;
}

export function allocatePayment(
  amount: number,
  scheduled: EMIScheduleRow
): PaymentAllocation {
  if (amount <= 0) {
    throw new Error(
      'Payment amount must be greater than zero.'
    );
  }

  /*
   * Interest is satisfied first.
   * Remaining amount reduces principal.
   */

  const interest = Math.min(
    amount,
    scheduled.interest
  );

  const principal = Math.min(
    Math.max(0, amount - interest),
    scheduled.openingBalance
  );

  return {
    amount,
    interest,
    principal,
  };
}