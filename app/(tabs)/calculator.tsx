import React, {
  useMemo,
  useState,
} from 'react';

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
                />

                <SummaryItem
                  label="Total Interest"
                  value={formatCurrency(
                    calculation.totalInterest
                  )}
                />

                <SummaryItem
                  label="Total Payment"
                  value={formatCurrency(
                    calculation.totalPayment
                  )}
                />

                <SummaryItem
                  label="Maturity Date"
                  value={formatDate(
                    calculation.maturityDate
                  )}
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
                showsHorizontalScrollIndicator={
                  false
                }
              >
                <View>
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
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.summaryItem
      }
    >
      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.summaryValue
        }
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
      backgroundColor:
        '#F6F9F7',
    },

    content: {
      padding: 24,
      paddingBottom: 50,
    },

    header: {
      marginBottom: 22,
    },

    title: {
      fontSize: 28,
      fontWeight: '700',
      color: '#111827',
    },

    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: '#6B7280',
      lineHeight: 21,
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      padding: 20,
      marginBottom: 18,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
      marginBottom: 18,
    },

    field: {
      marginBottom: 18,
    },

    label: {
      fontSize: 13,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 7,
    },

    input: {
      height: 46,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 13,
      fontSize: 15,
      color: '#111827',
      backgroundColor:
        '#FFFFFF',
    },

    inputWithSuffix: {
      height: 46,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
    },

    inputFlex: {
      flex: 1,
      height: 44,
      paddingHorizontal: 13,
      fontSize: 15,
      color: '#111827',
    },

    inputSuffix: {
      fontSize: 15,
      color: '#6B7280',
      paddingRight: 14,
    },

    tenureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    tenureInput: {
      flex: 1,
      height: 46,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 13,
      fontSize: 15,
      color: '#111827',
      backgroundColor:
        '#FFFFFF',
    },

    toggleContainer: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      overflow: 'hidden',
    },

    toggleButton: {
      paddingHorizontal: 14,
      height: 44,
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
    },

    toggleButtonActive: {
      backgroundColor:
        '#EAF7EF',
    },

    toggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#6B7280',
    },

    toggleTextActive: {
      color: '#00843D',
    },

    helperText: {
      marginTop: 5,
      fontSize: 12,
      color: '#6B7280',
    },

    resultCard: {
      backgroundColor:
        '#EAF7EF',
      borderWidth: 1,
      borderColor: '#BFE5CD',
      borderRadius: 12,
      padding: 24,
      marginBottom: 18,
      alignItems: 'center',
    },

    resultLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: '#166534',
    },

    emiValue: {
      marginTop: 6,
      fontSize: 32,
      fontWeight: '700',
      color: '#00843D',
    },

    resultSubtext: {
      marginTop: 4,
      fontSize: 12,
      color: '#4B5563',
    },

    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },

    summaryItem: {
      width: '50%',
      paddingBottom: 20,
    },

    summaryLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 5,
    },

    summaryValue: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    scheduleHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginBottom: 4,
    },

    scheduleSubtext: {
      marginTop: -10,
      marginBottom: 14,
      fontSize: 12,
      color: '#6B7280',
    },

    tableHeader: {
      height: 42,
      flexDirection: 'row',
      backgroundColor:
        '#F3F4F6',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#E5E7EB',
    },

    tableHeaderCell: {
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    tableHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#374151',
    },

    tableRow: {
      height: 48,
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderColor: '#E5E7EB',
      alignItems: 'center',
    },

    tableCell: {
      paddingHorizontal: 10,
      justifyContent:
        'center',
    },

    tableCellText: {
      fontSize: 12,
      color: '#374151',
    },

    emptyCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      padding: 30,
      alignItems: 'center',
      marginTop: 5,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    emptyText: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      color: '#6B7280',
      maxWidth: 500,
    },
  });