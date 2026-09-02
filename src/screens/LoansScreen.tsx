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
  getLoans,
  deleteLoan,
} from '../services/loanService';

import {
  Loan,
} from '../models/loan';

import LoanDetailsScreen from './LoanDetailsScreen';

import AddLoanScreen from './AddLoanScreen';

import {
  generateAdjustedLoanSchedule,
} from '../engine/loanSchedule';

import {
  getAllPayments,
} from '../services/paymentService';

import {
  Payment,
} from '../models/payment';


/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type LoanWithSchedule =
  Loan & {
    nextEmiDate?: string;
    lastEmiDate?: string;
    __actualPayments?: Payment[];
    __paidInstallments?: number;
  };


interface Props {
  /*
   * These callbacks are retained for compatibility with
   * the parent component.
   *
   * IMPORTANT:
   *
   * Add/Edit navigation is handled locally inside this
   * screen. We do NOT call onAddLoan/onEditLoan from the
   * local actions because doing so can create two competing
   * navigation/state flows.
   */

  onAddLoan?: () => void;

  onEditLoan?: (
    loan: Loan
  ) => void;

  onViewLoan?: (
    loan: Loan
  ) => void;
}


/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatLoanDate(
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


/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function LoansScreen({
  onAddLoan,
  onEditLoan,
  onViewLoan,
}: Props) {

  /*
   * =======================================================
   * LOANS
   * =======================================================
   */

  const [
    loans,
    setLoans,
  ] = useState<Loan[]>([]);


  /*
   * =======================================================
   * LOADING
   * =======================================================
   */

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  /*
   * =======================================================
   * SEARCH / FILTER
   * =======================================================
   */

  const [
    search,
    setSearch,
  ] = useState('');


  const [
    filter,
    setFilter,
  ] = useState<
    'ALL' |
    'ACTIVE' |
    'PAUSED' |
    'CLOSED'
  >('ALL');


  /*
   * =======================================================
   * VIEW / EDIT / ADD STATE
   * =======================================================
   */

  const [
    selectedLoan,
    setSelectedLoan,
  ] = useState<Loan | null>(
    null
  );


  const [
    editingLoan,
    setEditingLoan,
  ] = useState<Loan | null>(
    null
  );


  const [
    showAddLoan,
    setShowAddLoan,
  ] = useState(false);


  /*
   * =======================================================
   * DELETE STATE
   * =======================================================
   */

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    string | null
  >(null);


  /*
   * =======================================================
   * PAYMENTS
   * =======================================================
   */

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);


  /*
   * =======================================================
   * LOAD LOANS
   * =======================================================
   *
   * The loan list is made payment-aware here.
   *
   * A due EMI is NOT automatically considered paid.
   * Actual payment records are supplied to the schedule
   * engine.
   * =======================================================
   */

  const loadLoans =
    useCallback(
      async () => {

        try {

          const [
            data,
            paymentData,
          ] =
            await Promise.all([
              getLoans(),
              getAllPayments(),
            ]);


          /*
           * Keep payment state.
           */

          setPayments(
            paymentData
          );


          /*
           * =================================================
           * PAYMENT-AWARE LOAN POSITION
           * =================================================
           */

          const calculatedLoans =
            data.map(
              (loan) => {

                try {

                  const loanPayments =
                    paymentData.filter(
                      (
                        payment
                      ) =>
                        payment.loanId ===
                        loan.id
                    );


                  const position =
                    generateAdjustedLoanSchedule(
                      loan,
                      loanPayments,
                      new Date()
                    );


                  return {
                    ...loan,

                    /*
                     * Current calculated position.
                     */

                    currentOutstanding:
                      position.currentOutstanding,

                    remainingMonths:
                      position.remainingMonths,


                    /*
                     * Next EMI date.
                     */

                    nextEmiDate:
                      position.nextEmiDate
                        ? position.nextEmiDate.toISOString()
                        : '',


                    /*
                     * Last EMI date.
                     */

                    lastEmiDate:
                      position.lastEmiDate
                        ? position.lastEmiDate.toISOString()
                        : '',


                    /*
                     * Use the stored EMI when available.
                     */

                    emi:
                      Math.round(
                        Number(
                          loan.emi
                        ) ||
                        Number(
                          position.emi
                        ) ||
                        0
                      ),


                    /*
                     * Helper values used by
                     * LoanDetailsScreen.
                     */

                    __actualPayments:
                      loanPayments,

                    __paidInstallments:
                      position.paidInstallments,

                  } as Loan;

                } catch (
                  positionError
                ) {

                  console.error(
                    'Unable to calculate loan position:',
                    loan.id,
                    positionError
                  );

                  /*
                   * If calculation fails for one loan,
                   * keep the original loan rather than
                   * breaking the complete loan list.
                   */

                  return loan;
                }
              }
            );


          setLoans(
            calculatedLoans
          );

        } catch (
          error
        ) {

          console.error(
            'Failed to load loans:',
            error
          );


          const message =
            error instanceof Error
              ? error.message
              : 'Unable to load loans.';


          Alert.alert(
            'Error',
            message
          );

        } finally {

          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }

      },
      []
    );


  /*
   * =======================================================
   * INITIAL LOAD
   * =======================================================
   */

  useEffect(() => {

    loadLoans();

  }, [
    loadLoans,
  ]);


  /*
   * =======================================================
   * REFRESH
   * =======================================================
   */

  async function handleRefresh() {

    setRefreshing(
      true
    );

    await loadLoans();
  }


  /*
   * =======================================================
   * ADD LOAN
   * =======================================================
   *
   * IMPORTANT:
   *
   * This screen controls its own AddLoanScreen.
   *
   * We do NOT call onAddLoan here.
   * =======================================================
   */

  function openAddLoan() {

    console.log(
      '[LOANS] ADD BUTTON PRESSED'
    );


    setSelectedLoan(
      null
    );

    setEditingLoan(
      null
    );

    setShowAddLoan(
      true
    );
  }


  /*
   * =======================================================
   * EDIT LOAN
   * =======================================================
   *
   * Only actual database loan fields are passed into
   * AddLoanScreen.
   *
   * Calculated helper fields are removed.
   * =======================================================
   */

  function openEditLoan(
    loan: Loan
  ) {

    if (!loan.id) {

      Alert.alert(
        'Edit Failed',
        'This loan does not have a valid ID.'
      );

      return;
    }


    console.log(
      '[LOANS] Opening loan for edit:',
      loan.id
    );


    setSelectedLoan(
      null
    );

    setShowAddLoan(
      false
    );


    /*
     * Build a clean editable loan object.
     */

    const editableLoan: Loan = {
  id: loan.id,

  lender:
    loan.lender || '',

  loanName:
    loan.loanName || '',

  loanType:
    loan.loanType,

  repaymentType:
    loan.repaymentType ||
    'EMI',

  originalPrincipal:
    Number(
      loan.originalPrincipal || 0
    ),

  currentOutstanding:
    Number(
      loan.currentOutstanding || 0
    ),

  annualInterestRate:
    Number(
      loan.annualInterestRate || 0
    ),

  interestType:
    loan.interestType,

  emi:
    Number(
      loan.emi || 0
    ),

  monthlyInterest:
    Number(
      loan.monthlyInterest || 0
    ),

  tenureMonths:
    Number(
      loan.tenureMonths || 0
    ),

  remainingMonths:
    Number(
      loan.remainingMonths || 0
    ),

  loanStartDate:
    String(
      loan.loanStartDate || ''
    ).substring(0, 10),

  firstEmiDate:
    String(
      loan.firstEmiDate || ''
    ).substring(0, 10),

  maturityDate:
    String(
      loan.maturityDate || ''
    ).substring(0, 10),

  status:
    loan.status,
};


    setEditingLoan(
      editableLoan
    );


    /*
     * IMPORTANT:
     *
     * Do NOT call:
     *
     * onEditLoan?.(...)
     *
     * The local state above already opens the form.
     */
  }


  /*
   * =======================================================
   * VIEW LOAN
   * =======================================================
   */

  function openViewLoan(
    loan: Loan
  ) {

    if (!loan.id) {

      Alert.alert(
        'View Failed',
        'This loan does not have a valid ID.'
      );

      return;
    }


    console.log(
      '[LOANS] Opening loan details:',
      loan.id
    );


    setEditingLoan(
      null
    );

    setShowAddLoan(
      false
    );

    setSelectedLoan(
      loan
    );


    /*
     * View callback may still be used by a parent
     * that listens for analytics/navigation.
     *
     * It does not control our local rendering.
     */

    onViewLoan?.(
      loan
    );
  }


  /*
   * =======================================================
   * CLOSE ADD / EDIT FORM
   * =======================================================
   */

  function closeForm() {

    setShowAddLoan(
      false
    );

    setEditingLoan(
      null
    );
  }


  /*
   * =======================================================
   * AFTER SAVE
   * =======================================================
   */

  async function handleSaved() {

    console.log(
      '[LOANS] Loan saved successfully.'
    );


    /*
     * Close form first.
     */

    setShowAddLoan(
      false
    );

    setEditingLoan(
      null
    );


    /*
     * Reload Firestore + payment-aware position.
     */

    await loadLoans();
  }


  /*
   * =======================================================
   * DELETE
   * =======================================================
   */

  async function performDelete(
    loan: Loan
  ) {

    const loanId =
      loan.id;


    if (!loanId) {

      Alert.alert(
        'Delete Failed',
        'This loan does not have a valid ID.'
      );

      return;
    }


    if (deletingId) {
      return;
    }


    try {

      setDeletingId(
        loanId
      );


      console.log(
        '[LOANS] Deleting loan:',
        loanId
      );


      await deleteLoan(
        loanId
      );


      /*
       * Remove immediately from visible list.
       */

      setLoans(
        current =>
          current.filter(
            item =>
              item.id !==
              loanId
          )
      );


      /*
       * Close details if this was the
       * currently selected loan.
       */

      if (
        selectedLoan?.id ===
        loanId
      ) {

        setSelectedLoan(
          null
        );
      }


      /*
       * Re-read Firestore.
       */

      await loadLoans();


      console.log(
        '[LOANS] Loan deleted successfully:',
        loanId
      );


      if (
        Platform.OS ===
        'web'
      ) {

        window.alert(
          'Loan deleted successfully.'
        );

      } else {

        Alert.alert(
          'Deleted',
          'Loan deleted successfully.'
        );
      }

    } catch (
      error
    ) {

      console.error(
        '[LOANS] Delete loan failed:',
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete the loan.';


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

    } finally {

      setDeletingId(
        null
      );
    }
  }


  /*
   * =======================================================
   * CONFIRM DELETE
   * =======================================================
   */

  function confirmDelete(
    loan: Loan
  ) {

    const loanId =
      loan.id;


    if (!loanId) {

      Alert.alert(
        'Delete Failed',
        'This loan does not have a valid ID.'
      );

      return;
    }


    if (deletingId) {
      return;
    }


    /*
     * Web
     */

    if (
      Platform.OS ===
      'web'
    ) {

      const confirmed =
        window.confirm(
          `Are you sure you want to delete "${loan.loanName}"?`
        );


      if (
        confirmed
      ) {

        void performDelete(
          loan
        );
      }


      return;
    }


    /*
     * Native
     */

    Alert.alert(
      'Delete Loan',
      `Are you sure you want to delete "${loan.loanName}"?`,
      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            'Delete',

          style:
            'destructive',

          onPress: () => {

            void performDelete(
              loan
            );
          },
        },
      ]
    );
  }


  /*
   * =======================================================
   * FILTERED LOANS
   * =======================================================
   */

  const filteredLoans =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return loans.filter(
          (
            loan
          ) => {

            const matchesSearch =
              !query ||
              String(
                loan.loanName || ''
              )
                .toLowerCase()
                .includes(
                  query
                ) ||
              String(
                loan.lender || ''
              )
                .toLowerCase()
                .includes(
                  query
                );


            const matchesFilter =
              filter ===
                'ALL' ||
              loan.status ===
                filter;


            return (
              matchesSearch &&
              matchesFilter
            );
          }
        );

      },
      [
        loans,
        search,
        filter,
      ]
    );


  /*
   * =======================================================
   * TOTAL OUTSTANDING
   * =======================================================
   *
   * Uses the payment-aware calculated values in `loans`.
   * =======================================================
   */

  const totalOutstanding =
    loans.reduce(
      (
        sum,
        loan
      ) =>
        sum +
        Number(
          loan.currentOutstanding ||
          0
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL LOAN AMOUNT
   * =======================================================
   */

  const totalLoanAmount =
    loans.reduce(
      (
        sum,
        loan
      ) =>
        sum +
        Number(
          loan.originalPrincipal ||
          0
        ),
      0
    );


  /*
   * =======================================================
   * TOTAL EMI
   * =======================================================
   */

  const totalMonthlyObligation =
  loans.reduce(
    (sum, loan) => {

      const amount =
        loan.repaymentType ===
        'INTEREST_ONLY'
          ? Number(
              loan.monthlyInterest ||
              0
            )
          : Number(
              loan.emi || 0
            );

      return (
        sum +
        Math.round(amount)
      );
    },
    0
  );


  /*
   * =======================================================
   * ACTIVE LOANS
   * =======================================================
   */

  const activeLoans =
    loans.filter(
      loan =>
        loan.status ===
        'ACTIVE'
    ).length;


  /*
   * =======================================================
   * ADD / EDIT SCREEN
   * =======================================================
   *
   * This is controlled entirely by this screen.
   * =======================================================
   */

  if (
    showAddLoan ||
    editingLoan
  ) {

    return (
      <View
        style={
          styles.container
        }
      >

        <AddLoanScreen
          loan={
            editingLoan ??
            undefined
          }

          onSaved={
            handleSaved
          }

          onCancel={
            closeForm
          }
        />

      </View>
    );
  }


  /*
   * =======================================================
   * LOAN DETAILS
   * =======================================================
   */

  if (
    selectedLoan
  ) {

    return (
      <View
        style={
          styles.container
        }
      >

        <View
          style={
            styles.viewHeader
          }
        >

          <TouchableOpacity
            style={
              styles.backButton
            }

            onPress={() =>
              setSelectedLoan(
                null
              )
            }

            activeOpacity={
              0.8
            }
          >

            <Text
              style={
                styles.backButtonText
              }
            >
              ← Back
            </Text>

          </TouchableOpacity>


          <Text
            style={
              styles.viewHeaderTitle
            }
          >
            Loan Details
          </Text>


          <View
            style={
              styles.headerSpacer
            }
          />

        </View>


        <LoanDetailsScreen
          loan={
            selectedLoan
          }
        />

      </View>
    );
  }


  /*
   * =======================================================
   * LOADING
   * =======================================================
   */

  if (
    loading
  ) {

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
          Loading loans...
        </Text>

      </View>
    );
  }


  /*
   * =======================================================
   * MAIN SCREEN
   * =======================================================
   */

  return (
    <ScrollView
      style={
        styles.container
      }

      contentContainerStyle={
        styles.content
      }

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

      showsVerticalScrollIndicator={
        false
      }
    >

      {/* =================================================
          HEADER
         ================================================= */}

      <View
        style={
          styles.header
        }
      >

        <View>

          <Text
            style={
              styles.title
            }
          >
            My Loans
          </Text>


          <Text
            style={
              styles.subtitle
            }
          >
            Manage and track all your loans
          </Text>

        </View>


        <Pressable
          style={
            styles.addButton
          }

          onPress={
            openAddLoan
          }
        >

          <Text
            style={
              styles.addButtonText
            }
          >
            + Add Loan
          </Text>

        </Pressable>

      </View>


      {/* =================================================
          SUMMARY
         ================================================= */}

      <View
        style={
          styles.summaryContainer
        }
      >

        {/* TOTAL OUTSTANDING */}

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
            Total Outstanding
          </Text>


          <Text
            style={
              styles.summaryValue
            }
          >
            ₹
            {totalOutstanding.toLocaleString(
              'en-IN'
            )}
          </Text>


          <Text
            style={
              styles.summaryHint
            }
          >
            Current outstanding
          </Text>

        </View>


        {/* TOTAL LOAN AMOUNT */}

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
            Total Loan Amount
          </Text>


          <Text
            style={
              styles.summaryValue
            }
          >
            ₹
            {totalLoanAmount.toLocaleString(
              'en-IN'
            )}
          </Text>


          <Text
            style={
              styles.summaryHint
            }
          >
            Original borrowing
          </Text>

        </View>


        {/* MONTHLY EMI */}

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
            Monthly Obligation
          </Text>


          <Text
            style={
              styles.summaryValue
            }
          >
            ₹
            {totalMonthlyObligation.toLocaleString(
              'en-IN'
            )}
          </Text>


          <Text
            style={
              styles.summaryHint
            }
          >
            Monthly obligation
          </Text>

        </View>


        {/* ACTIVE LOANS */}

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
            Active Loans
          </Text>


          <Text
            style={
              styles.summaryValue
            }
          >
            {activeLoans}
          </Text>


          <Text
            style={
              styles.summaryHint
            }
          >
            Currently active
          </Text>

        </View>

      </View>


      {/* =================================================
          SEARCH
         ================================================= */}

      <View
        style={
          styles.searchContainer
        }
      >

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

          placeholder="Search loans or lenders..."

          placeholderTextColor="#9AA59E"
        />

      </View>


      {/* =================================================
          FILTER
         ================================================= */}

      <View
        style={
          styles.filterRow
        }
      >

        {[
          [
            'ALL',
            'All',
          ],

          [
            'ACTIVE',
            'Active',
          ],

          [
            'PAUSED',
            'Paused',
          ],

          [
            'CLOSED',
            'Closed',
          ],

        ].map(
          ([
            value,
            label,
          ]) => {

            const active =
              filter ===
              value;


            return (
              <Pressable
                key={
                  value
                }

                style={[
                  styles.filterButton,

                  active &&
                    styles.filterButtonActive,
                ]}

                onPress={() =>
                  setFilter(
                    value as
                      | 'ALL'
                      | 'ACTIVE'
                      | 'PAUSED'
                      | 'CLOSED'
                  )
                }
              >

                <Text
                  style={[
                    styles.filterText,

                    active &&
                      styles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>

              </Pressable>
            );
          }
        )}

      </View>


      {/* =================================================
          SECTION TITLE
         ================================================= */}

      <View
        style={
          styles.sectionHeader
        }
      >

        <View>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Your Loans
          </Text>


          <Text
            style={
              styles.sectionSubtitle
            }
          >
            {filteredLoans.length}{' '}
            {
              filteredLoans.length ===
              1
                ? 'loan'
                : 'loans'
            }
          </Text>

        </View>

      </View>


      {/* =================================================
          EMPTY
         ================================================= */}

      {
        filteredLoans.length ===
        0 ? (

          <View
            style={
              styles.emptyCard
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
              {
                loans.length ===
                0
                  ? 'No loans yet'
                  : 'No matching loans'
              }
            </Text>


            <Text
              style={
                styles.emptyText
              }
            >
              {
                loans.length ===
                0
                  ? 'Add your first loan to start tracking your financial position.'
                  : 'Try changing your search or filter.'
              }
            </Text>

          </View>

        ) : (

          filteredLoans.map(
            loan => {

              const isDeleting =
                deletingId ===
                loan.id;


              const outstanding =
                Number(
                  loan.currentOutstanding ||
                  0
                );


              const original =
                Number(
                  loan.originalPrincipal ||
                  0
                );


              const paid =
                Math.max(
                  0,
                  original -
                    outstanding
                );


              const progress =
                original >
                0
                  ? Math.min(
                      100,

                      Math.max(
                        0,

                        (
                          paid /
                          original
                        ) *
                        100
                      )
                    )
                  : 0;


              return (
                <View
                  key={
                    loan.id
                  }

                  style={
                    styles.loanCard
                  }
                >

                  {/* =================================================
                      CARD HEADER
                     ================================================= */}

                  <View
                    style={
                      styles.loanHeader
                    }
                  >

                    <View
                      style={
                        styles.loanIdentity
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
                            styles.loanName
                          }
                        >
                          {
                            loan.loanName
                          }
                        </Text>


                        <Text
                          style={
                            styles.lender
                          }
                        >
                          {
                            loan.lender
                          }
                        </Text>

                      </View>

                    </View>


                    <View
                      style={[
                        styles.statusBadge,

                        loan.status ===
                        'ACTIVE'
                          ? styles.statusActive
                          : loan.status ===
                            'CLOSED'
                          ? styles.statusClosed
                          : styles.statusPaused,
                      ]}
                    >

                      <Text
                        style={[
                          styles.statusText,

                          loan.status ===
                          'ACTIVE'
                            ? styles.statusTextActive
                            : loan.status ===
                              'CLOSED'
                            ? styles.statusTextClosed
                            : styles.statusTextPaused,
                        ]}
                      >
                        {
                          loan.status
                        }
                      </Text>

                    </View>

                  </View>


                  {/* DIVIDER */}

                  <View
                    style={
                      styles.divider
                    }
                  />


                  {/* =================================================
                      METRICS
                     ================================================= */}

                  <View
                    style={
                      styles.metrics
                    }
                  >

                    <Metric
                      label="Outstanding"

                      value={`₹${outstanding.toLocaleString(
                        'en-IN'
                      )}`}

                      primary
                    />


                    <Metric
                      label="Loan Amount"

                      value={`₹${original.toLocaleString(
                        'en-IN'
                      )}`}
                    />


                    <Metric
  label={
    loan.repaymentType ===
    'INTEREST_ONLY'
      ? 'Monthly Interest'
      : 'Monthly EMI'
  }
  value={`₹${Math.round(
    Number(
      loan.repaymentType ===
      'INTEREST_ONLY'
        ? loan.monthlyInterest || 0
        : loan.emi || 0
    )
  ).toLocaleString('en-IN')}`}
/>  

                    <Metric
                      label="Interest"

                      value={`${Number(
                        loan.annualInterestRate ||
                        0
                      )}%`}
                    />

                  </View>


                  {/* =================================================
                      PROGRESS
                     ================================================= */}

                  <View
                    style={
                      styles.progressSection
                    }
                  >

                    <View
                      style={
                        styles.progressHeader
                      }
                    >

                      <Text
                        style={
                          styles.progressLabel
                        }
                      >
                        Principal Paid
                      </Text>


                      <Text
                        style={
                          styles.progressPercent
                        }
                      >
                        {
                          progress.toFixed(
                            0
                          )
                        }%
                      </Text>

                    </View>


                    <View
                      style={
                        styles.progressTrack
                      }
                    >

                      <View
                        style={[
                          styles.progressFill,

                          {
                            width:
                              `${progress}%`,
                          },
                        ]}
                      />

                    </View>


                    <Text
                      style={
                        styles.progressText
                      }
                    >
                      ₹
                      {paid.toLocaleString(
                        'en-IN'
                      )}{' '}
                      paid of ₹
                      {original.toLocaleString(
                        'en-IN'
                      )}
                    </Text>

                  </View>


                  {/* =================================================
                      FOOTER
                     ================================================= */}

                  <View
                    style={
                      styles.loanFooter
                    }
                  >

                    <View
                      style={
                        styles.footerInfoGroup
                      }
                    >

                      <View>

                        <Text
                          style={
                            styles.footerLabel
                          }
                        >
                          Total Tenure
                        </Text>


                        <Text
                          style={
                            styles.footerValue
                          }
                        >
                          {
                            Number(
                              loan.tenureMonths ||
                              0
                            )
                          }{' '}
                          months
                        </Text>

                      </View>


                      <View>

                        <Text
                          style={
                            styles.footerLabel
                          }
                        >
                          Remaining
                        </Text>


                        <Text
                          style={
                            styles.footerValue
                          }
                        >
                          {
                            Number(
                              loan.remainingMonths ||
                              0
                            )
                          }{' '}
                          months
                        </Text>

                      </View>


                      <View>

                        <Text
                          style={
                            styles.footerLabel
                          }
                        >
                          Next EMI
                        </Text>


                        <Text
                          style={
                            styles.footerValue
                          }
                        >
                          {
                            formatLoanDate(
                              (
                                loan as
                                LoanWithSchedule
                              ).nextEmiDate
                            )
                          }
                        </Text>

                      </View>


                      <View>

                        <Text
                          style={
                            styles.footerLabel
                          }
                        >
                          Last EMI
                        </Text>


                        <Text
                          style={
                            styles.footerValue
                          }
                        >
                          {
                            formatLoanDate(
                              (
                                loan as
                                LoanWithSchedule
                              ).lastEmiDate
                            )
                          }
                        </Text>

                      </View>

                    </View>


                    {/* ACTIONS */}

                    <View
                      style={
                        styles.actions
                      }
                    >

                      {/* VIEW */}

                      <ActionButton
                        label="View"

                        onPress={() =>
                          openViewLoan(
                            loan
                          )
                        }
                      />


                      {/* EDIT */}

                      <ActionButton
                        label="Edit"

                        onPress={() =>
                          openEditLoan(
                            loan
                          )
                        }
                      />


                      {/* DELETE */}

                      <ActionButton
                        label={
                          isDeleting
                            ? 'Deleting...'
                            : 'Delete'
                        }

                        danger

                        disabled={
                          isDeleting
                        }

                        onPress={() =>
                          confirmDelete(
                            loan
                          )
                        }
                      />

                    </View>

                  </View>

                </View>
              );
            }
          )
        )
      }


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
 * METRIC
 * =========================================================
 */

function Metric({
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
        styles.metric
      }
    >

      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>


      <Text
        style={
          primary
            ? styles.metricValuePrimary
            : styles.metricValue
        }
      >
        {value}
      </Text>

    </View>
  );
}


/*
 * =========================================================
 * ACTION BUTTON
 * =========================================================
 */

function ActionButton({
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {

  return (
    <Pressable
      style={[
        styles.actionButton,

        danger &&
          styles.actionButtonDanger,

        disabled &&
          styles.actionButtonDisabled,
      ]}

      onPress={
        onPress
      }

      disabled={
        disabled
      }
    >

      <Text
        style={[
          styles.actionButtonText,

          danger &&
            styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>

    </Pressable>
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
      paddingBottom: 40,
    },


    loading: {
      flex: 1,

      justifyContent:
        'center',

      alignItems:
        'center',

      backgroundColor:
        '#F4F8F5',
    },


    loadingText: {
      marginTop: 10,

      color:
        '#637068',
    },


    header: {
      paddingHorizontal: 28,

      paddingTop: 26,

      paddingBottom: 20,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },


    title: {
      fontSize: 28,

      fontWeight:
        '800',

      color:
        '#17221B',
    },


    subtitle: {
      marginTop: 5,

      fontSize: 13,

      color:
        '#748078',
    },


    addButton: {
      paddingHorizontal: 16,

      paddingVertical: 10,

      borderRadius: 9,

      backgroundColor:
        '#16803A',
    },


    addButtonText: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '800',
    },


    summaryContainer: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 12,

      paddingHorizontal: 24,
    },


    summaryCard: {
      flexGrow: 1,

      flexBasis: 220,

      minHeight: 115,

      backgroundColor:
        '#FFFFFF',

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#E1EAE4',

      padding: 17,
    },


    summaryLabel: {
      fontSize: 11,

      fontWeight:
        '600',

      color:
        '#718078',
    },


    summaryValue: {
      marginTop: 7,

      fontSize: 21,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    summaryHint: {
      marginTop: 4,

      fontSize: 10,

      color:
        '#98A39D',
    },


    searchContainer: {
      marginHorizontal: 24,

      marginTop: 22,
    },


    searchInput: {
      height: 43,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#DDE6E0',

      borderRadius: 9,

      paddingHorizontal: 14,

      fontSize: 12,

      color:
        '#1B2921',
    },


    filterRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 8,

      marginHorizontal: 24,

      marginTop: 12,
    },


    filterButton: {
      paddingHorizontal: 13,

      paddingVertical: 8,

      borderRadius: 8,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#DDE6E0',
    },


    filterButtonActive: {
      backgroundColor:
        '#16803A',

      borderColor:
        '#16803A',
    },


    filterText: {
      fontSize: 10,

      fontWeight:
        '700',

      color:
        '#65736B',
    },


    filterTextActive: {
      color:
        '#FFFFFF',
    },


    sectionHeader: {
      paddingHorizontal: 28,

      paddingTop: 27,

      paddingBottom: 13,
    },


    sectionTitle: {
      fontSize: 20,

      fontWeight:
        '800',

      color:
        '#17221B',
    },


    sectionSubtitle: {
      marginTop: 3,

      fontSize: 11,

      color:
        '#7B8780',
    },


    loanCard: {
      marginHorizontal: 24,

      marginBottom: 13,

      padding: 19,

      backgroundColor:
        '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#E1EAE4',
    },


    loanHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },


    loanIdentity: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },


    loanIcon: {
      width: 43,

      height: 43,

      borderRadius: 11,

      backgroundColor:
        '#EAF4ED',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 11,
    },


    loanIconText: {
      fontSize: 18,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    loanName: {
      fontSize: 16,

      fontWeight:
        '800',

      color:
        '#17221B',
    },


    lender: {
      marginTop: 3,

      fontSize: 11,

      color:
        '#78847D',
    },


    statusBadge: {
      paddingHorizontal: 9,

      paddingVertical: 5,

      borderRadius: 20,
    },


    statusActive: {
      backgroundColor:
        '#E8F6EC',
    },


    statusClosed: {
      backgroundColor:
        '#EEF0F1',
    },


    statusPaused: {
      backgroundColor:
        '#FFF4DD',
    },


    statusText: {
      fontSize: 9,

      fontWeight:
        '800',
    },


    statusTextActive: {
      color:
        '#16803A',
    },


    statusTextClosed: {
      color:
        '#66716B',
    },


    statusTextPaused: {
      color:
        '#A66A00',
    },


    divider: {
      height: 1,

      backgroundColor:
        '#EDF1EE',

      marginVertical: 16,
    },


    metrics: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 15,
    },


    metric: {
      flex: 1,

      minWidth: 115,
    },


    metricLabel: {
      fontSize: 10,

      color:
        '#7B8780',
    },


    metricValue: {
      marginTop: 4,

      fontSize: 13,

      fontWeight:
        '700',

      color:
        '#27322C',
    },


    metricValuePrimary: {
      marginTop: 4,

      fontSize: 15,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    progressSection: {
      marginTop: 17,
    },


    progressHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',
    },


    progressLabel: {
      fontSize: 10,

      color:
        '#7B8780',
    },


    progressPercent: {
      fontSize: 10,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    progressTrack: {
      height: 6,

      marginTop: 7,

      borderRadius: 6,

      backgroundColor:
        '#E8EFEB',

      overflow:
        'hidden',
    },


    progressFill: {
      height: 6,

      borderRadius: 6,

      backgroundColor:
        '#16803A',
    },


    progressText: {
      marginTop: 5,

      fontSize: 9,

      color:
        '#8A958F',
    },


    loanFooter: {
      marginTop: 17,

      paddingTop: 14,

      borderTopWidth: 1,

      borderTopColor:
        '#EDF1EE',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },


    footerInfoGroup: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap: 22,

      flexShrink: 1,
    },


    footerLabel: {
      fontSize: 9,

      color:
        '#89948E',
    },


    footerValue: {
      marginTop: 3,

      fontSize: 12,

      fontWeight:
        '700',

      color:
        '#27322C',
    },


    actions: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,
    },


    actionButton: {
      paddingHorizontal: 11,

      paddingVertical: 8,

      borderRadius: 8,

      backgroundColor:
        '#EAF4ED',
    },


    actionButtonDanger: {
      backgroundColor:
        '#FFF0EE',
    },


    actionButtonDisabled: {
      opacity: 0.55,
    },


    actionButtonText: {
      fontSize: 10,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    actionButtonTextDanger: {
      color:
        '#C0392B',
    },


    emptyCard: {
      marginHorizontal: 24,

      padding: 35,

      borderRadius: 16,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      borderWidth: 1,

      borderColor:
        '#E1EAE4',
    },


    emptyIcon: {
      width: 55,

      height: 55,

      borderRadius: 15,

      backgroundColor:
        '#EAF4ED',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    emptyIconText: {
      fontSize: 23,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    emptyTitle: {
      marginTop: 13,

      fontSize: 17,

      fontWeight:
        '800',

      color:
        '#17221B',
    },


    emptyText: {
      marginTop: 6,

      maxWidth: 400,

      textAlign:
        'center',

      fontSize: 12,

      lineHeight: 19,

      color:
        '#7B8780',
    },

    bottomSpace: {
  height: 30,
},


    /*
     * =====================================================
     * VIEW HEADER
     * =====================================================
     */

    viewHeader: {
      height: 64,

      paddingHorizontal: 24,

      backgroundColor:
        '#FFFFFF',

      borderBottomWidth: 1,

      borderBottomColor:
        '#DFE8E2',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },


    backButton: {
      minWidth: 110,

      paddingHorizontal: 12,

      paddingVertical: 8,

      borderRadius: 8,

      backgroundColor:
        '#EAF4ED',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    backButtonText: {
      fontSize: 11,

      fontWeight:
        '800',

      color:
        '#16803A',
    },


    viewHeaderTitle: {
      fontSize: 15,

      fontWeight:
        '800',

      color:
        '#17221B',
    },


    headerSpacer: {
      minWidth: 110,
    },

  });