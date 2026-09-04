import React, {
  useCallback,
  useEffect,
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
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';



import {
  Loan,
} from '../models/loan';

import {
  Payment,
} from '../models/payment';

import {
  getLoans,
} from '../services/loanService';

import {
  addPayment,
  deletePayment,
  getAllPayments,
  updatePayment,
} from '../services/paymentService';

import {
  EMIScheduleRow,
} from '../engine/emiCalculator';

import {
  allocatePayment,
} from '../engine/paymentCalculator';

type AmortizationEntry = {
  installmentNo: number;
  dueDate: string;
  emi: number;
  principal: number;
  interest: number;
  openingBalance: number;
  closingBalance: number;
};

type PaymentFormMode = 'ADD' | 'EDIT';

type PaymentType =
  | 'PAID'
  | 'PARTIAL'
  | 'PREPAYMENT';

function formatAmount(value: number): string {
  return Math.round(
    Number(value) || 0
  ).toLocaleString('en-IN');
}

function formatDate(
  value?: string
): string {
  if (!value) {
    return '-';
  }

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

function todayString(): string {
  return new Date()
    .toISOString()
    .split('T')[0];
}

function getPaymentType(
  amount: number,
  scheduledEmi: number
): PaymentType {
  if (
    amount > 0 &&
    scheduledEmi > 0 &&
    amount < scheduledEmi
  ) {
    return 'PARTIAL';
  }

  if (
    amount > 0 &&
    scheduledEmi > 0 &&
    amount > scheduledEmi
  ) {
    return 'PREPAYMENT';
  }

  return 'PAID';
}

function getLoanName(
  loans: Loan[],
  loanId: string
): string {
  return (
    loans.find(
      loan =>
        loan.id === loanId
    )?.loanName ||
    'Unknown Loan'
  );
}


function getFutureScheduleRow(
  schedule: EMIScheduleRow[]
): EMIScheduleRow | null {
  if (!schedule.length) return null;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return (
    schedule.find(row => {
      const due = new Date(row.dueDate);
      due.setHours(23, 59, 59, 999);
      return due.getTime() > today.getTime();
    }) ||
    schedule[schedule.length - 1] ||
    null
  );
}

function getScheduledInstallment(
  loan: Loan,
  authoritativeSchedule: AmortizationEntry[],
  editingPayment?: Payment | null
): EMIScheduleRow | null {
  if (authoritativeSchedule.length) {
    if (editingPayment?.installmentNo) {
      const editingRow = authoritativeSchedule.find(
        entry =>
          Number(entry.installmentNo) ===
          Number(editingPayment.installmentNo)
      );

      if (editingRow) {
        return {
          installmentNo: Number(editingRow.installmentNo),
          dueDate: new Date(editingRow.dueDate),
          emi: Number(editingRow.emi) || 0,
          principal: Number(editingRow.principal) || 0,
          interest: Number(editingRow.interest) || 0,
          openingBalance: Number(editingRow.openingBalance) || 0,
          closingBalance: Number(editingRow.closingBalance) || 0,
        };
      }
    }

    return getFutureScheduleRow(
      authoritativeSchedule.map(entry => ({
        installmentNo: Number(entry.installmentNo),
        dueDate: new Date(entry.dueDate),
        emi: Number(entry.emi) || 0,
        principal: Number(entry.principal) || 0,
        interest: Number(entry.interest) || 0,
        openingBalance: Number(entry.openingBalance) || 0,
        closingBalance: Number(entry.closingBalance) || 0,
      }))
    );
  }

  // A lender schedule is required when no authoritative schedule
  // has been saved. Avoid importing the removed legacy scheduler.
  void loan;
  return null;
}

export default function PaymentsRoute() {
  const [
    loans,
    setLoans,
  ] = useState<Loan[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    formMode,
    setFormMode,
  ] = useState<PaymentFormMode>(
    'ADD'
  );

  const [
    editingPayment,
    setEditingPayment,
  ] = useState<Payment | null>(
    null
  );


  const [
    authoritativeSchedule,
    setAuthoritativeSchedule,
  ] = useState<AmortizationEntry[]>([]);

  const [
    scheduleLoading,
    setScheduleLoading,
  ] = useState(false);

  const [
    selectedLoanId,
    setSelectedLoanId,
  ] = useState('');

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(
    todayString()
  );

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState('');

  const [
    notes,
    setNotes,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const loadData =
    useCallback(
      async () => {
        try {
          const [
            loanData,
            paymentData,
          ] = await Promise.all([
            getLoans(),
            getAllPayments(),
          ]);

          setLoans(
            loanData
          );

          setPayments(
            paymentData
          );
        } catch (error) {
          console.error(
            'Unable to load payments:',
            error
          );

          Alert.alert(
            'Error',
            error instanceof Error
              ? error.message
              : 'Unable to load payments.'
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
  }

  const selectedLoan =
    useMemo(
      () =>
        loans.find(
          loan =>
            loan.id ===
            selectedLoanId
        ) || null,
      [
        loans,
        selectedLoanId,
      ]
    );


  useEffect(() => {
    let cancelled = false;

    async function loadAuthoritativeSchedule() {
      if (!selectedLoan?.id) {
        setAuthoritativeSchedule([]);
        setScheduleLoading(false);
        return;
      }

      setScheduleLoading(true);

      // The amortization service is not available in this build.
      // Keep the schedule empty until an authoritative schedule is supplied.
      if (!cancelled) {
        setAuthoritativeSchedule([]);
        setScheduleLoading(false);
      }
    }

    void loadAuthoritativeSchedule();

    return () => {
      cancelled = true;
    };
  }, [selectedLoan]);

  const scheduledInstallment =
    useMemo(
      () =>
        selectedLoan
          ? getScheduledInstallment(
              selectedLoan,
              authoritativeSchedule,
              editingPayment
            )
          : null,
      [
        selectedLoan,
        authoritativeSchedule,
        editingPayment,
      ]
    );

  const numericAmount =
    Number(
      paymentAmount
    ) || 0;

  const scheduledEmi =
    scheduledInstallment
      ? Number(
          scheduledInstallment.emi
        ) || 0
      : 0;

  const paymentType =
    getPaymentType(
      numericAmount,
      scheduledEmi
    );

  const allocation =
    useMemo(() => {
      if (
        numericAmount <= 0 ||
        !selectedLoan
      ) {
        return null;
      }

      /*
       * PARTIAL and PREPAYMENT are
       * principal-only.
       */
      if (
        paymentType ===
          'PARTIAL' ||
        paymentType ===
          'PREPAYMENT'
      ) {
        return {
          amount:
            Math.round(
              numericAmount
            ),
          principal:
            Math.round(
              numericAmount
            ),
          interest: 0,
        };
      }

      if (
        !scheduledInstallment
      ) {
        return null;
      }

      // When the payment equals the lender's scheduled EMI,
      // use the authoritative lender principal/interest split
      // exactly. Do not recalculate it with a generic formula.
      if (
        scheduledInstallment &&
        Math.round(numericAmount) ===
          Math.round(
            Number(scheduledInstallment.emi) || 0
          )
      ) {
        return {
          amount: Math.round(numericAmount),
          principal: Math.round(
            Number(scheduledInstallment.principal) || 0
          ),
          interest: Math.round(
            Number(scheduledInstallment.interest) || 0
          ),
        };
      }

      // Legacy fallback when no authoritative lender row exists.
      return allocatePayment(
        numericAmount,
        scheduledInstallment
      );
    }, [
      numericAmount,
      paymentType,
      selectedLoan,
      scheduledInstallment,
    ]);

  const totalPaid =
    useMemo(
      () =>
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.amount || 0
            ),
          0
        ),
      [payments]
    );

  const totalPrincipal =
    useMemo(
      () =>
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.principal ||
                0
            ),
          0
        ),
      [payments]
    );

  const totalInterest =
    useMemo(
      () =>
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.interest ||
                0
            ),
          0
        ),
      [payments]
    );

  const filteredPayments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return payments.filter(
        payment => {
          if (!query) {
            return true;
          }

          const loanName =
            getLoanName(
              loans,
              payment.loanId
            ).toLowerCase();

          return (
            loanName.includes(
              query
            ) ||
            payment.status
              .toLowerCase()
              .includes(query) ||
            payment.paymentDate
              .toLowerCase()
              .includes(query) ||
            String(
              payment.amount
            ).includes(query)
          );
        }
      );
    }, [
      payments,
      loans,
      search,
    ]);

  function resetForm() {
    setSelectedLoanId('');
    setPaymentDate(
      todayString()
    );
    setPaymentAmount('');
    setNotes('');
    setEditingPayment(null);
    setFormMode('ADD');
    setShowForm(false);
  }

  function openAddPayment() {
    setFormMode('ADD');
    setEditingPayment(null);

    setSelectedLoanId(
      loans[0]?.id || ''
    );

    setPaymentDate(
      todayString()
    );

    setPaymentAmount('');

    setNotes('');

    setShowForm(true);
  }

  function openEditPayment(
    payment: Payment
  ) {
    if (!payment.id) {
      Alert.alert(
        'Edit Failed',
        'Payment ID is missing.'
      );
      return;
    }

    setFormMode('EDIT');

    setEditingPayment(
      payment
    );

    setSelectedLoanId(
      payment.loanId
    );

    setPaymentDate(
      payment.paymentDate
    );

    setPaymentAmount(
      String(
        Math.round(
          Number(
            payment.amount
          ) || 0
        )
      )
    );

    setNotes(
      payment.notes || ''
    );

    setShowForm(true);
  }

  async function handleSave() {
    try {
      if (
        !selectedLoanId
      ) {
        Alert.alert(
          'Validation',
          'Please select a loan.'
        );
        return;
      }

      const loan =
        loans.find(
          item =>
            item.id ===
            selectedLoanId
        );

      if (!loan) {
        Alert.alert(
          'Validation',
          'Selected loan was not found.'
        );
        return;
      }

      if (
        !paymentDate.trim()
      ) {
        Alert.alert(
          'Validation',
          'Please enter the payment date.'
        );
        return;
      }

      const parsedDate =
        new Date(
          paymentDate.trim()
        );

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        Alert.alert(
          'Validation',
          'Please enter a valid payment date.'
        );
        return;
      }

      if (
        numericAmount <= 0
      ) {
        Alert.alert(
          'Validation',
          'Payment amount must be greater than zero.'
        );
        return;
      }

      if (
        !allocation
      ) {
        Alert.alert(
          'Payment',
          'Unable to calculate the payment allocation.'
        );
        return;
      }

      setSaving(true);

      const status =
        paymentType;

      /*
       * When editing a payment, preserve its
       * installment number if available.
       * For a new payment use the next scheduled EMI.
       */
      const installmentNo =
        editingPayment?.installmentNo ??
        scheduledInstallment?.installmentNo;

      const payload: Payment = {
        loanId:
          selectedLoanId,

        installmentNo,

        paymentDate:
          paymentDate.trim(),

        amount:
          Math.round(
            allocation.amount
          ),

        /*
         * PARTIAL/PREPAYMENT are
         * always principal-only.
         */
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
        formMode === 'EDIT' &&
        editingPayment?.id
      ) {
        await updatePayment(
          editingPayment.id,
          payload
        );
      } else {
        await addPayment(
          payload
        );
      }

      await loadData();

      Alert.alert(
        formMode === 'EDIT'
          ? 'Payment Updated'
          : 'Payment Saved',
        formMode === 'EDIT'
          ? 'The payment has been updated successfully.'
          : 'The payment has been recorded successfully.'
      );

      resetForm();

    } catch (error) {
      console.error(
        'Payment save failed:',
        error
      );

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to save payment.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(
    payment: Payment
  ) {
    if (!payment.id) {
      Alert.alert(
        'Delete Failed',
        'Payment ID is missing.'
      );
      return;
    }

    try {
      setSaving(true);

      await deletePayment(
        payment.id
      );

      setPayments(
        current =>
          current.filter(
            item =>
              item.id !==
              payment.id
          )
      );

      /*
       * Reload so all totals and loan
       * relationships are guaranteed current.
       */
      await loadData();

      if (
        Platform.OS === 'web'
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

      if (
        Platform.OS === 'web'
      ) {
        window.alert(
          error instanceof Error
            ? error.message
            : 'Unable to delete payment.'
        );
      } else {
        Alert.alert(
          'Delete Failed',
          error instanceof Error
            ? error.message
            : 'Unable to delete payment.'
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(
    payment: Payment
  ) {
    if (!payment.id) {
      Alert.alert(
        'Delete Failed',
        'Payment ID is missing.'
      );
      return;
    }

    const message =
      `Are you sure you want to delete this payment of ₹${formatAmount(
        Number(
          payment.amount
        ) || 0
      )}?`;

    if (
      Platform.OS === 'web'
    ) {
      const confirmed =
        window.confirm(
          message
        );

      if (confirmed) {
        void performDelete(
          payment
        );
      }

      return;
    }

    Alert.alert(
      'Delete Payment',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            void performDelete(
              payment
            ),
        },
      ]
    );
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
     
    );
  }

  return (
    
      <View
        style={
          styles.container
        }
      >
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
              tintColor="#356DFF"
            />
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
              styles.pageHeader
            }
          >
            <View>
              <Text
                style={
                  styles.title
                }
              >
                Payments
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                Record and manage all loan payments
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.addButton
              }
              onPress={
                openAddPayment
              }
              activeOpacity={0.85}
            >
              <Text
                style={
                  styles.addButtonText
                }
              >
                + Add Payment
              </Text>
            </TouchableOpacity>
          </View>

          {/* SUMMARY */}

          <View
            style={
              styles.summaryRow
            }
          >
            <SummaryCard
              label="Total Paid"
              value={`₹${formatAmount(
                totalPaid
              )}`}
            />

            <SummaryCard
              label="Principal"
              value={`₹${formatAmount(
                totalPrincipal
              )}`}
            />

            <SummaryCard
              label="Interest"
              value={`₹${formatAmount(
                totalInterest
              )}`}
            />

            <SummaryCard
              label="Payments"
              value={String(
                payments.length
              )}
            />
          </View>

          {/* FORM */}

          {showForm && (
            <View
              style={
                styles.formCard
              }
            >
              <View
                style={
                  styles.formHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.formTitle
                    }
                  >
                    {formMode ===
                    'EDIT'
                      ? 'Edit Payment'
                      : 'Record Payment'}
                  </Text>

                  <Text
                    style={
                      styles.formSubtitle
                    }
                  >
                    Select the loan and enter the amount actually paid
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={
                    resetForm
                  }
                  style={
                    styles.closeButton
                  }
                >
                  <Text
                    style={
                      styles.closeButtonText
                    }
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {/* LOAN */}

              <Text
                style={
                  styles.label
                }
              >
                Select Loan
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.loanSelector
                }
              >
                {loans.map(
                  loan => {
                    const active =
                      selectedLoanId ===
                      loan.id;

                    return (
                      <Pressable
                        key={
                          loan.id
                        }
                        style={[
                          styles.loanOption,
                          active &&
                            styles.loanOptionActive,
                        ]}
                        onPress={() =>
                          setSelectedLoanId(
                            loan.id || ''
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.loanOptionName,
                            active &&
                              styles.loanOptionNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {
                            loan.loanName
                          }
                        </Text>

                        <Text
                          style={[
                            styles.loanOptionLender,
                            active &&
                              styles.loanOptionLenderActive,
                          ]}
                          numberOfLines={1}
                        >
                          {
                            loan.lender
                          }
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </ScrollView>

              {/* DATE */}

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
                placeholderTextColor="#9AA59E"
              />

              {/* AMOUNT */}

              <Text
                style={
                  styles.label
                }
              >
                Payment Amount
              </Text>

              <View
                style={
                  styles.amountContainer
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
                  placeholder="Enter amount"
                  placeholderTextColor="#9AA59E"
                />
              </View>

              {/* SCHEDULED EMI */}

              {scheduleLoading ? (
                <View style={styles.scheduleLoadingRow}>
                  <ActivityIndicator size="small" color="#356DFF" />
                  <Text style={styles.scheduleLoadingText}>Loading lender schedule...</Text>
                </View>
              ) : scheduledEmi >
                0 && (
                <View
                  style={
                    styles.scheduledRow
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.scheduledLabel
                      }
                    >
                      Scheduled EMI
                    </Text>

                    <Text
                      style={
                        styles.scheduledValue
                      }
                    >
                      ₹
                      {formatAmount(
                        scheduledEmi
                      )}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.useEmiButton
                    }
                    onPress={() =>
                      setPaymentAmount(
                        String(
                          Math.round(
                            scheduledEmi
                          )
                        )
                      )
                    }
                  >
                    <Text
                      style={
                        styles.useEmiText
                      }
                    >
                      Use EMI
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TYPE */}

              {numericAmount >
                0 && (
                <View
                  style={
                    styles.typeCard
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.typeLabel
                      }
                    >
                      Payment Type
                    </Text>

                    <Text
                      style={
                        styles.typeDescription
                      }
                    >
                      {paymentType ===
                      'PAID'
                        ? 'Full scheduled EMI'
                        : paymentType ===
                          'PARTIAL'
                        ? 'Principal-only part payment'
                        : 'Principal-only prepayment'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.typeBadge,
                      paymentType ===
                      'PARTIAL'
                        ? styles.partialBadge
                        : paymentType ===
                          'PREPAYMENT'
                        ? styles.prepaymentBadge
                        : styles.paidBadge,
                    ]}
                  >
                    <Text
                      style={
                        styles.typeBadgeText
                      }
                    >
                      {
                        paymentType
                      }
                    </Text>
                  </View>
                </View>
              )}

              {/* ALLOCATION */}

              {allocation && (
                <View
                  style={
                    styles.allocationCard
                  }
                >
                  <Text
                    style={
                      styles.allocationTitle
                    }
                  >
                    Payment Allocation
                  </Text>

                  <AllocationRow
                    label="Payment"
                    value={
                      allocation.amount
                    }
                    strong
                  />

                  <AllocationRow
                    label="Interest"
                    value={
                      allocation.interest
                    }
                  />

                  <AllocationRow
                    label="Principal"
                    value={
                      allocation.principal
                    }
                    strong
                  />

                  {(
                    paymentType ===
                      'PARTIAL' ||
                    paymentType ===
                      'PREPAYMENT'
                  ) && (
                    <Text
                      style={
                        styles.principalOnlyNote
                      }
                    >
                      This payment is applied 100% to principal.
                    </Text>
                  )}
                </View>
              )}

              {/* NOTES */}

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
                placeholderTextColor="#9AA59E"
                multiline
              />

              {/* ACTIONS */}

              <View
                style={
                  styles.formActions
                }
              >
                <TouchableOpacity
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    resetForm
                  }
                  disabled={
                    saving
                  }
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    saving &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    handleSave
                  }
                  disabled={
                    saving
                  }
                >
                  <Text
                    style={
                      styles.saveButtonText
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : formMode ===
                        'EDIT'
                      ? 'Update Payment'
                      : 'Save Payment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* HISTORY */}

          <View
            style={
              styles.historyCard
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
                    styles.historyTitle
                  }
                >
                  Payment History
                </Text>

                <Text
                  style={
                    styles.historySubtitle
                  }
                >
                  All payments across your loans
                </Text>
              </View>

              <Text
                style={
                  styles.historyCount
                }
              >
                {
                  filteredPayments.length
                }
              </Text>
            </View>

            {/* SEARCH */}

            <TextInput
              style={
                styles.searchInput
              }
              value={
                search
              }
              onChangeText={
                setSearch
              }
              placeholder="Search loan, status, date or amount..."
              placeholderTextColor="#9AA59E"
            />

            {filteredPayments.length ===
            0 ? (
              <View
                style={
                  styles.empty
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
                  No payments recorded yet
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Click “+ Add Payment” to record your first payment.
                </Text>

                <TouchableOpacity
                  style={
                    styles.emptyAddButton
                  }
                  onPress={
                    openAddPayment
                  }
                >
                  <Text
                    style={
                      styles.emptyAddButtonText
                    }
                  >
                    + Add Payment
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={
                  styles.historyList
                }
              >
                {filteredPayments.map(
                  payment => (
                    <PaymentHistoryItem
                      key={
                        payment.id
                      }
                      payment={
                        payment
                      }
                      loanName={getLoanName(
                        loans,
                        payment.loanId
                      )}
                      onEdit={() =>
                        openEditPayment(
                          payment
                        )
                      }
                      onDelete={() =>
                        confirmDelete(
                          payment
                        )
                      }
                    />
                  )
                )}
              </View>
            )}
          </View>

          <View
            style={
              styles.bottomSpace
            }
          />
        </ScrollView>
      </View>
  
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const tone = label === 'Total Paid' ? 'green' : label === 'Principal' ? 'purple' : label === 'Interest' ? 'orange' : 'blue';
  const cardStyle = tone === 'green' ? styles.summaryGreen : tone === 'purple' ? styles.summaryPurple : tone === 'orange' ? styles.summaryOrange : styles.summaryBlue;
  const valueStyle = tone === 'green' ? styles.summaryGreenValue : tone === 'purple' ? styles.summaryPurpleValue : tone === 'orange' ? styles.summaryOrangeValue : styles.summaryBlueValue;

  return (
    <View style={[styles.summaryCard, cardStyle]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function AllocationRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <View
      style={
        styles.allocationRow
      }
    >
      <Text
        style={[
          styles.allocationLabel,
          strong &&
            styles.allocationLabelStrong,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.allocationValue,
          strong &&
            styles.allocationValueStrong,
        ]}
      >
        ₹
        {formatAmount(
          value
        )}
      </Text>
    </View>
  );
}

function PaymentHistoryItem({
  payment,
  loanName,
  onEdit,
  onDelete,
}: {
  payment: Payment;
  loanName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={
        styles.historyItem
      }
    >
      <View
        style={
          styles.historyMain
        }
      >
        <View
          style={
            styles.historyIcon
          }
        >
          <Text
            style={
              styles.historyIconText
            }
          >
            ₹
          </Text>
        </View>

        <View
          style={
            styles.historyInfo
          }
        >
          <View
            style={
              styles.historyTitleRow
            }
          >
            <Text
              style={
                styles.historyLoanName
              }
            >
              {
                loanName
              }
            </Text>

            <View
              style={[
                styles.statusBadge,
                payment.status ===
                  'PARTIAL'
                  ? styles.partialBadge
                  : payment.status ===
                    'PREPAYMENT'
                  ? styles.prepaymentBadge
                  : payment.status ===
                    'PAID'
                  ? styles.paidBadge
                  : styles.missedBadge,
              ]}
            >
              <Text
                style={
                  styles.statusBadgeText
                }
              >
                {
                  payment.status
                }
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.historyDate
            }
          >
            {formatDate(
              payment.paymentDate
            )}

            {payment.installmentNo
              ? `  •  EMI #${payment.installmentNo}`
              : ''}
          </Text>

          <Text
            style={
              styles.breakdown
            }
          >
            Principal ₹
            {formatAmount(
              Number(
                payment.principal
              ) || 0
            )}

            {'  •  '}

            Interest ₹
            {formatAmount(
              Number(
                payment.interest
              ) || 0
            )}
          </Text>

          {payment.notes ? (
            <Text
              style={
                styles.notesText
              }
            >
              {
                payment.notes
              }
            </Text>
          ) : null}
        </View>

        <View
          style={
            styles.historyRight
          }
        >
          <Text
            style={
              styles.historyAmount
            }
          >
            ₹
            {formatAmount(
              Number(
                payment.amount
              ) || 0
            )}
          </Text>

          <View
            style={
              styles.actionRow
            }
          >
            <TouchableOpacity
              style={
                styles.editButton
              }
              onPress={
                onEdit
              }
            >
              <Text
                style={
                  styles.editButtonText
                }
              >
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.deleteButton
              }
              onPress={
                onDelete
              }
            >
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { paddingHorizontal: 28, paddingTop: 26, paddingBottom: 50, maxWidth: 1320, width: '100%', alignSelf: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7FB', gap: 12 },
  loadingText: { marginTop: 8, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#667085' },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 30, color: '#172033', letterSpacing: -0.6 },
  subtitle: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#667085' },
  addButton: { minHeight: 46, paddingHorizontal: 20, borderRadius: 13, backgroundColor: '#356DFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#356DFF', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  addButtonText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#FFFFFF' },

  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  summaryCard: { flex: 1, minWidth: 190, minHeight: 108, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#E7EBF3', backgroundColor: '#FFFFFF', shadowColor: '#182230', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  summaryBlue: { backgroundColor: '#F1F5FF', borderColor: '#DDE6FF' },
  summaryPurple: { backgroundColor: '#F6F2FF', borderColor: '#E7DEFF' },
  summaryGreen: { backgroundColor: '#EFFAF5', borderColor: '#D8F0E5' },
  summaryOrange: { backgroundColor: '#FFF8EC', borderColor: '#F5E4C4' },
  summaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#667085' },
  summaryValue: { marginTop: 10, fontFamily: 'Inter_800ExtraBold', fontSize: 22, color: '#172033', letterSpacing: -0.4 },
  summaryBlueValue: { color: '#3156D3' },
  summaryPurpleValue: { color: '#6941C6' },
  summaryGreenValue: { color: '#168A61' },
  summaryOrangeValue: { color: '#C47718' },

  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7EBF3', borderRadius: 20, padding: 22, marginBottom: 20, shadowColor: '#182230', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  formTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#172033' },
  formSubtitle: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 11, color: '#667085' },
  closeButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#667085' },
  label: { marginBottom: 8, fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#344054' },
  loanSelector: { gap: 10, paddingBottom: 16 },
  loanOption: { minWidth: 170, maxWidth: 230, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E4E7EC' },
  loanOptionActive: { backgroundColor: '#EEF3FF', borderColor: '#356DFF' },
  loanOptionName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#344054' },
  loanOptionNameActive: { color: '#3156D3' },
  loanOptionLender: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 10, color: '#98A2B3' },
  loanOptionLenderActive: { color: '#5B6FAF' },
  input: { minHeight: 48, backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#DCE2EA', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#172033', marginBottom: 18 },
  amountContainer: { minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBFCFE', borderWidth: 1, borderColor: '#C9D5F5', borderRadius: 14, marginBottom: 12 },
  currency: { marginLeft: 16, fontFamily: 'Inter_700Bold', fontSize: 20, color: '#356DFF' },
  amountInput: { flex: 1, paddingHorizontal: 11, fontFamily: 'Inter_700Bold', fontSize: 22, color: '#172033' },
  scheduleLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, marginBottom: 18, borderRadius: 14, backgroundColor: '#F5F7FF' },
  scheduleLoadingText: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#667085' },
  scheduledRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 18, borderRadius: 14, backgroundColor: '#F5F7FF' },
  scheduledLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#667085' },
  scheduledValue: { marginTop: 4, fontFamily: 'Inter_700Bold', fontSize: 15, color: '#3156D3' },
  useEmiButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: '#356DFF' },
  useEmiText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#FFFFFF' },
  typeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 12, borderRadius: 14, backgroundColor: '#FAFBFC', borderWidth: 1, borderColor: '#EAECF0' },
  typeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#667085' },
  typeDescription: { marginTop: 4, fontFamily: 'Inter_500Medium', fontSize: 12, color: '#344054' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  paidBadge: { backgroundColor: '#E8F7F0' },
  partialBadge: { backgroundColor: '#FFF4DD' },
  prepaymentBadge: { backgroundColor: '#EAF0FF' },
  missedBadge: { backgroundColor: '#FDECEC' },
  typeBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#344054' },
  allocationCard: { marginTop: 4, marginBottom: 18, padding: 18, borderRadius: 16, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#DDE6FF' },
  allocationTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#172033', marginBottom: 10 },
  allocationRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  allocationLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#667085' },
  allocationLabelStrong: { fontFamily: 'Inter_600SemiBold', color: '#344054' },
  allocationValue: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#344054' },
  allocationValueStrong: { fontFamily: 'Inter_700Bold', color: '#3156D3' },
  principalOnlyNote: { marginTop: 8, fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#168A61' },
  notes: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: { minHeight: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#475467' },
  saveButton: { minHeight: 46, paddingHorizontal: 22, borderRadius: 12, backgroundColor: '#356DFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#356DFF', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  saveButtonText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFFFFF' },
  disabledButton: { opacity: 0.55 },

  historyCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7EBF3', borderRadius: 20, padding: 22, shadowColor: '#182230', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#172033' },
  historySubtitle: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 11, color: '#667085' },
  historyCount: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF3FF', color: '#3156D3', textAlign: 'center', textAlignVertical: 'center', paddingTop: 9, fontFamily: 'Inter_700Bold', fontSize: 11 },
  searchInput: { height: 46, marginTop: 18, marginBottom: 14, borderWidth: 1, borderColor: '#DCE2EA', backgroundColor: '#FBFCFE', borderRadius: 13, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 12, color: '#172033' },
  historyList: { gap: 10 },
  historyItem: { borderWidth: 1, borderColor: '#E7EBF3', borderRadius: 15, padding: 15, backgroundColor: '#FFFFFF' },
  historyMain: { flexDirection: 'row', alignItems: 'center' },
  historyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  historyIconText: { color: '#356DFF', fontFamily: 'Inter_700Bold', fontSize: 17 },
  historyInfo: { flex: 1, minWidth: 0 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyLoanName: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#172033' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#344054' },
  historyDate: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 10, color: '#98A2B3' },
  breakdown: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 10, color: '#667085' },
  notesText: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 10, color: '#98A2B3', fontStyle: 'italic' },
  historyRight: { alignItems: 'flex-end', marginLeft: 12 },
  historyAmount: { fontFamily: 'Inter_800ExtraBold', fontSize: 16, color: '#3156D3' },
  actionRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  editButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#EEF3FF' },
  editButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#3156D3' },
  deleteButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FDECEC' },
  deleteButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#C0392B' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: '#356DFF', fontFamily: 'Inter_700Bold', fontSize: 23 },
  emptyTitle: { marginTop: 14, fontFamily: 'Inter_700Bold', fontSize: 15, color: '#172033' },
  emptyText: { marginTop: 6, fontFamily: 'Inter_400Regular', fontSize: 11, color: '#98A2B3', textAlign: 'center', maxWidth: 400 },
  emptyAddButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#356DFF' },
  emptyAddButtonText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 10 },
  bottomSpace: { height: 30 },
});
