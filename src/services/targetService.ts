import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';

import {
  DebtFreeTarget,
} from '../models/target';

const TARGET_DOCUMENT = doc(
  db,
  'settings',
  'debtFreeTarget'
);

export async function getDebtFreeTarget(): Promise<
  DebtFreeTarget | null
> {
  const snapshot =
    await getDoc(TARGET_DOCUMENT);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as DebtFreeTarget),
  };
}

export async function saveDebtFreeTarget(
  target: DebtFreeTarget
): Promise<void> {
  const now =
    new Date().toISOString();

  const data = {
    targetDate: target.targetDate,

    strategy: target.strategy,

    extraMonthlyPayment:
      Number(
        target.extraMonthlyPayment || 0
      ),

    baselineOutstanding:
      Number(
        target.baselineOutstanding || 0
      ),

    baselineDate:
      target.baselineDate,

    createdAt:
      target.createdAt ?? now,

    updatedAt: now,
  };

  await setDoc(
    TARGET_DOCUMENT,
    data
  );
}