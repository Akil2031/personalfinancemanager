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
  TextInput,
  View,
} from 'react-native';

import { Loan } from '../models/loan';

import {
  Payment,
} from '../models/payment';

import {
  addPayment,
  deletePayment,
  getLoanPayments,
  updatePayment,
} from '../services/paymentService';

import {
  generateLoanSchedule,
} from '../engine/loanSchedule';

import {
  allocatePayment,
} from '../engine/paymentCalculator';

interface Props {
  loan: Loan;
  payment?: Payment | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

type PaymentType =
  | 'EMI'
  | 'PARTIAL'
  | 'PREPAYMENT';

function money(value: number): string {
  return Math.round(
    Number(value) || 0
  ).toLocaleString('en-IN');
}

function formatDate(value?: string): string {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function todayString(): string {
  const date = new Date();

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

export default function RecordPaymentScreen({
  loan,
  payment,
  onSaved,
  onCancel,
}: Props) {
  const isEditing =
    Boolean(payment?.id);

  const scheduleResult =
    useMemo(
      () =>
        generateLoanSchedule(
          loan
        ),
      [loan]
    );

  const [
    loanPayments,
    setLoanPayments,
  ] = useState<Payment[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(true);

  const [
    paymentType,
    setPaymentType,
  ] = useState<PaymentType>(
    payment?.status === 'PREPAYMENT'
      ? 'PREPAYMENT'
      : payment?.status === 'PARTIAL'
        ? 'PARTIAL'
        : 'EMI'
  );

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(
    payment?.paymentDate ||
      todayString()
  );

  const [
    installmentNo,
    setInstallmentNo,
  ] = useState(
    payment?.installmentNo
      ? String(
          payment.installmentNo
        )
      : '1'
  );

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState(
    payment?.amount
      ? String(
          Math.round(
            payment.amount
          )
        )
      : String(
          Math.round(
            loan.emi
          )
        )
  );

  const [
    notes,
    setNotes,
  ] = useState(
    payment?.notes || ''
  );

  const selectedInstallment =
    scheduleResult.schedule[
      Math.max(
        0,
        Number(installmentNo) - 1
      )
    ];

  /*
   * -------------------------------------------------------
   * LOAD PAYMENT HISTORY
   * -------------------------------------------------------
   */

  async function loadHistory() {
    try {
      setHistoryLoading(true);

      const data =
        await getLoanPayments(
          loan.id!
        );

      setLoanPayments(
        data
      );
    } catch (error) {
      console.error(
        'Payment history failed:',
        error
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (loan.id) {
      void loadHistory();
    }
  }, [loan.id]);

  /*
   * -------------------------------------------------------
   * PAYMENT CALCULATION
   * -------------------------------------------------------
   */

  const allocation =
  paymentType === 'PARTIAL' ||
  paymentType === 'PREPAYMENT'
    ? {
        amount:
          Math.round(
            Number(paymentAmount) || 0
          ),

        interest: 0,

        principal:
          Math.round(
            Math.max(
              0,
              Number(paymentAmount) || 0
            )
          ),
      }
    : selectedInstallment &&
        Number(paymentAmount) > 0
      ? allocatePayment(
          Number(paymentAmount),
          selectedInstallment
        )
      : null;

  /*
   * -------------------------------------------------------
   * SAVE
   * -------------------------------------------------------
   */

  async function handleSave() {
    try {
      if (!loan.id) {
        Alert.alert(
          'Error',
          'This loan does not have a valid ID.'
        );
        return;
      }

      const amount =
        Number(
          paymentAmount
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        Alert.alert(
          'Validation',
          'Enter a valid payment amount.'
        );
        return;
      }

      if (!paymentDate) {
        Alert.alert(
          'Validation',
          'Payment date is required.'
        );
        return;
      }

      if (
        paymentType !== 'PREPAYMENT' &&
        !selectedInstallment
      ) {
        Alert.alert(
          'Validation',
          'Invalid installment number.'
        );
        return;
      }

      if (!allocation) {
        Alert.alert(
          'Validation',
          'Unable to calculate payment.'
        );
        return;
      }

      setLoading(true);

      const status =
        paymentType === 'PREPAYMENT'
          ? 'PREPAYMENT'
          : amount >=
              Number(
                selectedInstallment?.emi ||
                  0
              )
            ? 'PAID'
            : 'PARTIAL';

      const data: Payment = {
        id:
          payment?.id,

        loanId:
          loan.id,

        installmentNo:
          paymentType === 'PREPAYMENT'
            ? undefined
            : Number(
                installmentNo
              ),

        paymentDate,

        amount:
          Math.round(
            allocation.amount
          ),

        principal:
          Math.round(
            allocation.principal
          ),

        interest:
          Math.round(
            allocation.interest
          ),

        status,

        notes:
          notes.trim(),
      };

      if (
        isEditing &&
        payment?.id
      ) {
        await updatePayment(
          payment.id,
          data
        );

        Alert.alert(
          'Payment Updated',
          'Payment has been updated successfully.'
        );
      } else {
        await addPayment(
          data
        );

        Alert.alert(
          'Payment Saved',
          'Payment has been recorded successfully.'
        );
      }

      await loadHistory();

      onSaved?.();

    } catch (error) {
      console.error(
        'Payment save failed:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save payment.';

      if (
        Platform.OS === 'web'
      ) {
        window.alert(
          message
        );
      } else {
        Alert.alert(
          'Error',
          message
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /*
   * -------------------------------------------------------
   * DELETE
   * -------------------------------------------------------
   */

  async function performDelete() {
    if (!payment?.id) {
      return;
    }

    try {
      setLoading(true);

      await deletePayment(
        payment.id
      );

      Alert.alert(
        'Payment Deleted',
        'Payment has been deleted successfully.'
      );

      onSaved?.();

    } catch (error) {
      console.error(
        'Delete payment failed:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete payment.';

      if (
        Platform.OS === 'web'
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
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete() {
    if (!payment?.id) {
      return;
    }

    if (
      Platform.OS === 'web'
    ) {
      const confirmed =
        window.confirm(
          'Are you sure you want to delete this payment?'
        );

      if (confirmed) {
        void performDelete();
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
            void performDelete();
          },
        },
      ]
    );
  }

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.title}>
            {isEditing
              ? 'Edit Payment'
              : 'Record Payment'}
          </Text>

          <Text style={styles.subtitle}>
            {loan.loanName}
          </Text>

          <Text style={styles.lender}>
            {loan.lender}
          </Text>
        </View>

        {onCancel && (
          <Pressable
            style={
              styles.cancelButton
            }
            onPress={
              onCancel
            }
          >
            <Text
              style={
                styles.cancelText
              }
            >
              Cancel
            </Text>
          </Pressable>
        )}
      </View>

      {/* LOAN */}

      <View style={styles.loanCard}>
        <View
          style={styles.loanIcon}
        >
          <Text
            style={
              styles.loanIconText
            }
          >
            ₹
          </Text>
        </View>

        <View
          style={
            styles.loanCardInfo
          }
        >
          <Text
            style={
              styles.loanCardLabel
            }
          >
            Payment for
          </Text>

          <Text
            style={
              styles.loanCardName
            }
          >
            {loan.loanName}
          </Text>

          <Text
            style={
              styles.loanCardLender
            }
          >
            {loan.lender}
          </Text>
        </View>

        <View
          style={
            styles.loanOutstanding
          }
        >
          <Text
            style={
              styles.loanOutstandingLabel
            }
          >
            Outstanding
          </Text>

          <Text
            style={
              styles.loanOutstandingValue
            }
          >
            ₹
            {money(
              loan.currentOutstanding
            )}
          </Text>
        </View>
      </View>

      {/* PAYMENT TYPE */}

      <View
        style={
          styles.section
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Payment Type
        </Text>

        <View
          style={
            styles.typeRow
          }
        >
          <PaymentTypeButton
            label="EMI Payment"
            active={
              paymentType ===
              'EMI'
            }
            onPress={() =>
              setPaymentType(
                'EMI'
              )
            }
          />

          <PaymentTypeButton
            label="Part Payment"
            active={
              paymentType ===
              'PARTIAL'
            }
            onPress={() =>
              setPaymentType(
                'PARTIAL'
              )
            }
          />

          <PaymentTypeButton
            label="Prepayment"
            active={
              paymentType ===
              'PREPAYMENT'
            }
            onPress={() =>
              setPaymentType(
                'PREPAYMENT'
              )
            }
          />
        </View>
      </View>

      {/* INSTALLMENT */}

      {paymentType !==
        'PREPAYMENT' && (
        <View
          style={
            styles.field
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Installment Number
          </Text>

          <TextInput
            style={
              styles.input
            }
            value={
              installmentNo
            }
            onChangeText={
              setInstallmentNo
            }
            keyboardType="numeric"
            placeholder="1"
          />

          {selectedInstallment && (
            <Text
              style={
                styles.helper
              }
            >
              Scheduled EMI:{' '}
              ₹
              {money(
                selectedInstallment.emi
              )}{' '}
              • Due{' '}
              {formatDate(
                selectedInstallment.dueDate.toISOString()
              )}
            </Text>
          )}
        </View>
      )}

      {/* DATE */}

      <View
        style={
          styles.field
        }
      >
        <Text
          style={
            styles.label
          }
        >
          Payment Date
        </Text>

        <TextInput
          style={
            styles.input
          }
          value={
            paymentDate
          }
          onChangeText={
            setPaymentDate
          }
          placeholder="YYYY-MM-DD"
        />

        <Text
          style={
            styles.helper
          }
        >
          Example: 2026-09-05
        </Text>
      </View>

      {/* AMOUNT */}

      <View
        style={
          styles.field
        }
      >
        <Text
          style={
            styles.label
          }
        >
          Payment Amount
        </Text>

        <View
          style={
            styles.amountInputWrapper
          }
        >
          <Text
            style={
              styles.currency
            }
          >
            ₹
          </Text>

          <TextInput
            style={
              styles.amountInput
            }
            value={
              paymentAmount
            }
            onChangeText={
              setPaymentAmount
            }
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
      </View>

      {/* ALLOCATION */}

      {allocation && (
        <View
          style={
            styles.allocationCard
          }
        >
          <View
            style={
              styles.allocationHeader
            }
          >
            <View>
              <Text
                style={
                  styles.allocationTitle
                }
              >
                Payment Breakdown
              </Text>

              <Text
                style={
                  styles.allocationSubtitle
                }
              >
                {paymentType ===
                'PREPAYMENT'
                  ? 'Amount applied directly to principal'
                  : 'Interest is satisfied first, then principal'}
              </Text>
            </View>

            <View
              style={
                styles.amountBadge
              }
            >
              <Text
                style={
                  styles.amountBadgeText
                }
              >
                ₹
                {money(
                  allocation.amount
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.breakdownRow
            }
          >
            <Text
              style={
                styles.breakdownLabel
              }
            >
              Interest
            </Text>

            <Text
              style={
                styles.breakdownValue
              }
            >
              ₹
              {money(
                allocation.interest
              )}
            </Text>
          </View>

          <View
            style={
              styles.breakdownRow
            }
          >
            <Text
              style={
                styles.breakdownLabel
              }
            >
              Principal
            </Text>

            <Text
              style={
                styles.breakdownValue
              }
            >
              ₹
              {money(
                allocation.principal
              )}
            </Text>
          </View>

          {selectedInstallment &&
            paymentType !==
              'PREPAYMENT' && (
              <>
                <View
                  style={
                    styles.breakdownDivider
                  }
                />

                <View
                  style={
                    styles.breakdownRow
                  }
                >
                  <Text
                    style={
                      styles.totalLabel
                    }
                  >
                    Scheduled EMI
                  </Text>

                  <Text
                    style={
                      styles.totalValue
                    }
                  >
                    ₹
                    {money(
                      selectedInstallment.emi
                    )}
                  </Text>
                </View>
              </>
            )}
        </View>
      )}

      {/* NOTES */}

      <View
        style={
          styles.field
        }
      >
        <Text
          style={
            styles.label
          }
        >
          Notes
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.notes,
          ]}
          value={
            notes
          }
          onChangeText={
            setNotes
          }
          placeholder="Optional notes"
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* ACTIONS */}

      <View
        style={
          styles.actionRow
        }
      >
        {isEditing && (
          <Pressable
            style={
              styles.deleteButton
            }
            onPress={
              confirmDelete
            }
            disabled={
              loading
            }
          >
            <Text
              style={
                styles.deleteText
              }
            >
              Delete
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.saveButton,
            loading &&
              styles.disabledButton,
          ]}
          onPress={
            handleSave
          }
          disabled={
            loading
          }
        >
          {loading ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.saveText
              }
            >
              {isEditing
                ? 'Update Payment'
                : 'Save Payment'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* HISTORY */}

      <View
        style={
          styles.historySection
        }
      >
        <View
          style={
            styles.historyHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Payment History
            </Text>

            <Text
              style={
                styles.historySubtitle
              }
            >
              Payments recorded for this loan
            </Text>
          </View>

          <Text
            style={
              styles.historyCount
            }
          >
            {loanPayments.length}
          </Text>
        </View>

        {historyLoading ? (
          <View
            style={
              styles.historyLoading
            }
          >
            <ActivityIndicator
              color="#16803A"
            />
          </View>
        ) : loanPayments.length ===
          0 ? (
          <View
            style={
              styles.emptyHistory
            }
          >
            <Text
              style={
                styles.emptyHistoryIcon
              }
            >
              ₹
            </Text>

            <Text
              style={
                styles.emptyHistoryTitle
              }
            >
              No payments recorded
            </Text>

            <Text
              style={
                styles.emptyHistoryText
              }
            >
              Your payment history will appear here.
            </Text>
          </View>
        ) : (
          loanPayments.map(
            item => (
              <PaymentHistoryRow
                key={
                  item.id
                }
                payment={
                  item
                }
              />
            )
          )
        )}
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
 * PAYMENT TYPE BUTTON
 * =========================================================
 */

function PaymentTypeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.typeButton,
        active &&
          styles.typeButtonActive,
      ]}
      onPress={
        onPress
      }
    >
      <Text
        style={[
          styles.typeButtonText,
          active &&
            styles.typeButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/*
 * =========================================================
 * HISTORY ROW
 * =========================================================
 */

function PaymentHistoryRow({
  payment,
}: {
  payment: Payment;
}) {
  const statusStyle =
    payment.status ===
    'PREPAYMENT'
      ? styles.statusPrepayment
      : payment.status ===
          'PARTIAL'
        ? styles.statusPartial
        : styles.statusPaid;

  const statusTextStyle =
    payment.status ===
    'PREPAYMENT'
      ? styles.statusPrepaymentText
      : payment.status ===
          'PARTIAL'
        ? styles.statusPartialText
        : styles.statusPaidText;

  return (
    <View
      style={
        styles.historyCard
      }
    >
      <View
        style={
          styles.historyMain
        }
      >
        <View>
          <Text
            style={
              styles.historyDate
            }
          >
            {formatDate(
              payment.paymentDate
            )}
          </Text>

          <Text
            style={
              styles.historyInstallment
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
            styles.historyAmountContainer
          }
        >
          <Text
            style={
              styles.historyAmount
            }
          >
            ₹
            {money(
              payment.amount
            )}
          </Text>

          <View
            style={[
              styles.statusBadge,
              statusStyle,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                statusTextStyle,
              ]}
            >
              {payment.status}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={
          styles.historyBreakdown
        }
      >
        <Text
          style={
            styles.historyBreakdownText
          }
        >
          Principal ₹
          {money(
            payment.principal
          )}
        </Text>

        <Text
          style={
            styles.historyBreakdownText
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
            styles.historyNotes
          }
        >
          {payment.notes}
        </Text>
      ) : null}
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
      paddingTop: 25,
      paddingBottom: 40,
    },

    topHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: '800',
      color: '#17221B',
    },

    subtitle: {
      marginTop: 5,
      fontSize: 14,
      fontWeight: '700',
      color: '#334139',
    },

    lender: {
      marginTop: 2,
      fontSize: 11,
      color: '#78847D',
    },

    cancelButton: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
    },

    cancelText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#536159',
    },

    loanCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 15,
      padding: 17,
      marginBottom: 22,
    },

    loanIcon: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor:
        '#EAF4ED',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loanIconText: {
      fontSize: 20,
      fontWeight: '800',
      color: '#16803A',
    },

    loanCardInfo: {
      flex: 1,
      marginLeft: 13,
    },

    loanCardLabel: {
      fontSize: 9,
      color: '#89948E',
    },

    loanCardName: {
      marginTop: 2,
      fontSize: 14,
      fontWeight: '800',
      color: '#17221B',
    },

    loanCardLender: {
      marginTop: 2,
      fontSize: 10,
      color: '#78847D',
    },

    loanOutstanding: {
      alignItems:
        'flex-end',
    },

    loanOutstandingLabel: {
      fontSize: 9,
      color: '#89948E',
    },

    loanOutstandingValue: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: '800',
      color: '#16803A',
    },

    section: {
      marginBottom: 20,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: '#17221B',
    },

    typeRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 8,
      marginTop: 10,
    },

    typeButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 9,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
    },

    typeButtonActive: {
      backgroundColor:
        '#16803A',
      borderColor:
        '#16803A',
    },

    typeButtonText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#66736B',
    },

    typeButtonTextActive: {
      color: '#FFFFFF',
    },

    field: {
      marginBottom: 18,
    },

    label: {
      marginBottom: 7,
      fontSize: 11,
      fontWeight: '800',
      color: '#334139',
    },

    input: {
      minHeight: 45,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
      borderRadius: 9,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 13,
      color: '#17221B',
    },

    helper: {
      marginTop: 5,
      fontSize: 10,
      color: '#89948E',
    },

    amountInputWrapper: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
      borderRadius: 9,
      minHeight: 50,
    },

    currency: {
      marginLeft: 14,
      fontSize: 18,
      fontWeight: '800',
      color: '#16803A',
    },

    amountInput: {
      flex: 1,
      paddingHorizontal: 10,
      fontSize: 19,
      fontWeight: '800',
      color: '#17221B',
    },

    allocationCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        '#DCE8DF',
      padding: 18,
      marginBottom: 20,
    },

    allocationHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 15,
    },

    allocationTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#17221B',
    },

    allocationSubtitle: {
      marginTop: 3,
      fontSize: 9,
      color: '#89948E',
    },

    amountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor:
        '#EAF4ED',
    },

    amountBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#16803A',
    },

    breakdownRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      paddingVertical: 8,
    },

    breakdownLabel: {
      fontSize: 11,
      color: '#68756D',
    },

    breakdownValue: {
      fontSize: 11,
      fontWeight: '700',
      color: '#27322C',
    },

    breakdownDivider: {
      height: 1,
      backgroundColor:
        '#EDF1EE',
      marginVertical: 6,
    },

    totalLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#17221B',
    },

    totalValue: {
      fontSize: 12,
      fontWeight: '800',
      color: '#16803A',
    },

    notes: {
      minHeight: 90,
    },

    actionRow: {
      flexDirection:
        'row',
      gap: 10,
      marginTop: 2,
    },

    saveButton: {
      flex: 1,
      minHeight: 47,
      borderRadius: 9,
      backgroundColor:
        '#16803A',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    saveText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },

    deleteButton: {
      paddingHorizontal: 22,
      minHeight: 47,
      borderRadius: 9,
      backgroundColor:
        '#FFF0EE',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    deleteText: {
      color: '#C0392B',
      fontSize: 12,
      fontWeight: '800',
    },

    disabledButton: {
      opacity: 0.6,
    },

    historySection: {
      marginTop: 34,
    },

    historyHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 13,
    },

    historySubtitle: {
      marginTop: 3,
      fontSize: 10,
      color: '#89948E',
    },

    historyCount: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#EAF4ED',
      textAlign: 'center',
      textAlignVertical:
        'center',
      paddingTop: 7,
      fontSize: 11,
      fontWeight: '800',
      color: '#16803A',
    },

    historyLoading: {
      padding: 30,
      alignItems:
        'center',
    },

    emptyHistory: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 14,
      padding: 30,
      alignItems:
        'center',
    },

    emptyHistoryIcon: {
      width: 46,
      height: 46,
      borderRadius: 13,
      backgroundColor:
        '#EAF4ED',
      textAlign: 'center',
      textAlignVertical:
        'center',
      paddingTop: 10,
      fontSize: 19,
      fontWeight: '800',
      color: '#16803A',
    },

    emptyHistoryTitle: {
      marginTop: 10,
      fontSize: 14,
      fontWeight: '800',
      color: '#17221B',
    },

    emptyHistoryText: {
      marginTop: 5,
      fontSize: 10,
      color: '#89948E',
    },

    historyCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 13,
      padding: 15,
      marginBottom: 9,
    },

    historyMain: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    historyDate: {
      fontSize: 11,
      fontWeight: '700',
      color: '#334139',
    },

    historyInstallment: {
      marginTop: 4,
      fontSize: 10,
      color: '#89948E',
    },

    historyAmountContainer: {
      alignItems:
        'flex-end',
    },

    historyAmount: {
      fontSize: 15,
      fontWeight: '800',
      color: '#17221B',
    },

    statusBadge: {
      marginTop: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },

    statusPaid: {
      backgroundColor:
        '#E8F6EC',
    },

    statusPartial: {
      backgroundColor:
        '#FFF4DD',
    },

    statusPrepayment: {
      backgroundColor:
        '#EAF0FF',
    },

    statusText: {
      fontSize: 8,
      fontWeight: '800',
    },

    statusPaidText: {
      color: '#16803A',
    },

    statusPartialText: {
      color: '#A66A00',
    },

    statusPrepaymentText: {
      color: '#315DA8',
    },

    historyBreakdown: {
      flexDirection:
        'row',
      gap: 18,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        '#EDF1EE',
    },

    historyBreakdownText: {
      fontSize: 9,
      color: '#78847D',
    },

    historyNotes: {
      marginTop: 9,
      fontSize: 9,
      color: '#66736B',
      fontStyle: 'italic',
    },

    bottomSpace: {
      height: 30,
    },
  });