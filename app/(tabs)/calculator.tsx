import React, {
  useMemo,
  useState,
} from 'react';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';


import {
  calculateEMI,
} from '../../src/engine/emiCalculator';



type TenureMode =
  | 'YEARS'
  | 'MONTHS';

export default function CalculatorRoute() {
  /*
   * -------------------------------------------------------
   * INPUTS
   * -------------------------------------------------------
   */

  const [principal, setPrincipal] =
    useState('1000000');

  const [interestRate, setInterestRate] =
    useState('8.5');

  const [tenure, setTenure] =
    useState('20');

  const [tenureMode, setTenureMode] =
    useState<TenureMode>('YEARS');

  const [firstEmiDate, setFirstEmiDate] =
    useState(
      new Date()
        .toISOString()
        .substring(0, 10)
    );

  /*
   * -------------------------------------------------------
   * CALCULATE
   * -------------------------------------------------------
   */

  const calculation = useMemo(() => {
    const principalValue =
      Number(principal);

    const rateValue =
      Number(interestRate);

    const enteredTenure =
      Number(tenure);

    if (
      !Number.isFinite(
        principalValue
      ) ||
      principalValue <= 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(
        rateValue
      ) ||
      rateValue < 0
    ) {
      return null;
    }

    if (
      !Number.isFinite(
        enteredTenure
      ) ||
      enteredTenure <= 0
    ) {
      return null;
    }

    const tenureMonths =
      tenureMode === 'YEARS'
        ? Math.round(
            enteredTenure * 12
          )
        : Math.round(
            enteredTenure
          );

    if (
      tenureMonths <= 0
    ) {
      return null;
    }

    /*
     * Validate YYYY-MM-DD.
     */
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        firstEmiDate
      )
    ) {
      return null;
    }

    const [
      year,
      month,
      day,
    ] =
      firstEmiDate
        .split('-')
        .map(Number);

    const emiDate =
      new Date(
        year,
        month - 1,
        day
      );

    if (
      Number.isNaN(
        emiDate.getTime()
      )
    ) {
      return null;
    }

    /*
     * Prevent JavaScript date rollover.
     *
     * Example:
     * 2026-02-31 should not become March 3.
     */
    if (
      emiDate.getFullYear() !==
        year ||
      emiDate.getMonth() !==
        month - 1 ||
      emiDate.getDate() !==
        day
    ) {
      return null;
    }

    try {
      return calculateEMI({
        principal:
          principalValue,

        annualInterestRate:
          rateValue,

        tenureMonths,

        firstEmiDate:
          emiDate,
      });
    } catch {
      return null;
    }
  }, [
    principal,
    interestRate,
    tenure,
    tenureMode,
    firstEmiDate,
  ]);

  /*
   * -------------------------------------------------------
   * FORMATTERS
   * -------------------------------------------------------
   */

  const formatCurrency = (
    value: number
  ) => {
    return `₹${Math.round(
      value
    ).toLocaleString('en-IN')}`;
  };

  const formatDate = (
    date?: Date
  ) => {
    if (!date) {
      return '-';
    }

    const day =
      String(
        date.getDate()
      ).padStart(2, '0');

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, '0');

    const year =
      date.getFullYear();

    return `${day}-${month}-${year}`;
  };

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            EMI Calculator
          </Text>

          <Text style={styles.subtitle}>
            Calculate your EMI, interest,
            repayment and complete schedule.
          </Text>
        </View>

        {/* -------------------------------------------------
            INPUT CARD
        -------------------------------------------------- */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Loan Details
          </Text>

          {/* Loan Amount */}

          <View style={styles.field}>
            <Text style={styles.label}>
              Loan Amount
            </Text>

            <TextInput
              value={principal}
              onChangeText={
                setPrincipal
              }
              keyboardType="numeric"
              placeholder="Enter loan amount"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </View>

          {/* Interest Rate */}

          <View style={styles.field}>
            <Text style={styles.label}>
              Annual Interest Rate
            </Text>

            <View style={styles.inputWithSuffix}>
              <TextInput
                value={interestRate}
                onChangeText={
                  setInterestRate
                }
                keyboardType="decimal-pad"
                placeholder="8.5"
                placeholderTextColor="#9CA3AF"
                style={
                  styles.inputFlex
                }
              />

              <Text
                style={
                  styles.inputSuffix
                }
              >
                %
              </Text>
            </View>
          </View>

          {/* Tenure */}

          <View style={styles.field}>
            <Text style={styles.label}>
              Tenure
            </Text>

            <View
              style={
                styles.tenureRow
              }
            >
              <TextInput
                value={tenure}
                onChangeText={
                  setTenure
                }
                keyboardType="numeric"
                placeholder="20"
                placeholderTextColor="#9CA3AF"
                style={
                  styles.tenureInput
                }
              />

              <View
                style={
                  styles.toggleContainer
                }
              >
                <Pressable
                  onPress={() =>
                    setTenureMode(
                      'YEARS'
                    )
                  }
                  style={[
                    styles.toggleButton,
                    tenureMode ===
                      'YEARS' &&
                      styles.toggleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      tenureMode ===
                        'YEARS' &&
                        styles.toggleTextActive,
                    ]}
                  >
                    Years
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setTenureMode(
                      'MONTHS'
                    )
                  }
                  style={[
                    styles.toggleButton,
                    tenureMode ===
                      'MONTHS' &&
                      styles.toggleButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      tenureMode ===
                        'MONTHS' &&
                        styles.toggleTextActive,
                    ]}
                  >
                    Months
                  </Text>
                </Pressable>
              </View>
            </View>

            {calculation && (
              <Text
                style={
                  styles.helperText
                }
              >
                {tenureMode ===
                'YEARS'
                  ? `${Math.round(
                      Number(tenure) *
                        12
                    )} months`
                  : `${Math.round(
                      Number(tenure)
                    )} months`}
              </Text>
            )}
          </View>

          {/* First EMI Date */}

          <View style={styles.field}>
            <Text style={styles.label}>
              First EMI Date
            </Text>

            <TextInput
              value={firstEmiDate}
              onChangeText={
                setFirstEmiDate
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              maxLength={10}
            />

            <Text
              style={
                styles.helperText
              }
            >
              Format: YYYY-MM-DD
            </Text>
          </View>
        </View>

        {/* -------------------------------------------------
            RESULT
        -------------------------------------------------- */}

        {calculation ? (
          <>
            <View
              style={
                styles.resultCard
              }
            >
              <Text
                style={
                  styles.resultLabel
                }
              >
                Monthly EMI
              </Text>

              <Text
                style={
                  styles.emiValue
                }
              >
                {formatCurrency(
                  calculation.emi
                )}
              </Text>

              <Text
                style={
                  styles.resultSubtext
                }
              >
                Payable every month
              </Text>
            </View>

            {/* Summary */}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Loan Summary
              </Text>

              <View
                style={
                  styles.summaryGrid
                }
              >
                <SummaryItem
                  label="Principal"
                  value={formatCurrency(
                    calculation.totalPrincipal
                  )}
                  tone="green"
                />

                <SummaryItem
                  label="Total Interest"
                  value={formatCurrency(
                    calculation.totalInterest
                  )}
                  tone="purple"
                />

                <SummaryItem
                  label="Total Payment"
                  value={formatCurrency(
                    calculation.totalPayment
                  )}
                  tone="blue"
                />

                <SummaryItem
                  label="Maturity Date"
                  value={formatDate(
                    calculation.maturityDate
                  )}
                  tone="orange"
                />
              </View>
            </View>

            {/* EMI Schedule */}

            <View style={styles.card}>
              <View
                style={
                  styles.scheduleHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    EMI Schedule
                  </Text>

                  <Text
                    style={
                      styles.scheduleSubtext
                    }
                  >
                    {
                      calculation.schedule
                        .length
                    }{' '}
                    installments
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                style={styles.scheduleScroll}
                contentContainerStyle={
                  styles.scheduleScrollContent
                }
                showsHorizontalScrollIndicator={
                  false
                }
              >
                <View style={styles.scheduleTable}>
                  {/* Table Header */}

                  <View
                    style={
                      styles.tableHeader
                    }
                  >
                    <TableHeader
                      text="#"
                      width={55}
                    />

                    <TableHeader
                      text="Due Date"
                      width={110}
                    />

                    <TableHeader
                      text="Opening"
                      width={125}
                    />

                    <TableHeader
                      text="EMI"
                      width={115}
                    />

                    <TableHeader
                      text="Principal"
                      width={115}
                    />

                    <TableHeader
                      text="Interest"
                      width={115}
                    />

                    <TableHeader
                      text="Closing"
                      width={125}
                    />
                  </View>

                  {/* Table Rows */}

                  {calculation.schedule.map(
                    (
                      row
                    ) => (
                      <View
                        key={
                          row.installmentNo
                        }
                        style={
                          styles.tableRow
                        }
                      >
                        <TableCell
                          value={String(
                            row.installmentNo
                          )}
                          width={55}
                        />

                        <TableCell
                          value={formatDate(
                            row.dueDate
                          )}
                          width={110}
                        />

                        <TableCell
                          value={formatCurrency(
                            row.openingBalance
                          )}
                          width={125}
                        />

                        <TableCell
                          value={formatCurrency(
                            row.emi
                          )}
                          width={115}
                        />

                        <TableCell
                          value={formatCurrency(
                            row.principal
                          )}
                          width={115}
                        />

                        <TableCell
                          value={formatCurrency(
                            row.interest
                          )}
                          width={115}
                        />

                        <TableCell
                          value={formatCurrency(
                            row.closingBalance
                          )}
                          width={125}
                        />
                      </View>
                    )
                  )}
                </View>
              </ScrollView>
            </View>
          </>
        ) : (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Enter valid loan details
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Enter the loan amount,
              interest rate, tenure and
              first EMI date to calculate
              your EMI.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

/*
 * =========================================================
 * SUMMARY ITEM
 * =========================================================
 */

function SummaryItem({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: string;
  tone?: 'blue' | 'purple' | 'green' | 'orange';
}) {
  return (
    <View
      style={[
        styles.summaryItem,
        tone === 'blue' && styles.summaryBlue,
        tone === 'purple' && styles.summaryPurple,
        tone === 'green' && styles.summaryGreen,
        tone === 'orange' && styles.summaryOrange,
      ]}
    >
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
          tone === 'blue' && styles.summaryBlueValue,
          tone === 'purple' && styles.summaryPurpleValue,
          tone === 'green' && styles.summaryGreenValue,
          tone === 'orange' && styles.summaryOrangeValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * TABLE HEADER
 * =========================================================
 */

function TableHeader({
  text,
  width,
}: {
  text: string;
  width: number;
}) {
  return (
    <View
      style={[
        styles.tableHeaderCell,
        { width },
      ]}
    >
      <Text
        style={
          styles.tableHeaderText
        }
      >
        {text}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * TABLE CELL
 * =========================================================
 */

function TableCell({
  value,
  width,
}: {
  value: string;
  width: number;
}) {
  return (
    <View
      style={[
        styles.tableCell,
        { width },
      ]}
    >
      <Text
        style={
          styles.tableCellText
        }
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#FFD83D',
    },

    content: {
      paddingHorizontal: 16,
      paddingTop: 28,
      paddingBottom: 56,
      width: '100%',
    },

    header: {
      marginBottom: 24,
      paddingHorizontal: 2,
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 35,
      color: '#171A24',
      letterSpacing: -0.7,
    },

    subtitle: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 17,
      color: '#4D5566',
      lineHeight: 21,
      maxWidth: 720,
    },

    card: {
      backgroundColor: '#FFF0A8',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#E7C33A',
      padding: 22,
      marginBottom: 18,
      shadowColor: '#171A24',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#171A24',
      letterSpacing: -0.2,
      marginBottom: 18,
    },

    field: {
      marginBottom: 17,
    },

    label: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#3E3210',
      marginBottom: 8,
      letterSpacing: 0.1,
    },

    input: {
      height: 50,
      borderWidth: 1,
      borderColor: '#D5AA00',
      borderRadius: 13,
      paddingHorizontal: 15,
      fontFamily: 'Inter_500Medium',
      fontSize: 18,
      color: '#171A24',
      backgroundColor: '#FFF9D6',
    },

    inputWithSuffix: {
      height: 50,
      borderWidth: 1,
      borderColor: '#D5AA00',
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF9D6',
    },

    inputFlex: {
      flex: 1,
      height: 48,
      paddingHorizontal: 15,
      fontFamily: 'Inter_500Medium',
      fontSize: 18,
      color: '#171A24',
    },

    inputSuffix: {
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      color: '#7A5B00',
      paddingRight: 15,
    },

    tenureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    tenureInput: {
      flex: 1,
      height: 50,
      borderWidth: 1,
      borderColor: '#D5AA00',
      borderRadius: 13,
      paddingHorizontal: 15,
      fontFamily: 'Inter_500Medium',
      fontSize: 18,
      color: '#171A24',
      backgroundColor: '#FFF9D6',
    },

    toggleContainer: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: '#D5AA00',
      borderRadius: 13,
      overflow: 'hidden',
      backgroundColor: '#FFE8A0',
    },

    toggleButton: {
      paddingHorizontal: 15,
      height: 48,
      justifyContent: 'center',
      backgroundColor: '#FFE8A0',
    },

    toggleButtonActive: {
      backgroundColor: '#171A24',
    },

    toggleText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#6B5A1A',
    },

    toggleTextActive: {
      color: '#FFD83D',
    },

    helperText: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#6B5A1A',
    },

    resultCard: {
      backgroundColor: '#F4C400',
      borderWidth: 1,
      borderColor: '#D5AA00',
      borderRadius: 20,
      paddingHorizontal: 28,
      paddingVertical: 28,
      marginBottom: 18,
      alignItems: 'center',
      shadowColor: '#171A24',
      shadowOpacity: 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },

    resultLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#4D3B00',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },

    emiValue: {
      marginTop: 8,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 45,
      color: '#171A24',
      letterSpacing: -1,
    },

    resultSubtext: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#4D3B00',
    },

    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },

    summaryItem: {
      width: '48%',
      minHeight: 88,
      borderRadius: 15,
      paddingHorizontal: 15,
      paddingVertical: 14,
      justifyContent: 'center',
      borderWidth: 1,
    },

    summaryLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#5A4918',
      marginBottom: 7,
    },

    summaryValue: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#171A24',
      letterSpacing: -0.2,
    },

    summaryBlue: {
      backgroundColor: '#FFE27A',
      borderColor: '#E4B800',
    },

    summaryPurple: {
      backgroundColor: '#FFC83D',
      borderColor: '#D9A600',
    },

    summaryGreen: {
      backgroundColor: '#E7F2A8',
      borderColor: '#BFD66A',
    },

    summaryOrange: {
      backgroundColor: '#FFB84A',
      borderColor: '#E39424',
    },

    summaryBlueValue: {
      color: '#17324D',
    },

    summaryPurpleValue: {
      color: '#4A2F00',
    },

    summaryGreenValue: {
      color: '#176B4A',
    },

    summaryOrangeValue: {
      color: '#713900',
    },

    scheduleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },

    scheduleSubtext: {
      marginTop: -10,
      marginBottom: 14,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#6B5A1A',
    },

    scheduleScroll: {
      width: '100%',
    },

    scheduleScrollContent: {
      minWidth: '100%',
    },

    scheduleTable: {
      width: '100%',
      minWidth: 760,
    },

    tableHeader: {
      height: 42,
      flexDirection: 'row',
      backgroundColor: '#FFC928',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#D5AA00',
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },

    tableHeaderCell: {
      justifyContent: 'center',
      paddingHorizontal: 10,
    },

    tableHeaderText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#171A24',
    },

    tableRow: {
      minHeight: 50,
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderColor: '#E7C33A',
      alignItems: 'center',
      backgroundColor: '#FFF9D6',
    },

    tableCell: {
      paddingHorizontal: 10,
      justifyContent: 'center',
    },

    tableCellText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#4D5566',
    },

    emptyCard: {
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E7C33A',
      borderRadius: 20,
      padding: 34,
      alignItems: 'center',
      marginTop: 3,
      shadowColor: '#171A24',
      shadowOpacity: 0.10,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    },

    emptyTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 19,
      color: '#171A24',
    },

    emptyText: {
      marginTop: 8,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'center',
      color: '#4D5566',
      maxWidth: 500,
    },
  });
