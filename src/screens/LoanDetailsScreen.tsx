import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Loan } from '../models/loan';

import {
  Payment,
} from '../models/payment';

import {
  deletePayment,
  getLoanPayments,
} from '../services/paymentService';

import {
  generateLoanSchedule,
} from '../engine/loanSchedule';

import RecordPaymentScreen from './RecordPaymentScreen';

interface Props {
  loan: Loan;
}

function money(value: number): string {
  return Math.round(
    Number(value) || 0
  ).toLocaleString('en-IN');
}

function formatDate(
  value?: string
): string {
  if (!value) return '-';

  const date =
    new Date(value);

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

export default function LoanDetailsScreen({
  loan,
}: Props) {
  const result =
    useMemo(
      () =>
        generateLoanSchedule(
          loan
        ),
      [loan]
    );

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    loadingPayments,
    setLoadingPayments,
  ] = useState(true);

  const [
    showPaymentForm,
    setShowPaymentForm,
  ] = useState(false);

  const [
    editingPayment,
    setEditingPayment,
  ] = useState<Payment | null>(
    null
  );

  async function loadPayments() {
    if (!loan.id) {
      setPayments([]);
      setLoadingPayments(false);
      return;
    }

    try {
      setLoadingPayments(true);

      const data =
        await getLoanPayments(
          loan.id
        );

      setPayments(data);
    } catch (error) {
      console.error(
        'Unable to load payments:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to load payment history.'
      );
    } finally {
      setLoadingPayments(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, [loan.id]);

  /*
   * -------------------------------------------------------
   * PAYMENT FORM
   * -------------------------------------------------------
   */

  if (
    showPaymentForm
  ) {
    return (
      <RecordPaymentScreen
        loan={loan}
        payment={
          editingPayment
        }
        onSaved={() => {
          setShowPaymentForm(
            false
          );

          setEditingPayment(
            null
          );

          void loadPayments();
        }}
        onCancel={() => {
          setShowPaymentForm(
            false
          );

          setEditingPayment(
            null
          );
        }}
      />
    );
  }

  /*
   * -------------------------------------------------------
   * PAYMENT DELETE
   * -------------------------------------------------------
   */

  async function performDeletePayment(
    payment: Payment
  ) {
    if (!payment.id) {
      return;
    }

    try {
      await deletePayment(
        payment.id
      );

      await loadPayments();

      if (
        Platform.OS ===
        'web'
      ) {
        window.alert(
          'Payment deleted successfully.'
        );
      } else {
        Alert.alert(
          'Deleted',
          'Payment deleted successfully.'
        );
      }
    } catch (error) {
      console.error(
        'Payment delete failed:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete payment.';

      if (
        Platform.OS ===
        'web'
      ) {
        window.alert(
          message
        );
      } else {
        Alert.alert(
          'Delete Failed',
          message
        );
      }
    }
  }

  function confirmDeletePayment(
    payment: Payment
  ) {
    if (!payment.id) {
      return;
    }

    if (
      Platform.OS ===
      'web'
    ) {
      const confirmed =
        window.confirm(
          'Are you sure you want to delete this payment?'
        );

      if (confirmed) {
        void performDeletePayment(
          payment
        );
      }

      return;
    }

    Alert.alert(
      'Delete Payment',
      'Are you sure you want to delete this payment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDeletePayment(
              payment
            );
          },
        },
      ]
    );
  }

  /*
   * -------------------------------------------------------
   * PAYMENT TOTALS
   * -------------------------------------------------------
   */

  const totalActualPayments =
    payments.reduce(
      (
        sum,
        payment
      ) =>
        sum +
        Number(
          payment.amount
        ),
      0
    );

  const totalPrincipalFromPayments =
    payments.reduce(
      (
        sum,
        payment
      ) =>
        sum +
        Number(
          payment.principal
        ),
      0
    );

  /*
   * -------------------------------------------------------
   * SCREEN
   * -------------------------------------------------------
   */

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      {/* HEADER */}

      <View
        style={
          styles.hero
        }
      >
        <View
          style={
            styles.heroLeft
          }
        >
          <View
            style={
              styles.loanIcon
            }
          >
            <Text
              style={
                styles.loanIconText
              }
            >
              ₹
            </Text>
          </View>

          <View>
            <Text
              style={
                styles.title
              }
            >
              {loan.loanName}
            </Text>

            <Text
              style={
                styles.lender
              }
            >
              {loan.lender}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.heroStatus
          }
        >
          <Text
            style={
              styles.statusText
            }
          >
            {loan.status}
          </Text>
        </View>
      </View>

      {/* SUMMARY */}

      <View
        style={
          styles.summaryGrid
        }
      >
        <SummaryCard
          label="Outstanding"
          value={`₹${money(
            loan.currentOutstanding
          )}`}
          primary
        />

        <SummaryCard
          label="Original Loan"
          value={`₹${money(
            loan.originalPrincipal
          )}`}
        />

        <SummaryCard
          label="Monthly EMI"
          value={`₹${money(
            loan.emi
          )}`}
        />

        <SummaryCard
          label="Interest Rate"
          value={`${Number(
            loan.annualInterestRate ||
              0
          )}%`}
        />

        <SummaryCard
          label="Total Tenure"
          value={`${Number(
            loan.tenureMonths ||
              0
          )} months`}
        />

        <SummaryCard
          label="Remaining"
          value={`${Number(
            loan.remainingMonths ||
              0
          )} months`}
        />
      </View>

      {/* NEXT EMI */}

      <View
        style={
          styles.nextCard
        }
      >
        <View>
          <Text
            style={
              styles.nextLabel
            }
          >
            NEXT EMI
          </Text>

          <Text
            style={
              styles.nextDate
            }
          >
            {result.schedule.find(
              row =>
                new Date(
                  row.dueDate
                ).getTime() >
                new Date().setHours(
                  23,
                  59,
                  59,
                  999
                )
            )
              ? formatDate(
                  result.schedule.find(
                    row =>
                      new Date(
                        row.dueDate
                      ).getTime() >
                      new Date().setHours(
                        23,
                        59,
                        59,
                        999
                      )
                  )?.dueDate.toISOString()
                )
              : 'Completed'}
          </Text>
        </View>

        <View
          style={
            styles.nextAmountBox
          }
        >
          <Text
            style={
              styles.nextAmount
            }
          >
            ₹
            {money(
              loan.emi
            )}
          </Text>

          <Text
            style={
              styles.nextAmountLabel
            }
          >
            Scheduled EMI
          </Text>
        </View>
      </View>

      {/* INFORMATION */}

      <View
        style={
          styles.infoCard
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Loan Information
        </Text>

        <InfoRow
          label="Original Principal"
          value={`₹${money(
            loan.originalPrincipal
          )}`}
        />

        <InfoRow
          label="First EMI"
          value={formatDate(
            loan.firstEmiDate
          )}
        />

        <InfoRow
          label="Last EMI"
          value={formatDate(
            result.maturityDate.toISOString()
          )}
        />

        <InfoRow
          label="Remaining Tenure"
          value={`${Number(
            loan.remainingMonths ||
              0
          )} months`}
        />

        <InfoRow
          label="Status"
          value={
            loan.status
          }
        />
      </View>

      {/* PAYMENT SECTION */}

      <View
        style={
          styles.paymentHeader
        }
      >
        <View>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Payments
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Actual payments and prepayments
          </Text>
        </View>

        <Pressable
          style={
            styles.recordButton
          }
          onPress={() => {
            setEditingPayment(
              null
            );

            setShowPaymentForm(
              true
            );
          }}
        >
          <Text
            style={
              styles.recordButtonText
            }
          >
            + Record Payment
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.paymentStats
        }
      >
        <View
          style={
            styles.paymentStat
          }
        >
          <Text
            style={
              styles.paymentStatLabel
            }
          >
            Recorded
          </Text>

          <Text
            style={
              styles.paymentStatValue
            }
          >
            {payments.length}
          </Text>
        </View>

        <View
          style={
            styles.paymentStat
          }
        >
          <Text
            style={
              styles.paymentStatLabel
            }
          >
            Total Paid
          </Text>

          <Text
            style={
              styles.paymentStatValue
            }
          >
            ₹
            {money(
              totalActualPayments
            )}
          </Text>
        </View>

        <View
          style={
            styles.paymentStat
          }
        >
          <Text
            style={
              styles.paymentStatLabel
            }
          >
            Principal
          </Text>

          <Text
            style={
              styles.paymentStatValue
            }
          >
            ₹
            {money(
              totalPrincipalFromPayments
            )}
          </Text>
        </View>
      </View>

      {loadingPayments ? (
        <View
          style={
            styles.loadingPayments
          }
        >
          <ActivityIndicator
            color="#16803A"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading payments...
          </Text>
        </View>
      ) : payments.length ===
        0 ? (
        <View
          style={
            styles.emptyPayment
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <Text
              style={
                styles.emptyIconText
              }
            >
              ₹
            </Text>
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            No payment records
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            The system automatically assumes scheduled EMIs
            are paid. Add a payment here only when you need
            to record a partial payment or prepayment.
          </Text>
        </View>
      ) : (
        payments.map(
          payment => (
            <PaymentCard
              key={
                payment.id
              }
              payment={
                payment
              }
              onEdit={() => {
                setEditingPayment(
                  payment
                );

                setShowPaymentForm(
                  true
                );
              }}
              onDelete={() =>
                confirmDeletePayment(
                  payment
                )
              }
            />
          )
        )
      )}

      {/* EMI SCHEDULE */}

      <View
        style={
          styles.scheduleHeaderArea
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
              styles.sectionSubtitle
            }
          >
            Complete repayment schedule
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          true
        }
        style={
          styles.scheduleScroll
        }
      >
        <View
          style={
            styles.scheduleTable
          }
        >
          <View
            style={
              styles.scheduleHeader
            }
          >
            <Text
              style={[
                styles.headerCell,
                styles.no,
              ]}
            >
              #
            </Text>

            <Text
              style={[
                styles.headerCell,
                styles.date,
              ]}
            >
              Date
            </Text>

            <Text
              style={[
                styles.headerCell,
                styles.moneyCell,
              ]}
            >
              EMI
            </Text>

            <Text
              style={[
                styles.headerCell,
                styles.moneyCell,
              ]}
            >
              Principal
            </Text>

            <Text
              style={[
                styles.headerCell,
                styles.moneyCell,
              ]}
            >
              Interest
            </Text>

            <Text
              style={[
                styles.headerCell,
                styles.moneyCell,
              ]}
            >
              Balance
            </Text>
          </View>

          {result.schedule.map(
            row => {
              const due =
                new Date(
                  row.dueDate
                ).getTime() <=
                new Date().setHours(
                  23,
                  59,
                  59,
                  999
                );

              return (
                <View
                  key={
                    row.installmentNo
                  }
                  style={[
                    styles.scheduleRow,
                    due &&
                      styles.scheduleRowPaid,
                  ]}
                >
                  <Text
                    style={[
                      styles.cell,
                      styles.no,
                    ]}
                  >
                    {
                      row.installmentNo
                    }
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.date,
                    ]}
                  >
                    {formatDate(
                      row.dueDate.toISOString()
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.moneyCell,
                    ]}
                  >
                    ₹
                    {money(
                      row.emi
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.moneyCell,
                    ]}
                  >
                    ₹
                    {money(
                      row.principal
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.moneyCell,
                    ]}
                  >
                    ₹
                    {money(
                      row.interest
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.cell,
                      styles.moneyCell,
                    ]}
                  >
                    ₹
                    {money(
                      row.closingBalance
                    )}
                  </Text>
                </View>
              );
            }
          )}
        </View>
      </ScrollView>

      <View
        style={
          styles.bottomSpace
        }
      />
    </ScrollView>
  );
}

/*
 * =========================================================
 * SUMMARY CARD
 * =========================================================
 */

function SummaryCard({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <View
      style={
        styles.summaryCard
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
          primary
            ? styles.summaryPrimaryValue
            : styles.summaryValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * INFO ROW
 * =========================================================
 */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * PAYMENT CARD
 * =========================================================
 */

function PaymentCard({
  payment,
  onEdit,
  onDelete,
}: {
  payment: Payment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={
        styles.paymentCard
      }
    >
      <View
        style={
          styles.paymentCardTop
        }
      >
        <View>
          <Text
            style={
              styles.paymentDate
            }
          >
            {formatDate(
              payment.paymentDate
            )}
          </Text>

          <Text
            style={
              styles.paymentInstallment
            }
          >
            {payment.status ===
            'PREPAYMENT'
              ? 'Prepayment'
              : payment.installmentNo
                ? `EMI #${payment.installmentNo}`
                : 'Payment'}
          </Text>
        </View>

        <View
          style={
            styles.paymentAmountArea
          }
        >
          <Text
            style={
              styles.paymentAmount
            }
          >
            ₹
            {money(
              payment.amount
            )}
          </Text>

          <Text
            style={
              styles.paymentStatus
            }
          >
            {payment.status}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.paymentBreakdown
        }
      >
        <Text
          style={
            styles.breakdownText
          }
        >
          Principal ₹
          {money(
            payment.principal
          )}
        </Text>

        <Text
          style={
            styles.breakdownText
          }
        >
          Interest ₹
          {money(
            payment.interest
          )}
        </Text>
      </View>

      {payment.notes ? (
        <Text
          style={
            styles.notesText
          }
        >
          {payment.notes}
        </Text>
      ) : null}

      <View
        style={
          styles.paymentActions
        }
      >
        <Pressable
          style={
            styles.editPaymentButton
          }
          onPress={
            onEdit
          }
        >
          <Text
            style={
              styles.editPaymentText
            }
          >
            Edit
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.deletePaymentButton
          }
          onPress={
            onDelete
          }
        >
          <Text
            style={
              styles.deletePaymentText
            }
          >
            Delete
          </Text>
        </Pressable>
      </View>
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
    container: {
      flex: 1,
      backgroundColor:
        '#F4F8F5',
    },

    content: {
      paddingHorizontal: 28,
      paddingTop: 22,
      paddingBottom: 40,
    },

    hero: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 18,
    },

    heroLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    loanIcon: {
      width: 47,
      height: 47,
      borderRadius: 13,
      backgroundColor:
        '#EAF4ED',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    loanIconText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#16803A',
    },

    title: {
      fontSize: 25,
      fontWeight: '800',
      color: '#17221B',
    },

    lender: {
      marginTop: 3,
      fontSize: 11,
      color: '#78847D',
    },

    heroStatus: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor:
        '#E8F6EC',
    },

    statusText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#16803A',
    },

    summaryGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 11,
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 170,
      minHeight: 93,
      padding: 15,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
    },

    summaryLabel: {
      fontSize: 10,
      color: '#78847D',
    },

    summaryValue: {
      marginTop: 7,
      fontSize: 17,
      fontWeight: '800',
      color: '#27322C',
    },

    summaryPrimaryValue: {
      marginTop: 7,
      fontSize: 18,
      fontWeight: '800',
      color: '#16803A',
    },

    nextCard: {
      marginTop: 14,
      padding: 17,
      borderRadius: 14,
      backgroundColor:
        '#16803A',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    nextLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: '#DCEFE2',
    },

    nextDate: {
      marginTop: 5,
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },

    nextAmountBox: {
      alignItems:
        'flex-end',
    },

    nextAmount: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },

    nextAmountLabel: {
      marginTop: 3,
      fontSize: 9,
      color: '#DCEFE2',
    },

    infoCard: {
      marginTop: 18,
      padding: 18,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#17221B',
    },

    sectionSubtitle: {
      marginTop: 3,
      fontSize: 10,
      color: '#89948E',
    },

    infoRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EDF1EE',
    },

    infoLabel: {
      fontSize: 11,
      color: '#78847D',
    },

    infoValue: {
      fontSize: 11,
      fontWeight: '700',
      color: '#27322C',
    },

    paymentHeader: {
      marginTop: 27,
      marginBottom: 12,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    recordButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor:
        '#16803A',
    },

    recordButtonText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },

    paymentStats: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 10,
      marginBottom: 12,
    },

    paymentStat: {
      flex: 1,
      minWidth: 150,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 12,
      padding: 13,
    },

    paymentStatLabel: {
      fontSize: 9,
      color: '#89948E',
    },

    paymentStatValue: {
      marginTop: 5,
      fontSize: 15,
      fontWeight: '800',
      color: '#16803A',
    },

    loadingPayments: {
      padding: 35,
      alignItems:
        'center',
    },

    loadingText: {
      marginTop: 7,
      fontSize: 10,
      color: '#78847D',
    },

    emptyPayment: {
      padding: 30,
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
    },

    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor:
        '#EAF4ED',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyIconText: {
      fontSize: 21,
      fontWeight: '800',
      color: '#16803A',
    },

    emptyTitle: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '800',
      color: '#17221B',
    },

    emptyText: {
      marginTop: 6,
      maxWidth: 560,
      textAlign:
        'center',
      lineHeight: 18,
      fontSize: 10,
      color: '#78847D',
    },

    paymentCard: {
      marginBottom: 10,
      padding: 15,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
    },

    paymentCardTop: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    paymentDate: {
      fontSize: 11,
      fontWeight: '700',
      color: '#334139',
    },

    paymentInstallment: {
      marginTop: 4,
      fontSize: 10,
      color: '#89948E',
    },

    paymentAmountArea: {
      alignItems:
        'flex-end',
    },

    paymentAmount: {
      fontSize: 15,
      fontWeight: '800',
      color: '#17221B',
    },

    paymentStatus: {
      marginTop: 4,
      fontSize: 8,
      fontWeight: '800',
      color: '#16803A',
    },

    paymentBreakdown: {
      flexDirection:
        'row',
      gap: 20,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        '#EDF1EE',
    },

    breakdownText: {
      fontSize: 9,
      color: '#78847D',
    },

    notesText: {
      marginTop: 9,
      fontSize: 9,
      color: '#66736B',
      fontStyle: 'italic',
    },

    paymentActions: {
      flexDirection:
        'row',
      gap: 8,
      marginTop: 12,
    },

    editPaymentButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 7,
      backgroundColor:
        '#EAF4ED',
    },

    editPaymentText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#16803A',
    },

    deletePaymentButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 7,
      backgroundColor:
        '#FFF0EE',
    },

    deletePaymentText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#C0392B',
    },

    scheduleHeaderArea: {
      marginTop: 30,
      marginBottom: 12,
    },

    scheduleScroll: {
      width: '100%',
    },

    scheduleTable: {
      minWidth: 760,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
    },

    scheduleHeader: {
      flexDirection:
        'row',
      backgroundColor:
        '#EAF4ED',
      paddingVertical: 12,
    },

    scheduleRow: {
      flexDirection:
        'row',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EDF1EE',
    },

    scheduleRowPaid: {
      backgroundColor:
        '#FAFCFA',
    },

    headerCell: {
      fontSize: 10,
      fontWeight: '800',
      color: '#536159',
    },

    cell: {
      fontSize: 10,
      color: '#344139',
    },

    no: {
      width: 50,
      paddingLeft: 12,
    },

    date: {
      width: 120,
    },

    moneyCell: {
      width: 145,
      textAlign:
        'right',
      paddingRight: 14,
    },

    bottomSpace: {
      height: 30,
    },
  });