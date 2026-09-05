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

import {
  getLoanPositionMetrics,
} from '../services/loanMetricsService';

import RecordPaymentScreen from './RecordPaymentScreen';

interface Props {
  loan: Loan;
  onOpenAmortization?: (loan: Loan) => void;
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

function commitmentAmount(loan: Loan): number {
  if (loan.repaymentType === 'INTEREST_ONLY') {
    const monthlyInterest = Number(loan.monthlyInterest || 0);
    if (monthlyInterest > 0) return monthlyInterest;

    const outstanding = Number(loan.currentOutstanding || loan.originalPrincipal || 0);
    const rate = Number(loan.annualInterestRate || 0);
    return outstanding > 0 && rate > 0
      ? (outstanding * rate) / 100 / 12
      : 0;
  }

  return Number(loan.emi || 0);
}

export default function LoanDetailsScreen({
  loan,
  onOpenAmortization,
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


  const [authoritativeMetrics, setAuthoritativeMetrics] = useState({
    originalPrincipal: Number(loan.originalPrincipal || 0),
    principalPaid: 0,
    interestPaid: 0,
    totalPaid: 0,
    currentOutstanding: Number(loan.currentOutstanding || loan.originalPrincipal || 0),
    principalPaidPercent: 0,
  });

  const authoritativeOutstanding = authoritativeMetrics.currentOutstanding;

  const [
    loadingAmortization,
    setLoadingAmortization,
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


  async function loadAuthoritativeOutstanding() {
    try {
      setLoadingAmortization(true);
      const metrics = await getLoanPositionMetrics(
        loan,
        payments,
        new Date()
      );
      setAuthoritativeMetrics(metrics);
    } catch (error) {
      console.error(
        'Unable to calculate loan metrics:',
        error
      );
    } finally {
      setLoadingAmortization(false);
    }
  }

  useEffect(() => {
    if (!loadingPayments) {
      void loadAuthoritativeOutstanding();
    }
  }, [loan.id, loan.currentOutstanding, loan.originalPrincipal, payments, loadingPayments]);

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

  // Use the centralized loan metrics for the financial totals.  This includes
  // normal EMI payments, prepayments and lender adjustment/additional values
  // from the authoritative amortization schedule.
  const totalActualPayments = authoritativeMetrics.totalPaid;

  const totalPrincipalFromPayments = authoritativeMetrics.principalPaid;
  const totalInterestFromAmortization = authoritativeMetrics.interestPaid;

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
            authoritativeOutstanding
          )}`}
          tone="blue"
          primary
        />

        <SummaryCard
          label="Original Loan"
          value={`₹${money(
            loan.originalPrincipal
          )}`}
          tone="purple"
        />

        <SummaryCard
          label={
            loan.repaymentType === 'INTEREST_ONLY'
              ? 'Monthly Interest'
              : 'Monthly EMI'
          }
          value={`₹${money(
            commitmentAmount(loan)
          )}`}
          tone="green"
        />

        <SummaryCard
          label="Interest Rate"
          value={`${Number(
            loan.annualInterestRate ||
              0
          )}%`}
          tone="orange"
        />

        <SummaryCard
          label="Total Tenure"
          value={`${Number(
            loan.tenureMonths ||
              0
          )} months`}
          tone="neutral"
        />

        <SummaryCard
          label="Remaining"
          value={`${Number(
            loan.remainingMonths ||
              0
          )} months`}
          tone="neutral"
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
            {loan.repaymentType === 'INTEREST_ONLY'
              ? 'NEXT INTEREST'
              : 'NEXT EMI'}
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
              commitmentAmount(loan)
            )}
          </Text>

          <Text
            style={
              styles.nextAmountLabel
            }
          >
            {loan.repaymentType === 'INTEREST_ONLY'
              ? 'Monthly interest'
              : 'Scheduled EMI'}
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

        <View style={styles.paymentStat}>
          <Text style={styles.paymentStatLabel}>Interest</Text>
          <Text style={styles.paymentStatValue}>₹{money(totalInterestFromAmortization)}</Text>
        </View>
      </View>

      {loadingPayments ? (
        <View
          style={
            styles.loadingPayments
          }
        >
          <ActivityIndicator
            color="#F4C400"
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

      {/* AMORTIZATION SCHEDULE */}

      <View
        style={styles.amortizationCard}
      >
        <View style={styles.amortizationCardIcon}>
          <Text style={styles.amortizationCardIconText}>₹</Text>
        </View>

        <View style={styles.amortizationCardContent}>
          <Text style={styles.sectionTitle}>Amortization Schedule</Text>
          <Text style={styles.sectionSubtitle}>
            View and manage the lender schedule, EMI status, payments and prepayments in one place.
          </Text>
        </View>

        {onOpenAmortization ? (
          <Pressable
            style={styles.amortizationButton}
            onPress={() => onOpenAmortization(loan)}
          >
            <Text style={styles.amortizationButtonText}>
              Open Amortization
            </Text>
          </Pressable>
        ) : null}
      </View>

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
  tone = 'neutral',
}: {
  label: string;
  value: string;
  primary?: boolean;
  tone?: 'blue' | 'purple' | 'green' | 'orange' | 'neutral';
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        tone === 'blue' && styles.summaryBlue,
        tone === 'purple' && styles.summaryPurple,
        tone === 'green' && styles.summaryGreen,
        tone === 'orange' && styles.summaryOrange,
      ]}
    >
      <Text
        style={[
          styles.summaryLabel,
          tone !== 'neutral' && styles.summaryBlueLabel,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          primary
            ? styles.summaryPrimaryValue
            : styles.summaryValue,
          tone !== 'neutral' && styles.summaryColorValue,
        ]}
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
      backgroundColor: '#FFF7D6',
    },

    content: {
      width: '100%',
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 52,
    },

    hero: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
      padding: 22,
      borderRadius: 22,
      backgroundColor: '#171A24',
      borderWidth: 1,
      borderColor: '#292D38',
      shadowColor: '#171A24',
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 9 },
      elevation: 5,
    },

    heroLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      flex: 1,
    },

    loanIcon: {
      width: 56,
      height: 56,
      borderRadius: 17,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 15,
      borderWidth: 1,
      borderColor: '#FFD83D',
    },

    loanIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 26,
      color: '#171A24',
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 31,
      color: '#FFD83D',
      letterSpacing: -0.6,
    },

    lender: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: 'rgba(255,255,255,0.68)',
    },

    heroStatus: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: '#E2F6EC',
      borderWidth: 1,
      borderColor: '#B8E5CE',
      marginLeft: 14,
    },

    statusText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 10,
      letterSpacing: 0.5,
      color: '#159A68',
    },

    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 170,
      minHeight: 112,
      padding: 17,
      borderRadius: 18,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E7C33A',
      shadowColor: '#171A24',
      shadowOpacity: 0.055,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },

    summaryBlue: {
      backgroundColor: '#F4C400',
      borderColor: '#E0B300',
      shadowColor: '#B48B00',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    summaryPurple: {
      backgroundColor: '#FFB84A',
      borderColor: '#F0A12A',
      shadowColor: '#C77800',
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    summaryGreen: {
      backgroundColor: '#E7F2A8',
      borderColor: '#C9D97A',
      shadowColor: '#8FA83A',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    summaryOrange: {
      backgroundColor: '#FFE08A',
      borderColor: '#E7C33A',
      shadowColor: '#C89E00',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },

    summaryLabel: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 10,
      color: '#4D3D0D',
      letterSpacing: 0.65,
      textTransform: 'uppercase',
    },

    summaryValue: {
      marginTop: 9,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 21,
      lineHeight: 24,
      color: '#171A24',
    },

    summaryPrimaryValue: {
      marginTop: 9,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 23,
      lineHeight: 25,
      color: '#171A24',
    },

    summaryBlueLabel: {
      color: '#4D3D0D',
    },

    summaryColorValue: {
      color: '#171A24',
    },

    nextCard: {
      marginTop: 14,
      padding: 20,
      borderRadius: 18,
      backgroundColor: '#171A24',
      borderWidth: 1,
      borderColor: '#292D38',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#171A24',
      shadowOpacity: 0.16,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },

    nextLabel: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 10,
      letterSpacing: 0.85,
      color: '#FFD83D',
    },

    nextDate: {
      marginTop: 6,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 22,
      color: '#FFFFFF',
    },

    nextAmountBox: {
      alignItems: 'flex-end',
      marginLeft: 14,
      paddingLeft: 20,
      borderLeftWidth: 1,
      borderLeftColor: 'rgba(255,216,61,0.30)',
    },

    nextAmount: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 23,
      color: '#FFD83D',
    },

    nextAmountLabel: {
      marginTop: 3,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: 'rgba(255,255,255,0.66)',
    },

    infoCard: {
      marginTop: 18,
      padding: 20,
      borderRadius: 18,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E7C33A',
      shadowColor: '#171A24',
      shadowOpacity: 0.055,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },

    sectionTitle: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 20,
      color: '#171A24',
    },

    sectionSubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#6B5A1A',
    },

    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#E4C83E',
    },

    infoLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#806E2D',
    },

    infoValue: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#2B2410',
      marginLeft: 16,
      textAlign: 'right',
    },

    paymentHeader: {
      marginTop: 30,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    recordButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 11,
      backgroundColor: '#F4C400',
      borderWidth: 1,
      borderColor: '#E0B300',
      shadowColor: '#B48B00',
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    recordButtonText: {
      color: '#171A24',
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 12,
    },

    paymentStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },

    paymentStat: {
      flex: 1,
      minWidth: 150,
      backgroundColor: '#FFF9D6',
      borderWidth: 1,
      borderColor: '#E4C83E',
      borderRadius: 15,
      padding: 15,
      shadowColor: '#171A24',
      shadowOpacity: 0.035,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    paymentStatLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#806E2D',
    },

    paymentStatValue: {
      marginTop: 5,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
      color: '#171A24',
    },

    loadingPayments: {
      padding: 35,
      alignItems: 'center',
    },

    loadingText: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#6B5A1A',
    },

    emptyPayment: {
      padding: 32,
      alignItems: 'center',
      backgroundColor: '#FFF0A8',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E4C83E',
    },

    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 25,
      color: '#171A24',
    },

    emptyTitle: {
      marginTop: 11,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 17,
      color: '#171A24',
    },

    emptyText: {
      marginTop: 7,
      maxWidth: 560,
      textAlign: 'center',
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#6B5A1A',
    },

    paymentCard: {
      marginBottom: 10,
      padding: 16,
      borderRadius: 15,
      backgroundColor: '#FFF9D6',
      borderWidth: 1,
      borderColor: '#E4C83E',
      shadowColor: '#171A24',
      shadowOpacity: 0.035,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    paymentCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    paymentDate: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#2B2410',
    },

    paymentInstallment: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#806E2D',
    },

    paymentAmountArea: {
      alignItems: 'flex-end',
    },

    paymentAmount: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
      color: '#171A24',
    },

    paymentStatus: {
      marginTop: 4,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 9,
      color: '#159A68',
    },

    paymentBreakdown: {
      flexDirection: 'row',
      gap: 20,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#E4C83E',
    },

    breakdownText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#6B5A1A',
    },

    notesText: {
      marginTop: 9,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: '#6B5A1A',
      fontStyle: 'italic',
    },

    paymentActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },

    editPaymentButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E4C83E',
    },

    editPaymentText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: '#171A24',
    },

    deletePaymentButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: '#FCE4E4',
      borderWidth: 1,
      borderColor: '#E9A3A3',
    },

    deletePaymentText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: '#D93636',
    },

    scheduleHeaderArea: {
      marginTop: 30,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    amortizationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      marginBottom: 20,
      borderRadius: 18,
      backgroundColor: '#171A24',
      borderWidth: 1,
      borderColor: '#292D38',
      shadowColor: '#171A24',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    amortizationCardIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
    },
    amortizationCardIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 24,
      color: '#171A24',
    },
    amortizationCardContent: {
      flex: 1,
    },
    amortizationButton: {
      marginLeft: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#FFD83D',
      borderWidth: 1,
      borderColor: '#F4C400',
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    amortizationButtonText: {
      color: '#171A24',
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 12,
    },

    scheduleScroll: {
      width: '100%',
    },

    scheduleTable: {
      minWidth: 760,
      backgroundColor: '#FFF9D6',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#E4C83E',
    },

    scheduleHeader: {
      flexDirection: 'row',
      backgroundColor: '#F4C400',
      paddingVertical: 12,
    },

    scheduleRow: {
      flexDirection: 'row',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: '#E4C83E',
    },

    scheduleRowPaid: {
      backgroundColor: '#E7F2A8',
    },

    headerCell: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 12,
      color: '#171A24',
    },

    cell: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#2B2410',
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
      textAlign: 'right',
      paddingRight: 14,
    },

    bottomSpace: {
      height: 34,
    },
  });

