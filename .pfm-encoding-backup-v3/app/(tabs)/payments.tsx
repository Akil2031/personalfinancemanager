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
} from '../../src/models/loan';

import {
  Payment,
} from '../../src/models/payment';

import {
  getLoans,
} from '../../src/services/loanService';

import {
  addPayment,
  deletePayment,
  getAllPayments,
  updatePayment,
} from '../../src/services/paymentService';

import {
  calculateRemainingEMI,
} from '../../src/engine/emiCalculator';

import {
  allocatePayment,
} from '../../src/engine/paymentCalculator';

import {
  generateLoanSchedule,
} from '../../src/engine/loanSchedule';

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

function getScheduledInstallment(
  loan: Loan
) {
  const result =
    generateLoanSchedule(
      loan
    );

  const today =
    new Date();

  today.setHours(
    23,
    59,
    59,
    999
  );

  const futureRows =
    result.schedule.filter(
      (row: any) => {
        const dueDate =
          new Date(
            row.dueDate
          );

        dueDate.setHours(
          23,
          59,
          59,
          999
        );

        return (
          dueDate.getTime() >
          today.getTime()
        );
      }
    );

  return (
    futureRows[0] ||
    result.schedule[
      result.schedule.length - 1
    ] ||
    null
  );
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

  const scheduledInstallment =
    useMemo(
      () =>
        selectedLoan
          ? getScheduledInstallment(
              selectedLoan
            )
          : null,
      [selectedLoan]
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
      `Are you sure you want to delete this payment of â‚¹${formatAmount(
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
              tintColor="#16803A"
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
              value={`â‚¹${formatAmount(
                totalPaid
              )}`}
              tone="blue"
            />

            <SummaryCard
              label="Principal"
              value={`â‚¹${formatAmount(
                totalPrincipal
              )}`}
              tone="green"
            />

            <SummaryCard
              label="Interest"
              value={`â‚¹${formatAmount(
                totalInterest
              )}`}
              tone="purple"
            />

            <SummaryCard
              label="Payments"
              value={String(
                payments.length
              )}
              tone="orange"
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
                    âœ•
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
                  â‚¹
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

              {scheduledEmi >
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
                      â‚¹
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
                    â‚¹
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
                  Click â€œ+ Add Paymentâ€ to record your first payment.
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'purple' | 'orange';
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        tone === 'blue' && styles.summaryBlue,
        tone === 'green' && styles.summaryGreen,
        tone === 'purple' && styles.summaryPurple,
        tone === 'orange' && styles.summaryOrange,
      ]}
    >
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
        â‚¹
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
            â‚¹
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
              ? `  â€¢  EMI #${payment.installmentNo}`
              : ''}
          </Text>

          <Text
            style={
              styles.breakdown
            }
          >
            Principal â‚¹
            {formatAmount(
              Number(
                payment.principal
              ) || 0
            )}

            {'  â€¢  '}

            Interest â‚¹
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
            â‚¹
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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F5F7FB',
    },

    content: {
      width: '100%',
      paddingHorizontal: 28,
      paddingTop: 28,
      paddingBottom: 52,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F7FB',
    },

    loadingText: {
      marginTop: 12,
      color: '#718096',
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
    },

    pageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 22,
      gap: 20,
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 35,
      lineHeight: 37,
      color: '#172033',
      letterSpacing: -0.6,
    },

    subtitle: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#7B879A',
    },

    addButton: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: '#356DFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#356DFF',
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },

    addButtonText: {
      color: '#FFFFFF',
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
    },

    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
      flexWrap: 'wrap',
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 225,
      minHeight: 150,
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      justifyContent: 'center',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },

    summaryBlue: {
      backgroundColor: '#356DFF',
      borderColor: '#356DFF',
      shadowColor: '#2454D8',
    },

    summaryGreen: {
      backgroundColor: '#18A673',
      borderColor: '#18A673',
      shadowColor: '#087A55',
    },

    summaryPurple: {
      backgroundColor: '#7857D8',
      borderColor: '#7857D8',
      shadowColor: '#5B3FB7',
    },

    summaryOrange: {
      backgroundColor: '#E99A32',
      borderColor: '#E99A32',
      shadowColor: '#C87818',
    },

    summaryLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: 'rgba(255,255,255,0.82)',
      letterSpacing: 0.65,
      textTransform: 'uppercase',
    },

    summaryValue: {
      marginTop: 11,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 30,
      lineHeight: 31,
      color: '#FFFFFF',
      letterSpacing: -0.7,
    },

    formCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E4E9F2',
      borderRadius: 20,
      padding: 22,
      marginBottom: 18,
      shadowColor: '#172033',
      shadowOpacity: 0.045,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    formHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },

    formTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      color: '#172033',
      letterSpacing: -0.2,
    },

    formSubtitle: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      color: '#8290A3',
      fontSize: 13,
    },

    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#F4F6FA',
      alignItems: 'center',
      justifyContent: 'center',
    },

    closeButtonText: {
      color: '#66758A',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
    },

    label: {
      marginTop: 18,
      marginBottom: 8,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#526174',
    },

    loanSelector: {
      gap: 10,
      paddingVertical: 2,
    },

    loanOption: {
      width: 190,
      minHeight: 62,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: '#FAFBFD',
      borderWidth: 1,
      borderColor: '#E1E7F0',
      justifyContent: 'center',
    },

    loanOptionActive: {
      backgroundColor: '#F1F5FF',
      borderColor: '#356DFF',
      borderWidth: 1.5,
    },

    loanOptionName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#273449',
    },

    loanOptionNameActive: {
      color: '#3156D3',
    },

    loanOptionLender: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#8793A5',
    },

    loanOptionLenderActive: {
      color: '#6680C7',
    },

    input: {
      minHeight: 48,
      backgroundColor: '#FBFCFE',
      borderWidth: 1,
      borderColor: '#DDE4EE',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#1D2939',
    },

    amountContainer: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FBFCFE',
      borderWidth: 1,
      borderColor: '#C9D7F7',
      borderRadius: 14,
      paddingHorizontal: 14,
    },

    currency: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 24,
      color: '#356DFF',
      marginRight: 7,
    },

    amountInput: {
      flex: 1,
      padding: 0,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 26,
      color: '#172033',
    },

    scheduledRow: {
      marginTop: 9,
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 13,
      backgroundColor: '#F4F7FC',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    scheduledLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#7A8799',
    },

    scheduledValue: {
      marginTop: 3,
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#25324A',
    },

    useEmiButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 9,
      backgroundColor: '#E9F0FF',
    },

    useEmiText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: '#356DFF',
    },

    typeCard: {
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: '#F8F9FC',
      borderWidth: 1,
      borderColor: '#E6EAF1',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    typeLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#344054',
    },

    typeDescription: {
      marginTop: 3,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#8793A5',
    },

    typeBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
    },

    paidBadge: {
      backgroundColor: '#EAF8F1',
    },

    partialBadge: {
      backgroundColor: '#FFF4DD',
    },

    prepaymentBadge: {
      backgroundColor: '#EEE9FF',
    },

    missedBadge: {
      backgroundColor: '#FDECEC',
    },

    typeBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      color: '#168A61',
    },

    allocationCard: {
      marginTop: 12,
      backgroundColor: '#F5F7FF',
      borderWidth: 1,
      borderColor: '#DCE5FF',
      borderRadius: 15,
      padding: 16,
    },

    allocationTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#243252',
      marginBottom: 8,
    },

    allocationRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 7,
    },

    allocationLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#718096',
    },

    allocationLabelStrong: {
      fontFamily: 'Inter_600SemiBold',
      color: '#344054',
    },

    allocationValue: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: '#475467',
    },

    allocationValueStrong: {
      fontFamily: 'Inter_700Bold',
      color: '#3156D3',
    },

    principalOnlyNote: {
      marginTop: 7,
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: '#6941C6',
    },

    notes: {
      minHeight: 88,
      textAlignVertical: 'top',
    },

    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 18,
    },

    cancelButton: {
      minHeight: 44,
      paddingHorizontal: 18,
      borderRadius: 11,
      backgroundColor: '#F1F3F7',
      alignItems: 'center',
      justifyContent: 'center',
    },

    cancelButtonText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#59677A',
    },

    saveButton: {
      minHeight: 44,
      paddingHorizontal: 22,
      borderRadius: 11,
      backgroundColor: '#356DFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#356DFF',
      shadowOpacity: 0.14,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    saveButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#FFFFFF',
    },

    disabledButton: {
      opacity: 0.55,
    },

    historyCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E4E9F2',
      borderRadius: 20,
      padding: 22,
      shadowColor: '#172033',
      shadowOpacity: 0.04,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },

    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    historyTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 21,
      color: '#172033',
      letterSpacing: -0.2,
    },

    historySubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#8793A5',
    },

    historyCount: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#EEF3FF',
      textAlign: 'center',
      textAlignVertical: 'center',
      paddingTop: 8,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#356DFF',
    },

    searchInput: {
      minHeight: 46,
      backgroundColor: '#F8FAFD',
      borderWidth: 1,
      borderColor: '#DFE5EE',
      borderRadius: 12,
      paddingHorizontal: 14,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#25324A',
      marginBottom: 14,
    },

    historyList: {
      gap: 10,
    },

    historyItem: {
      backgroundColor: '#FBFCFE',
      borderWidth: 1,
      borderColor: '#E6EAF1',
      borderRadius: 15,
      padding: 15,
    },

    historyMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    historyIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#EEF3FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    historyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 19,
      color: '#356DFF',
    },

    historyInfo: {
      flex: 1,
      minWidth: 0,
    },

    historyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },

    historyLoanName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#273449',
    },

    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },

    statusBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
    },

    historyDate: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#8793A5',
    },

    breakdown: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#69778A',
    },

    notesText: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#66758A',
      fontStyle: 'italic',
    },

    historyRight: {
      alignItems: 'flex-end',
      marginLeft: 12,
      minWidth: 125,
    },

    historyAmount: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 19,
      color: '#172033',
    },

    actionRow: {
      flexDirection: 'row',
      gap: 7,
      marginTop: 9,
    },

    editButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#EEF3FF',
    },

    editButtonText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#356DFF',
    },

    deleteButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#FDEEEE',
    },

    deleteButtonText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#C2413A',
    },

    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 44,
      borderRadius: 15,
      backgroundColor: '#F8FAFD',
      borderWidth: 1,
      borderColor: '#E6EAF1',
    },

    emptyIcon: {
      width: 50,
      height: 50,
      borderRadius: 15,
      backgroundColor: '#EEF3FF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 22,
      color: '#356DFF',
    },

    emptyTitle: {
      marginTop: 12,
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      color: '#273449',
    },

    emptyText: {
      marginTop: 5,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#8793A5',
      textAlign: 'center',
    },

    emptyAddButton: {
      marginTop: 16,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: '#356DFF',
    },

    emptyAddButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#FFFFFF',
    },

    bottomSpace: {
      height: 30,
    },
  });


