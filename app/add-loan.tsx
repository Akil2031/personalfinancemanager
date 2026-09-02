import React from 'react';

import {
  useRouter,
} from 'expo-router';

import AddLoanScreen from '../src/screens/AddLoanScreen';

export default function AddLoanRoute() {
  const router =
    useRouter();

  return (
    <AddLoanScreen
      onSaved={() =>
        router.replace(
          '/loans' as any
        )
      }
      onCancel={() =>
        router.back()
      }
    />
  );
}