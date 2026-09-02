import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AppShell from '../components/AppShell';

import {
  Loan,
} from '../models/loan';

import {
  DebtFreeTarget,
} from '../models/target';

import {
  analyzeDebtFreeTarget,
} from '../engine/debtForecast';

import {
  getLoans,
} from '../services/loanService';

import {
  getDebtFreeTarget,
  saveDebtFreeTarget,
} from '../services/targetService';

export default function DebtFreeTargetScreen() {
  const [
    loans,
    setLoans,
  ] = useState<Loan[]>([]);

  const [
    target,
    setTarget,
  ] =
    useState<DebtFreeTarget | null>(
      null
    );

  const [
    targetDate,
    setTargetDate,
  ] = useState('');

  const [
    extraPayment,
    setExtraPayment,
  ] = useState('0');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const loadData =
    async () => {
      try {
        const [
          loanData,
          targetData,
        ] = await Promise.all([
          getLoans(),
          getDebtFreeTarget(),
        ]);

        setLoans(loanData);
        setTarget(targetData);

        if (targetData) {
          setTargetDate(
            targetData.targetDate
          );

          setExtraPayment(
            String(
              targetData.extraMonthlyPayment ||
                0
            )
          );
        }

      } catch (error) {
        console.error(
          'Target loading failed:',
          error
        );

        Alert.alert(
          'Error',
          'Unable to load target information.'
        );

      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadData();
  }, []);

  const activeLoans =
    loans.filter(
      (loan) =>
        loan.status === 'ACTIVE'
    );

  let analysis = null;

  if (
    targetDate &&
    activeLoans.length > 0
  ) {
    const parsedDate =
      new Date(targetDate);

    if (
      !Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      analysis =
        analyzeDebtFreeTarget(
          activeLoans,
          parsedDate
        );
    }
  }

  async function handleSave() {
    try {
      if (!targetDate) {
        Alert.alert(
          'Target Required',
          'Please enter your debt-free target date.'
        );
        return;
      }

      const parsedDate =
        new Date(targetDate);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        Alert.alert(
          'Invalid Date',
          'Use YYYY-MM-DD format.'
        );
        return;
      }

      setSaving(true);

      const currentOutstanding =
  activeLoans.reduce(
    (sum, loan) =>
      sum +
      Number(
        loan.currentOutstanding || 0
      ),
    0
  );

await saveDebtFreeTarget({
  id: target?.id,

  targetDate,

  strategy:
    Number(extraPayment) > 0
      ? 'EMI_PLUS_EXTRA'
      : 'EMI_ONLY',

  extraMonthlyPayment:
    Number(extraPayment) || 0,

  /*
   * IMPORTANT:
   *
   * When an existing target is edited,
   * preserve the original baseline.
   *
   * We don't want changing the target date
   * to reset the user's historical progress.
   */
  baselineOutstanding:
    target?.baselineOutstanding ??
    currentOutstanding,

  baselineDate:
    target?.baselineDate ??
    new Date().toISOString(),

  createdAt:
    target?.createdAt,
});

      Alert.alert(
        'Target Saved',
        'Your debt-free target has been saved.'
      );

      await loadData();

    } catch (error) {
      console.error(
        'Target save failed:',
        error
      );

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to save target.'
      );

    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading target...
          </Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
      >
        <Text style={styles.title}>
          Debt-Free Target
        </Text>

        <Text style={styles.subtitle}>
          Decide when you want to become debt-free.
        </Text>

        <View style={styles.card}>

          <Text style={styles.label}>
            Target Debt-Free Date
          </Text>

          <TextInput
            style={styles.input}
            value={targetDate}
            onChangeText={
              setTargetDate
            }
            placeholder="2030-12-31"
          />

          <Text style={styles.helper}>
            Use YYYY-MM-DD format
          </Text>

          <Text style={styles.label}>
            Planned Extra Monthly Payment
          </Text>

          <TextInput
            style={styles.input}
            value={extraPayment}
            onChangeText={
              setExtraPayment
            }
            keyboardType="numeric"
            placeholder="0"
          />

          <Text style={styles.helper}>
            Optional. The system will also calculate
            the amount required to reach your target.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving
                ? 'Saving...'
                : 'Save Target'}
            </Text>
          </TouchableOpacity>

        </View>

        {activeLoans.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              No Active Loans
            </Text>

            <Text style={styles.helper}>
              Add an active loan before setting a
              debt-free target.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>

              <Text style={styles.cardTitle}>
                Current Position
              </Text>

              <Metric
                label="Outstanding Debt"
                value={formatCurrency(
                  activeLoans.reduce(
                    (sum, loan) =>
                      sum +
                      Number(
                        loan.currentOutstanding ||
                          0
                      ),
                    0
                  )
                )}
              />

              <Metric
                label="Monthly EMI"
                value={formatCurrency(
                  activeLoans.reduce(
                    (sum, loan) =>
                      sum +
                      Number(
                        loan.emi || 0
                      ),
                    0
                  )
                )}
              />

            </View>

            {analysis && (
              <View style={styles.card}>

                <Text style={styles.cardTitle}>
                  Your Debt-Free Projection
                </Text>

                <View
                  style={[
                    styles.statusBox,
                    analysis.status ===
                      'AHEAD'
                      ? styles.statusAhead
                      : analysis.status ===
                        'ON_TRACK'
                      ? styles.statusTrack
                      : styles.statusBehind,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {analysis.status ===
                      'AHEAD'
                      ? 'AHEAD OF TARGET'
                      : analysis.status ===
                        'ON_TRACK'
                      ? 'ON TRACK'
                      : 'BEHIND TARGET'}
                  </Text>
                </View>

                <Metric
                  label="Current projected debt-free date"
                  value={
                    analysis
                      .currentProjection
                      .debtFreeDate
                      ? formatDate(
                          analysis
                            .currentProjection
                            .debtFreeDate
                        )
                      : 'Unable to project'
                  }
                />

                <Metric
                  label="Target date"
                  value={formatDate(
                    analysis.targetDate
                  )}
                />

                <Metric
                  label="Additional monthly amount required"
                  value={formatCurrency(
                    analysis.requiredExtraMonthlyPayment
                  )}
                />

                {analysis.status ===
                  'BEHIND' && (
                  <View
                    style={styles.recommendation}
                  >
                    <Text
                      style={
                        styles.recommendationTitle
                      }
                    >
                      What this means
                    </Text>

                    <Text
                      style={
                        styles.recommendationText
                      }
                    >
                      Based on your current loan
                      balances and EMI commitments,
                      you need approximately{' '}
                      {formatCurrency(
                        analysis.requiredExtraMonthlyPayment
                      )}{' '}
                      additional principal reduction
                      per month to reach your target.
                    </Text>
                  </View>
                )}

                {analysis.status ===
                  'AHEAD' && (
                  <View
                    style={styles.recommendation}
                  >
                    <Text
                      style={
                        styles.recommendationTitle
                      }
                    >
                      You're ahead
                    </Text>

                    <Text
                      style={
                        styles.recommendationText
                      }
                    >
                      Your current EMI trajectory
                      projects debt freedom before
                      your selected target date.
                    </Text>
                  </View>
                )}

              </View>
            )}
          </>
        )}

      </ScrollView>
    </AppShell>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    value
  ).toLocaleString('en-IN')}`;
}

function formatDate(
  value: Date
): string {
  return value.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    padding: 28,
    paddingBottom: 60,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 5,
    color: '#6B7280',
  },

  card: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
  },

  label: {
    marginTop: 14,
    marginBottom: 7,
    fontWeight: '600',
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 9,
    padding: 13,
    fontSize: 16,
  },

  helper: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },

  button: {
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: '#111827',
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  metric: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  metricLabel: {
    color: '#6B7280',
    fontSize: 13,
  },

  metricValue: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: '700',
  },

  statusBox: {
    padding: 13,
    borderRadius: 9,
    marginBottom: 10,
  },

  statusAhead: {
    backgroundColor: '#E8F5E9',
  },

  statusTrack: {
    backgroundColor: '#E8F0FE',
  },

  statusBehind: {
    backgroundColor: '#FFF3E0',
  },

  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },

  recommendation: {
    marginTop: 18,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#F5F7FA',
  },

  recommendationTitle: {
    fontWeight: '700',
  },

  recommendationText: {
    marginTop: 7,
    color: '#4B5563',
    lineHeight: 21,
  },
});