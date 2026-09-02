import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';

import {
  DebtFreeTarget,
} from '../models/debtFreeTarget';


const targetsCollection =
  collection(
    db,
    'debtFreeTargets'
  );


function todayKey(): string {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function cleanTargetData(
  target: DebtFreeTarget
) {
  return {
    targetDate:
      target.targetDate
        .substring(0, 10),

    baselineOutstanding:
      Number(
        target.baselineOutstanding
      ) || 0,

    baselineDate:
      target.baselineDate
        .substring(0, 10),

    additionalMonthlyPayment:
      Number(
        target.additionalMonthlyPayment
      ) || 0,
  };
}


/*
 * =====================================================
 * GET CURRENT TARGET
 * =====================================================
 *
 * We maintain one active debt-free target.
 *
 * The newest target is returned.
 */
export async function getDebtFreeTarget():
  Promise<DebtFreeTarget | null> {

  const q =
    query(
      targetsCollection,
      orderBy(
        'createdAt',
        'desc'
      ),
      limit(1)
    );

  const snapshot =
    await getDocs(q);

  if (
    snapshot.empty
  ) {
    return null;
  }

  const item =
    snapshot.docs[0];

  return {
    id: item.id,
    ...(item.data() as DebtFreeTarget),
  };
}


/*
 * =====================================================
 * CREATE TARGET
 * =====================================================
 */
export async function createDebtFreeTarget(
  target: DebtFreeTarget
): Promise<string> {

  validateTarget(
    target
  );

  const now =
    new Date().toISOString();

  const data = {
    ...cleanTargetData(
      target
    ),

    createdAt:
      now,

    updatedAt:
      now,
  };

  const ref =
    await addDoc(
      targetsCollection,
      data
    );

  return ref.id;
}


/*
 * =====================================================
 * UPDATE TARGET
 * =====================================================
 */
export async function updateDebtFreeTarget(
  id: string,
  changes: Partial<DebtFreeTarget>
): Promise<void> {

  if (!id) {
    throw new Error(
      'Debt-free target ID is required.'
    );
  }

  const data:
    Record<string, unknown> = {};

  if (
    changes.targetDate !==
    undefined
  ) {
    data.targetDate =
      changes.targetDate
        .substring(0, 10);
  }

  if (
    changes.baselineOutstanding !==
    undefined
  ) {
    data.baselineOutstanding =
      Number(
        changes.baselineOutstanding
      ) || 0;
  }

  if (
    changes.baselineDate !==
    undefined
  ) {
    data.baselineDate =
      changes.baselineDate
        .substring(0, 10);
  }

  if (
    changes.additionalMonthlyPayment !==
    undefined
  ) {
    data.additionalMonthlyPayment =
      Number(
        changes.additionalMonthlyPayment
      ) || 0;
  }

  data.updatedAt =
    new Date().toISOString();

  await updateDoc(
    doc(
      db,
      'debtFreeTargets',
      id
    ),
    data
  );
}


/*
 * =====================================================
 * SAVE TARGET
 * =====================================================
 *
 * Convenience function:
 *
 * - Updates existing target
 * - Creates one if none exists
 */
export async function saveDebtFreeTarget(
  target: DebtFreeTarget
): Promise<string> {

  validateTarget(
    target
  );

  const existing =
    await getDebtFreeTarget();

  if (
    existing?.id
  ) {

    await updateDebtFreeTarget(
      existing.id,
      target
    );

    return existing.id;
  }

  return createDebtFreeTarget(
    target
  );
}


/*
 * =====================================================
 * DELETE TARGET
 * =====================================================
 */
export async function deleteDebtFreeTarget(
  id: string
): Promise<void> {

  if (!id) {
    throw new Error(
      'Debt-free target ID is required.'
    );
  }

  await deleteDoc(
    doc(
      db,
      'debtFreeTargets',
      id
    )
  );
}


/*
 * =====================================================
 * VALIDATION
 * =====================================================
 */
function validateTarget(
  target: DebtFreeTarget
) {

  if (
    !target.targetDate
  ) {
    throw new Error(
      'Target date is required.'
    );
  }

  const targetDate =
    new Date(
      target.targetDate
    );

  if (
    Number.isNaN(
      targetDate.getTime()
    )
  ) {
    throw new Error(
      'Invalid target date.'
    );
  }

  if (
    Number(
      target.baselineOutstanding
    ) <= 0
  ) {
    throw new Error(
      'Outstanding amount must be greater than zero.'
    );
  }

  if (
    !target.baselineDate
  ) {
    throw new Error(
      'Baseline date is required.'
    );
  }

  if (
    Number(
      target.additionalMonthlyPayment
    ) < 0
  ) {
    throw new Error(
      'Additional monthly payment cannot be negative.'
    );
  }
}