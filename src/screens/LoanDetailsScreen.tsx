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
            color="#356DFF"
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
      backgroundColor: '#F5F7FB',
    },

    content: {
      width: '100%',
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 48,
    },

    hero: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
      padding: 20,
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      shadowColor: '#1D2A44',
      shadowOpacity: 0.05,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    heroLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 0,
      flex: 1,
    },

    loanIcon: {
      width: 52,
      height: 52,
      borderRadius: 15,
      backgroundColor: '#EAF0FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    loanIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 25,
      color: '#356DFF',
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 31,
      color: '#172033',
      letterSpacing: -0.5,
    },

    lender: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#738097',
    },

    heroStatus: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: '#E8F7F1',
      marginLeft: 14,
    },

    statusText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 0.4,
      color: '#168B63',
    },

    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 11,
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 170,
      minHeight: 98,
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      shadowColor: '#1D2A44',
      shadowOpacity: 0.035,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },

    summaryBlue: {
      backgroundColor: '#356DFF',
      borderColor: '#356DFF',
      shadowColor: '#2454D8',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    summaryPurple: {
      backgroundColor: '#7857D8',
      borderColor: '#7857D8',
      shadowColor: '#5B3FB7',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    summaryGreen: {
      backgroundColor: '#18A673',
      borderColor: '#18A673',
      shadowColor: '#087A55',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    summaryOrange: {
      backgroundColor: '#E99A32',
      borderColor: '#E99A32',
      shadowColor: '#C87818',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    summaryLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#7A879C',
      letterSpacing: 0.55,
      textTransform: 'uppercase',
    },

    summaryValue: {
      marginTop: 9,
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      lineHeight: 22,
      color: '#1D2940',
    },

    summaryPrimaryValue: {
      marginTop: 9,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 22,
      lineHeight: 24,
      color: '#FFFFFF',
    },

    summaryBlueLabel: {
      color: 'rgba(255,255,255,0.88)',
    },

    summaryColorValue: {
      color: '#FFFFFF',
    },

    nextCard: {
      marginTop: 14,
      padding: 18,
      borderRadius: 16,
      backgroundColor: '#356DFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#356DFF',
      shadowOpacity: 0.15,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    nextLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 0.8,
      color: 'rgba(255,255,255,0.72)',
    },

    nextDate: {
      marginTop: 5,
      fontFamily: 'Inter_700Bold',
      fontSize: 21,
      color: '#FFFFFF',
    },

    nextAmountBox: {
      alignItems: 'flex-end',
      marginLeft: 14,
    },

    nextAmount: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 22,
      color: '#FFFFFF',
    },

    nextAmountLabel: {
      marginTop: 3,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: 'rgba(255,255,255,0.72)',
    },

    infoCard: {
      marginTop: 18,
      padding: 20,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      shadowColor: '#1D2A44',
      shadowOpacity: 0.035,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    },

    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#172033',
    },

    sectionSubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#8490A4',
    },

    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: '#EEF1F6',
    },

    infoLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#738097',
    },

    infoValue: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#27344C',
      marginLeft: 16,
      textAlign: 'right',
    },

    paymentHeader: {
      marginTop: 28,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    recordButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#356DFF',
      shadowColor: '#356DFF',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    recordButtonText: {
      color: '#FFFFFF',
      fontFamily: 'Inter_700Bold',
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
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      borderRadius: 13,
      padding: 14,
    },

    paymentStatLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: '#8793A6',
    },

    paymentStatValue: {
      marginTop: 5,
      fontFamily: 'Inter_700Bold',
      fontSize: 18,
      color: '#356DFF',
    },

    loadingPayments: {
      padding: 35,
      alignItems: 'center',
    },

    loadingText: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#78859A',
    },

    emptyPayment: {
      padding: 32,
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#E3E8F1',
    },

    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 15,
      backgroundColor: '#EAF0FF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 25,
      color: '#356DFF',
    },

    emptyTitle: {
      marginTop: 11,
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      color: '#172033',
    },

    emptyText: {
      marginTop: 7,
      maxWidth: 560,
      textAlign: 'center',
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#78859A',
    },

    paymentCard: {
      marginBottom: 10,
      padding: 16,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      shadowColor: '#1D2A44',
      shadowOpacity: 0.025,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    paymentCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    paymentDate: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#33415A',
    },

    paymentInstallment: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#8793A6',
    },

    paymentAmountArea: {
      alignItems: 'flex-end',
    },

    paymentAmount: {
      fontFamily: 'Inter_700Bold',
      fontSize: 18,
      color: '#172033',
    },

    paymentStatus: {
      marginTop: 4,
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      color: '#18A673',
    },

    paymentBreakdown: {
      flexDirection: 'row',
      gap: 20,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#EEF1F6',
    },

    breakdownText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#78859A',
    },

    notesText: {
      marginTop: 9,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 14,
      color: '#66738A',
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
      backgroundColor: '#EAF0FF',
    },

    editPaymentText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#356DFF',
    },

    deletePaymentButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: '#FFF1F0',
    },

    deletePaymentText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#C43D3D',
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
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
    },
    amortizationCardIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#EEF3FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    amortizationCardIconText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 24,
      color: '#356DFF',
    },
    amortizationCardContent: {
      flex: 1,
    },
    amortizationButton: {
      marginLeft: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#356DFF',
      shadowColor: '#356DFF',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    amortizationButtonText: {
      color: '#FFFFFF',
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
    },

    scheduleScroll: {
      width: '100%',
    },

    scheduleTable: {
      minWidth: 760,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#E3E8F1',
    },

    scheduleHeader: {
      flexDirection: 'row',
      backgroundColor: '#EEF3FF',
      paddingVertical: 12,
    },

    scheduleRow: {
      flexDirection: 'row',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: '#EEF1F6',
    },

    scheduleRowPaid: {
      backgroundColor: '#FBFCFE',
    },

    headerCell: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#53627A',
    },

    cell: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#344159',
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
      height: 30,
    },
  });

