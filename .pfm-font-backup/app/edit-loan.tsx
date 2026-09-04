import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import AddLoanScreen from '../src/screens/AddLoanScreen';

import * as loanService from '../src/services/loanService';

import {
  Loan,
} from '../src/models/loan';

export default function EditLoanRoute() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const loanId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  const [loan, setLoan] =
    useState<Loan | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    loadLoan();
  }, [loanId]);

  async function loadLoan() {
    if (!loanId) {
      setError(
        'Loan ID is missing.'
      );

      setLoading(false);

      return;
    }

    try {
      setLoading(true);
      setError('');

      const getLoan =
        (loanService as typeof loanService & {
          getLoan?: (id: string) => Promise<Loan | null>;
          getLoanById?: (id: string) => Promise<Loan | null>;
        }).getLoan ??
        (loanService as typeof loanService & {
          getLoanById?: (id: string) => Promise<Loan | null>;
        }).getLoanById;

      if (!getLoan) {
        throw new Error(
          'Loan lookup service is unavailable.'
        );
      }

      const result =
        await getLoan(
          loanId
        );

      if (!result) {
        setError(
          'The requested loan could not be found.'
        );

        return;
      }

      setLoan(result);
    } catch (error) {
      console.error(
        'Failed to load loan:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to load loan.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading loan details...
        </Text>
      </View>
    );
  }

  if (error || !loan) {
    return (
      <View
        style={
          styles.errorContainer
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Unable to open loan
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {error ||
            'Loan not found.'}
        </Text>

        <Text
          onPress={() =>
            router.back()
          }
          style={
            styles.backText
          }
        >
          â† Back to Loans
        </Text>
      </View>
    );
  }

  return (
    <AddLoanScreen
      loan={loan}
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

const styles =
  StyleSheet.create({

    loading: {
      flex: 1,
      backgroundColor:
        '#F4F8F5',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: '#68766E',
    },

    errorContainer: {
      flex: 1,
      backgroundColor:
        '#F4F8F5',
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 30,
    },

    errorTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#18231B',
    },

    errorText: {
      marginTop: 8,
      textAlign: 'center',
      fontSize: 13,
      color: '#6F7B74',
    },

    backText: {
      marginTop: 20,
      fontSize: 13,
      fontWeight: '700',
      color: '#16803A',
    },

  });
