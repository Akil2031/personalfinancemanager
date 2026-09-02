import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
  generateLoanSchedule,
} from '../../src/engine/loanSchedule';

import {
  allocatePayment,
} from '../../src/engine/paymentCalculator';

type PaymentFormMode =
  | 'ADD'
  | 'EDIT';

type PaymentType =
  | 'PAID'
  | 'PARTIAL'
  | 'PREPAYMENT';

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatAmount(
  value: number
): string {
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

/*
 * =========================================================
 * FIND NEXT SCHEDULED EMI
 * =========================================================
 *
 * The central loanScheduler is the only source of truth.
 *
 * We intentionally do NOT create another scheduler here.
 */

function getScheduledInstallment(
  loan: Loan
) {
  const result =
    generateLoanSchedule(
      loan
    );

  if (
    !result.schedule ||
    result.schedule.length === 0
  ) {
    return null;
  }

  const today =
    new Date();

  today.setHours(
    23,
    59,
    59,
    999
  );

  /*
   * First try to find the next future EMI.
   */
  const futureRows =
    result.schedule.filter(
      row => {
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

  if (
    futureRows.length > 0
  ) {
    return futureRows[0];
  }

  /*
   * If there is no future row, return
   * the last available schedule row.
   */
  return (
    result.schedule[
      result.schedule.length - 1
    ] || null
  );
}

/*
 * =========================================================
 * MAIN SCREEN
 * =========================================================
 */

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
  ] =
    useState<PaymentFormMode>(
      'ADD'
    );

  const [
    editingPayment,
    setEditingPayment,
  ] =
    useState<Payment | null>(
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

  /*
   * =======================================================
   * LOAD DATA
   * =======================================================
   */

  const loadData =
    useCallback(
      async () => {
        try {
          const [
            loanData,
            paymentData,
          ] =
            await Promise.all([
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
    void loadData();
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);

    await loadData();
  }

  /*
   * =======================================================
   * SELECTED LOAN
   * =======================================================
   */

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

  /*
   * =======================================================
   * SCHEDULED EMI
   * =======================================================
   */

  const scheduledInstallment =
    useMemo(
      () =>
        selectedLoan
          ? getScheduledInstallment(
              selectedLoan
            )
          : null,
      [
        selectedLoan,
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

  /*
   * =======================================================
   * PAYMENT ALLOCATION
   * =======================================================
   */

  const allocation =
    useMemo(() => {
      if (
        numericAmount <= 0 ||
        !selectedLoan
      ) {
        return null;
      }

      /*
       * PARTIAL and PREPAYMENT
       * are principal-only.
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

  /*
   * =======================================================
   * SUMMARY
   * =======================================================
   */

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
              payment.amount ||
                0
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

  /*
   * =======================================================
   * SEARCH
   * =======================================================
   */

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

  /*
   * =======================================================
   * FORM
   * =======================================================
   */

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

  /*
   * =======================================================
   * SAVE PAYMENT
   * =======================================================
   */

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

      if (!allocation) {
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
       * Existing payment:
       * preserve its installment number.
       *
       * New payment:
       * use the scheduled installment.
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
         * principal-only.
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

  /*
   * =======================================================
   * DELETE
   * =======================================================
   */

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

  /*
   * =======================================================
   * LOADING
   * =======================================================
   */

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

  /*
   * =======================================================
   * SCREEN
   * =======================================================
   */

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
        {/* =================================================
            HEADER
        ================================================== */}

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

        {/* =================================================
            SUMMARY
        ================================================== */}

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

        {/* =================================================
            FORM
        ================================================== */}

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
                          loan.id ||
                            ''
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.loanOptionName,
                          active &&
                            styles.loanOptionNameActive,
                        ]}
                        numberOfLines={
                          1
                        }
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
                        numberOfLines={
                          1
                        }
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

        {/* =================================================
            HISTORY
        ================================================== */}

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

/*
 * =========================================================
 * SUMMARY CARD
 * =========================================================
 */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
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
 * ALLOCATION ROW
 * =========================================================
 */

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

/*
 * =========================================================
 * PAYMENT HISTORY ITEM
 * =========================================================
 */

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
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 40,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        '#F4F8F5',
    },

    loadingText: {
      marginTop: 12,
      color: '#6F7B74',
      fontSize: 13,
    },

    pageHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 18,
      gap: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: '800',
      color: '#17221B',
    },

    subtitle: {
      marginTop: 4,
      fontSize: 12,
      color: '#7B8780',
    },

    addButton: {
      backgroundColor:
        '#16803A',
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 10,
    },

    addButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },

    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
      flexWrap: 'wrap',
    },

    summaryCard: {
      flex: 1,
      minWidth: 180,
      minHeight: 88,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 13,
      padding: 15,
      justifyContent:
        'center',
    },

    summaryLabel: {
      fontSize: 10,
      color: '#7B8780',
      fontWeight: '600',
    },

    summaryValue: {
      marginTop: 6,
      fontSize: 19,
      color: '#16803A',
      fontWeight: '800',
    },

    formCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#DDE9E0',
      borderRadius: 14,
      padding: 20,
      marginBottom: 14,
    },

    formHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    formTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#17221B',
    },

    formSubtitle: {
      marginTop: 4,
      color: '#7B8780',
      fontSize: 11,
    },

    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor:
        '#F1F5F2',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    closeButtonText: {
      color: '#64716A',
      fontSize: 14,
      fontWeight: '800',
    },

    label: {
      marginTop: 17,
      marginBottom: 7,
      fontSize: 10,
      color: '#5F6C64',
      fontWeight: '700',
    },

    loanSelector: {
      gap: 9,
      paddingVertical: 2,
    },

    loanOption: {
      width: 180,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
      backgroundColor:
        '#FAFCFA',
    },

    loanOptionActive: {
      borderColor:
        '#16803A',
      backgroundColor:
        '#EAF4ED',
    },

    loanOptionName: {
      fontSize: 12,
      fontWeight: '800',
      color: '#26342C',
    },

    loanOptionNameActive: {
      color: '#16803A',
    },

    loanOptionLender: {
      marginTop: 3,
      fontSize: 9,
      color: '#87928B',
    },

    loanOptionLenderActive: {
      color: '#16803A',
    },

    input: {
      height: 44,
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
      backgroundColor:
        '#FAFCFA',
      borderRadius: 9,
      paddingHorizontal: 13,
      fontSize: 14,
      color: '#17221B',
    },

    amountContainer: {
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        '#CFE0D4',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 10,
      paddingHorizontal: 13,
    },

    currency: {
      fontSize: 19,
      fontWeight: '800',
      color: '#16803A',
      marginRight: 8,
    },

    amountInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: '#17221B',
    },

    scheduledRow: {
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor:
        '#F5F9F6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    scheduledLabel: {
      fontSize: 9,
      color: '#7B8780',
    },

    scheduledValue: {
      marginTop: 3,
      fontSize: 14,
      fontWeight: '800',
      color: '#26342C',
    },

    useEmiButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor:
        '#EAF4ED',
    },

    useEmiText: {
      color: '#16803A',
      fontSize: 10,
      fontWeight: '800',
    },

    typeCard: {
      marginTop: 12,
      padding: 13,
      borderRadius: 10,
      backgroundColor:
        '#F7FAF8',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    typeLabel: {
      fontSize: 9,
      color: '#7B8780',
      fontWeight: '700',
    },

    typeDescription: {
      marginTop: 3,
      fontSize: 11,
      color: '#34423A',
    },

    typeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },

    paidBadge: {
      backgroundColor:
        '#E8F5EC',
    },

    partialBadge: {
      backgroundColor:
        '#FFF4D9',
    },

    prepaymentBadge: {
      backgroundColor:
        '#E8F0FF',
    },

    missedBadge: {
      backgroundColor:
        '#FDECEC',
    },

    typeBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#34423A',
    },

    allocationCard: {
      marginTop: 12,
      padding: 15,
      borderRadius: 11,
      backgroundColor:
        '#F8FBF9',
      borderWidth: 1,
      borderColor:
        '#DDE9E0',
    },

    allocationTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: '#17221B',
      marginBottom: 8,
    },

    allocationRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      paddingVertical: 5,
    },

    allocationLabel: {
      fontSize: 11,
      color: '#6D7972',
    },

    allocationLabelStrong: {
      color: '#26342C',
      fontWeight: '700',
    },

    allocationValue: {
      fontSize: 11,
      color: '#34423A',
    },

    allocationValueStrong: {
      fontWeight: '800',
      color: '#16803A',
    },

    principalOnlyNote: {
      marginTop: 8,
      fontSize: 10,
      color: '#16803A',
      fontWeight: '700',
    },

    notes: {
      minHeight: 75,
      paddingTop: 12,
      textAlignVertical:
        'top',
    },

    formActions: {
      flexDirection: 'row',
      justifyContent:
        'flex-end',
      gap: 10,
      marginTop: 18,
    },

    cancelButton: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 9,
      backgroundColor:
        '#EEF2EF',
    },

    cancelButtonText: {
      color: '#536158',
      fontSize: 11,
      fontWeight: '800',
    },

    saveButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 9,
      backgroundColor:
        '#16803A',
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    disabledButton: {
      opacity: 0.55,
    },

    historyCard: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1EAE4',
      borderRadius: 14,
      padding: 19,
    },

    historyHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    historyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#17221B',
    },

    historySubtitle: {
      marginTop: 3,
      fontSize: 10,
      color: '#87928B',
    },

    historyCount: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        '#EAF4ED',
      color: '#16803A',
      textAlign: 'center',
      textAlignVertical:
        'center',
      fontSize: 11,
      fontWeight: '800',
      paddingTop: 8,
    },

    searchInput: {
      height: 42,
      marginTop: 15,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        '#DDE6E0',
      backgroundColor:
        '#FAFCFA',
      borderRadius: 9,
      paddingHorizontal: 13,
      fontSize: 12,
      color: '#17221B',
    },

    historyList: {
      gap: 9,
    },

    historyItem: {
      borderWidth: 1,
      borderColor:
        '#E4EBE6',
      borderRadius: 11,
      padding: 13,
      backgroundColor:
        '#FFFFFF',
    },

    historyMain: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    historyIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor:
        '#EAF4ED',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    historyIconText: {
      color: '#16803A',
      fontWeight: '800',
      fontSize: 17,
    },

    historyInfo: {
      flex: 1,
      minWidth: 0,
    },

    historyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    historyLoanName: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '800',
      color: '#26342C',
    },

    statusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
    },

    statusBadgeText: {
      fontSize: 8,
      fontWeight: '800',
      color: '#34423A',
    },

    historyDate: {
      marginTop: 4,
      fontSize: 10,
      color: '#7B8780',
    },

    breakdown: {
      marginTop: 5,
      fontSize: 10,
      color: '#5F6C64',
    },

    notesText: {
      marginTop: 5,
      fontSize: 10,
      color: '#7B8780',
      fontStyle: 'italic',
    },

    historyRight: {
      alignItems: 'flex-end',
      marginLeft: 12,
    },

    historyAmount: {
      fontSize: 16,
      fontWeight: '800',
      color: '#16803A',
    },

    actionRow: {
      flexDirection: 'row',
      gap: 7,
      marginTop: 8,
    },

    editButton: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 7,
      backgroundColor:
        '#EEF5F0',
    },

    editButtonText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#16803A',
    },

    deleteButton: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 7,
      backgroundColor:
        '#FDECEC',
    },

    deleteButtonText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#C0392B',
    },

    empty: {
      alignItems: 'center',
      justifyContent:
        'center',
      paddingVertical: 55,
    },

    emptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor:
        '#EAF4ED',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyIconText: {
      color: '#16803A',
      fontSize: 22,
      fontWeight: '800',
    },

    emptyTitle: {
      marginTop: 13,
      fontSize: 15,
      fontWeight: '800',
      color: '#26342C',
    },

    emptyText: {
      marginTop: 5,
      fontSize: 11,
      color: '#87928B',
      textAlign: 'center',
      maxWidth: 380,
    },

    emptyAddButton: {
      marginTop: 15,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 9,
      backgroundColor:
        '#16803A',
    },

    emptyAddButtonText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },

    bottomSpace: {
      height: 30,
    },
  });