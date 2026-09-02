import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';

import { Payment } from '../models/payment';

const paymentsCollection =
  collection(
    db,
    'payments'
  );

/*
 * =====================================================
 * CREATE
 * =====================================================
 */

export async function addPayment(
  payment: Payment
): Promise<string> {

  if (!payment.loanId) {
    throw new Error(
      'Please select a loan.'
    );
  }

  if (!payment.paymentDate) {
    throw new Error(
      'Payment date is required.'
    );
  }

  const amount =
    Number(payment.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Payment amount must be greater than zero.'
    );
  }

  const data = {
    loanId:
      payment.loanId,

    installmentNo:
      payment.installmentNo ??
      null,

    paymentDate:
      payment.paymentDate,

    amount:
      Math.round(amount),

    principal:
      Math.round(
        Number(
          payment.principal || 0
        )
      ),

    interest:
      Math.round(
        Number(
          payment.interest || 0
        )
      ),

    status:
      payment.status,

    notes:
      payment.notes?.trim() ||
      '',

    createdAt:
      new Date().toISOString(),
  };

  const docRef =
    await addDoc(
      paymentsCollection,
      data
    );

  console.log(
    '[Payment] Created:',
    docRef.id
  );

  return docRef.id;
}


/*
 * =====================================================
 * READ - ONE LOAN
 * =====================================================
 */

export async function getLoanPayments(
  loanId: string
): Promise<Payment[]> {

  if (!loanId) {
    throw new Error(
      'Loan ID is required.'
    );
  }

  const q =
    query(
      paymentsCollection,

      where(
        'loanId',
        '==',
        loanId
      ),

      orderBy(
        'paymentDate',
        'desc'
      )
    );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...(item.data() as Payment),
    })
  );
}


/*
 * =====================================================
 * READ - ALL
 * =====================================================
 */

export async function getAllPayments(): Promise<
  Payment[]
> {

  const q =
    query(
      paymentsCollection,

      orderBy(
        'paymentDate',
        'desc'
      )
    );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    item => ({
      id: item.id,
      ...(item.data() as Payment),
    })
  );
}


/*
 * =====================================================
 * UPDATE
 * =====================================================
 */

export async function updatePayment(
  paymentId: string,
  payment: Payment
): Promise<void> {

  if (!paymentId) {
    throw new Error(
      'Payment ID is required.'
    );
  }

  if (!payment.loanId) {
    throw new Error(
      'Please select a loan.'
    );
  }

  if (!payment.paymentDate) {
    throw new Error(
      'Payment date is required.'
    );
  }

  const amount =
    Number(payment.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Payment amount must be greater than zero.'
    );
  }

  const paymentRef =
    doc(
      db,
      'payments',
      paymentId
    );

  await updateDoc(
    paymentRef,
    {
      loanId:
        payment.loanId,

      installmentNo:
        payment.installmentNo ??
        null,

      paymentDate:
        payment.paymentDate,

      amount:
        Math.round(amount),

      principal:
        Math.round(
          Number(
            payment.principal || 0
          )
        ),

      interest:
        Math.round(
          Number(
            payment.interest || 0
          )
        ),

      status:
        payment.status,

      notes:
        payment.notes?.trim() ||
        '',
    }
  );

  console.log(
    '[Payment] Updated:',
    paymentId
  );
}


/*
 * =====================================================
 * DELETE
 * =====================================================
 */

export async function deletePayment(
  paymentId: string
): Promise<void> {

  if (!paymentId) {
    throw new Error(
      'Payment ID is required.'
    );
  }

  const paymentRef =
    doc(
      db,
      'payments',
      paymentId
    );

  await deleteDoc(
    paymentRef
  );

  console.log(
    '[Payment] Deleted:',
    paymentId
  );
}