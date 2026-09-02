import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useRouter,
} from 'expo-router';


import {
  getDashboardSummary,
} from '../src/services/dashboardService';

import {
  getDebtFreeTarget,
  saveDebtFreeTarget,
} from '../src/services/debtFreeTargetService';

import {
  getAllPayments,
} from '../src/services/paymentService';

import {
  calculateTargetPerformance,
} from '../src/engine/targetPerformance';

function formatCurrency(
  value: number
): string {

  return `₹${Math.round(
    Number(value) || 0
  ).toLocaleString('en-IN')}`;
}


function formatDateInput(
  date: Date
): string {

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


function formatDate(
  value?: string | Date | null
): string {

  if (!value) {
    return '-';
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '-';
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}


export default function DebtFreeTargetScreen() {

  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    targetDate,
    setTargetDate,
  ] = useState('');

  const [
    summary,
    setSummary,
  ] = useState<any>(null);

  const [
    payments,
    setPayments,
  ] = useState<any[]>([]);


  /*
   * =====================================================
   * LOAD
   * =====================================================
   */

  useEffect(() => {
    void loadData();
  }, []);


  async function loadData() {

    try {

      const [
        dashboard,
        target,
        paymentList,
      ] =
        await Promise.all([
          getDashboardSummary(),
          getDebtFreeTarget(),
          getAllPayments(),
        ]);

      setSummary(
        dashboard
      );

      setPayments(
        paymentList || []
      );

      if (
        target?.targetDate
      ) {

        setTargetDate(
          target.targetDate
        );

      } else {

        /*
         * Default to 5 years from today.
         *
         * This is only a convenience.
         * The user can change it.
         */
        const date =
          new Date();

        date.setFullYear(
          date.getFullYear() + 5
        );

        setTargetDate(
          formatDateInput(date)
        );
      }

    } catch (error) {

      console.error(
        'Debt-free target loading failed:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to load debt-free target.'
      );

    } finally {

      setLoading(false);
    }
  }


  /*
   * =====================================================
   * LIVE CALCULATION
   * =====================================================
   */

  const performance =
    useMemo(() => {

      if (
        !summary ||
        !targetDate
      ) {
        return null;
      }

      const target =
        new Date(
          `${targetDate}T00:00:00`
        );

      if (
        Number.isNaN(
          target.getTime()
        )
      ) {
        return null;
      }

      const loans =
        summary.loans?.map(
          (item: any) =>
            item.loan
        ) || [];

      return calculateTargetPerformance(
        loans,
        target,
        payments
      );

    }, [
      summary,
      targetDate,
      payments,
    ]);


  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function handleSave() {

    const target =
      new Date(
        `${targetDate}T00:00:00`
      );

    if (
      Number.isNaN(
        target.getTime()
      )
    ) {

      Alert.alert(
        'Validation',
        'Please enter a valid target date.'
      );

      return;
    }

    if (
      target <=
      new Date()
    ) {

      Alert.alert(
        'Validation',
        'Target date must be in the future.'
      );

      return;
    }

    const outstanding =
      Number(
        performance?.currentOutstanding ||
        summary?.totalOutstanding ||
        0
      );

    if (
      outstanding <= 0
    ) {

      Alert.alert(
        'Validation',
        'There is no outstanding loan balance.'
      );

      return;
    }

    try {

      setSaving(true);

      /*
       * IMPORTANT:
       *
       * We save the calculated value only
       * as a snapshot for reference.
       *
       * The application does NOT depend
       * on this stored value.
       *
       * Every time the dashboard/screen
       * loads, the value is recalculated
       * from the actual loan balances.
       */

      await saveDebtFreeTarget({

        targetDate:
          formatDateInput(target),

        baselineOutstanding:
          outstanding,

        baselineDate:
          formatDateInput(
            new Date()
          ),

        additionalMonthlyPayment:
          Math.round(
            performance
              ?.requiredAdditionalPrincipal ||
            0
          ),
      });

      Alert.alert(
        'Target Saved',
        'Your debt-free target has been saved.'
      );

      router.back();

    } catch (error) {

      console.error(
        'Saving debt-free target failed:',
        error
      );

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to save debt-free target.'
      );

    } finally {

      setSaving(false);
    }
  }


  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {

    return (
     

        <View
          style={styles.loading}
        >

          <ActivityIndicator
            size="large"
          />

          <Text
            style={styles.loadingText}
          >
            Loading debt-free target...
          </Text>

        </View>

    
    );
  }


  /*
   * =====================================================
   * SCREEN
   * =====================================================
   */

  return (
    

      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >

        {/* HEADER */}

        <View
          style={styles.header}
        >

          <View>

            <Text
              style={styles.title}
            >
              🎯 Debt-Free Target
            </Text>

            <Text
              style={styles.subtitle}
            >
              Set the date. The system calculates
              the extra principal automatically.
            </Text>

          </View>

        </View>


        {/* TARGET DATE */}

        <View
          style={styles.card}
        >

          <Text
            style={styles.cardTitle}
          >
            Target Date
          </Text>

          <Text
            style={styles.label}
          >
            I want to be completely debt-free by
          </Text>

          <TextInput
            value={targetDate}
            onChangeText={
              setTargetDate
            }
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9AA49E"
            style={styles.input}
            keyboardType="numbers-and-punctuation"
          />

          <Text
            style={styles.helper}
          >
            Enter the date in YYYY-MM-DD format.
          </Text>

        </View>


        {/* CURRENT POSITION */}

        <View
          style={styles.card}
        >

          <Text
            style={styles.cardTitle}
          >
            Current Position
          </Text>

          <View
            style={styles.grid}
          >

            <View
              style={styles.metric}
            >

              <Text
                style={styles.metricLabel}
              >
                Current Outstanding
              </Text>

              <Text
                style={styles.metricValue}
              >
                {formatCurrency(
                  performance
                    ?.currentOutstanding ||
                  summary?.totalOutstanding ||
                  0
                )}
              </Text>

            </View>


            <View
              style={styles.metric}
            >

              <Text
                style={styles.metricLabel}
              >
                Monthly EMI
              </Text>

              <Text
                style={styles.metricValue}
              >
                {formatCurrency(
                  performance
                    ?.currentMonthlyEMI ||
                  summary?.totalMonthlyEMI ||
                  0
                )}
              </Text>

            </View>

          </View>

        </View>


        {/* MAIN CALCULATION */}

        {performance && (

          <View
            style={styles.mainCard}
          >

            <Text
              style={styles.mainTitle}
            >
              Required Additional Principal
            </Text>

            <Text
              style={styles.mainAmount}
            >
              {formatCurrency(
                performance
                  .requiredAdditionalPrincipal
              )}
            </Text>

            <Text
              style={styles.mainDescription}
            >
              This is the EXTRA principal you need
              to pay every month above your normal EMI
              to reach your selected debt-free date.
            </Text>


            <View
              style={styles.divider}
            />


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Normal EMI
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatCurrency(
                  performance
                    .currentMonthlyEMI
                )}
              </Text>

            </View>


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Additional Principal
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatCurrency(
                  performance
                    .requiredAdditionalPrincipal
                )}
              </Text>

            </View>


            <View
              style={[
                styles.row,
                styles.totalRow,
              ]}
            >

              <Text
                style={styles.totalLabel}
              >
                Total Monthly Payment
              </Text>

              <Text
                style={styles.totalValue}
              >
                {formatCurrency(
                  performance
                    .requiredTotalMonthlyPayment
                )}
              </Text>

            </View>

          </View>
        )}


        {/* THIS MONTH */}

        {performance && (

          <View
            style={styles.card}
          >

            <Text
              style={styles.cardTitle}
            >
              This Month's Target
            </Text>


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Additional Principal Required
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatCurrency(
                  performance
                    .requiredAdditionalPrincipal
                )}
              </Text>

            </View>


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Additional Principal Paid
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatCurrency(
                  performance
                    .additionalPrincipalPaidThisMonth
                )}
              </Text>

            </View>


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Remaining
              </Text>

              <Text
                style={[
                  styles.rowValue,
                  performance
                    .additionalPrincipalRemainingThisMonth >
                    0
                    ? styles.danger
                    : styles.success,
                ]}
              >
                {formatCurrency(
                  performance
                    .additionalPrincipalRemainingThisMonth
                )}
              </Text>

            </View>


            <View
              style={styles.progressTrack}
            >

              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${performance
                        .additionalPrincipalProgressPercent}%`,
                  },
                ]}
              />

            </View>


            <Text
              style={styles.progressText}
            >
              {performance
                .additionalPrincipalProgressPercent
                .toFixed(0)}%
              {' '}of this month's additional
              principal target paid
            </Text>

          </View>
        )}


        {/* PROJECTION */}

        {performance && (

          <View
            style={styles.card}
          >

            <Text
              style={styles.cardTitle}
            >
              Projection
            </Text>

            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Target Date
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatDate(
                  performance.targetDate
                )}
              </Text>

            </View>


            <View
              style={styles.row}
            >

              <Text
                style={styles.rowLabel}
              >
                Projected Debt-Free Date
              </Text>

              <Text
                style={styles.rowValue}
              >
                {formatDate(
                  performance
                    .projectedDebtFreeDate
                )}
              </Text>

            </View>


            <View
              style={styles.statusBox}
            >

              <Text
                style={styles.statusText}
              >
                {
                  performance.status ===
                  'AHEAD'
                    ? '🟢 AHEAD OF TARGET'
                    : performance.status ===
                      'ON_TRACK'
                    ? '🔵 ON TRACK'
                    : '🔴 BEHIND TARGET'
                }
              </Text>

            </View>

          </View>
        )}


        {/* SAVE */}

        <Pressable
          onPress={
            handleSave
          }
          disabled={
            saving
          }
          style={[
            styles.saveButton,
            saving &&
              styles.saveButtonDisabled,
          ]}
        >

          <Text
            style={styles.saveButtonText}
          >
            {saving
              ? 'Saving...'
              : 'Save Debt-Free Target'}
          </Text>

        </Pressable>

      </ScrollView>

   
  );
}


/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({

    content: {
      width: '100%',
      maxWidth: 900,
      alignSelf: 'center',
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 50,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 10,
      color: '#728078',
    },

    header: {
      marginBottom: 22,
    },

    title: {
      fontSize: 31,
      fontWeight: '800',
      color: '#17221B',
    },

    subtitle: {
      marginTop: 5,
      fontSize: 13,
      color: '#728078',
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#DFE8E2',
      padding: 20,
      marginBottom: 16,
    },

    mainCard: {
      backgroundColor: '#EFFAF2',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#B9E6C8',
      padding: 24,
      marginBottom: 16,
      alignItems: 'center',
    },

    cardTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: '#17221B',
      marginBottom: 16,
    },

    label: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6D7A72',
      marginBottom: 8,
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor: '#D6E0D9',
      borderRadius: 9,
      paddingHorizontal: 14,
      fontSize: 16,
      color: '#17221B',
      backgroundColor: '#FFFFFF',
    },

    helper: {
      marginTop: 7,
      fontSize: 11,
      color: '#89948D',
    },

    grid: {
      flexDirection: 'row',
      gap: 14,
    },

    metric: {
      flex: 1,
    },

    metricLabel: {
      fontSize: 11,
      color: '#6D7A72',
      fontWeight: '600',
    },

    metricValue: {
      marginTop: 6,
      fontSize: 22,
      fontWeight: '800',
      color: '#17221B',
    },

    mainTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#42634D',
      textAlign: 'center',
    },

    mainAmount: {
      marginTop: 8,
      fontSize: 40,
      fontWeight: '900',
      color: '#16803A',
    },

    mainDescription: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 18,
      color: '#5F6D64',
      textAlign: 'center',
      maxWidth: 600,
    },

    divider: {
      width: '100%',
      height: 1,
      backgroundColor: '#D8E8DD',
      marginVertical: 18,
    },

    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 9,
    },

    rowLabel: {
      flex: 1,
      fontSize: 12,
      color: '#6D7A72',
      fontWeight: '600',
    },

    rowValue: {
      fontSize: 14,
      fontWeight: '800',
      color: '#17221B',
      textAlign: 'right',
    },

    totalRow: {
      borderTopWidth: 1,
      borderTopColor: '#D8E8DD',
      marginTop: 6,
      paddingTop: 14,
    },

    totalLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      color: '#17221B',
    },

    totalValue: {
      fontSize: 18,
      fontWeight: '900',
      color: '#16803A',
    },

    progressTrack: {
      height: 9,
      borderRadius: 5,
      backgroundColor: '#E3EAE5',
      overflow: 'hidden',
      marginTop: 12,
    },

    progressFill: {
      height: '100%',
      backgroundColor: '#16803A',
      borderRadius: 5,
    },

    progressText: {
      marginTop: 8,
      fontSize: 11,
      color: '#728078',
      textAlign: 'center',
    },

    statusBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 9,
      backgroundColor: '#F1F5F2',
      alignItems: 'center',
    },

    statusText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#3F5147',
    },

    danger: {
      color: '#C0392B',
    },

    success: {
      color: '#16803A',
    },

    saveButton: {
      height: 50,
      borderRadius: 10,
      backgroundColor: '#16803A',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },

    saveButtonDisabled: {
      opacity: 0.6,
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

  });