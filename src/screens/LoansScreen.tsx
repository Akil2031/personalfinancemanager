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
import AmortizationScheduleScreen from './AmortizationScheduleScreen';

import AddLoanScreen from './AddLoanScreen';

import {
  getAllPayments,
} from '../services/paymentService';

import {
  Payment,
} from '../models/payment';

import {
  getLoanPositionMetrics,
} from '../services/loanMetricsService';


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
    selectedAmortizationLoan,
    setSelectedAmortizationLoan,
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
            await Promise.all(
              data.map(
                async (loan) => {

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
                    await getLoanPositionMetrics(
                      loan,
                      loanPayments,
                      new Date()
                    );

                  const principalPaid = position.principalPaid;
                  const interestPaid = position.interestPaid;
                  const totalPaid = position.totalPaid;
                  const authoritativeOutstanding = position.currentOutstanding;
                  const principalPaidPercent = position.principalPaidPercent;

                  return {
                    ...loan,

                    currentOutstanding: authoritativeOutstanding,
                    __principalPaid: principalPaid,
                    __interestPaid: interestPaid,
                    __totalPaid: totalPaid,
                    __principalPaidPercent: principalPaidPercent,

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
              )
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

      if (
        selectedAmortizationLoan?.id ===
        loanId
      ) {
        setSelectedAmortizationLoan(null);
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
   * AMORTIZATION SCHEDULE
   * =======================================================
   */

  if (
    selectedAmortizationLoan
  ) {
    return (
      <View
        style={
          styles.container
        }
      >
        <AmortizationScheduleScreen
          loan={
            selectedAmortizationLoan
          }
          onBack={() => {
            setSelectedAmortizationLoan(null);
          }}
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
          onOpenAmortization={(loan) => {
            setSelectedAmortizationLoan(loan);
          }}
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
          color="#159A68"
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

          tintColor="#159A68"
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
          style={[
            styles.summaryCard,
            styles.summaryCardBlue,
          ]}
        >

          <View pointerEvents="none" style={styles.summaryCircleLarge} />
          <View pointerEvents="none" style={styles.summaryCircleSmall} />

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
          style={[
            styles.summaryCard,
            styles.summaryCardPurple,
          ]}
        >

          <View pointerEvents="none" style={styles.summaryCircleLarge} />
          <View pointerEvents="none" style={styles.summaryCircleSmall} />

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
          style={[
            styles.summaryCard,
            styles.summaryCardGreen,
          ]}
        >

          <View pointerEvents="none" style={styles.summaryCircleLarge} />
          <View pointerEvents="none" style={styles.summaryCircleSmall} />

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
          style={[
            styles.summaryCard,
            styles.summaryCardOrange,
          ]}
        >

          <View pointerEvents="none" style={styles.summaryCircleLarge} />
          <View pointerEvents="none" style={styles.summaryCircleSmall} />

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
                Number(
                  (loan as Loan & { __principalPaid?: number }).__principalPaid
                ) || Math.max(0, original - outstanding);

              const progress =
                Number(
                  (loan as Loan & { __principalPaidPercent?: number }).__principalPaidPercent
                ) || (original > 0 ? Math.min(100, Math.max(0, (paid / original) * 100)) : 0);


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
                          {String(loan.loanType || 'OTHER')
                            .replace('_LOAN', '')
                            .slice(0, 2)}
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
      backgroundColor: '#FFF7D6',
    },

    content: {
      paddingBottom: 52,
    },

    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FFF7D6',
    },

    loadingText: {
      marginTop: 12,
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: '#4D5566',
    },

    header: {
      marginHorizontal: 24,
      marginTop: 24,
      marginBottom: 6,
      padding: 22,
      borderRadius: 22,
      backgroundColor: '#171A24',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 18,
      shadowColor: '#171A24',
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 9 },
      elevation: 5,
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 30,
      letterSpacing: -0.7,
      color: '#FFD83D',
    },

    subtitle: {
      marginTop: 6,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: 'rgba(255,255,255,0.70)',
    },

    addButton: {
      minHeight: 44,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#FFD83D',
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },

    addButtonText: {
      fontFamily: 'Inter_800ExtraBold',
      color: '#171A24',
      fontSize: 13,
      letterSpacing: 0.1,
    },

    summaryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      paddingHorizontal: 24,
      paddingTop: 18,
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 235,
      minHeight: 132,
      padding: 20,
      borderRadius: 20,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E7C33A',
      shadowColor: '#171A24',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
      overflow: 'hidden',
      position: 'relative',
    },

    summaryCardBlue: {
      backgroundColor: '#F4C400',
      borderColor: '#E0B300',
      shadowColor: '#B48B00',
    },

    summaryCardPurple: {
      backgroundColor: '#FFB84A',
      borderColor: '#F0A12A',
      shadowColor: '#C77800',
    },

    summaryCardGreen: {
      backgroundColor: '#E7F2A8',
      borderColor: '#C9D97A',
      shadowColor: '#8FA83A',
    },

    summaryCardOrange: {
      backgroundColor: '#FFE08A',
      borderColor: '#E7C33A',
      shadowColor: '#C89E00',
    },

    summaryLabel: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 11,
      color: '#4D3D0D',
      letterSpacing: 0.75,
      textTransform: 'uppercase',
    },

    summaryValue: {
      marginTop: 10,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 27,
      letterSpacing: -0.65,
      color: '#171A24',
    },

    summaryHint: {
      marginTop: 7,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: '#6B5A1A',
    },

    summaryCircleLarge: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      right: -58,
      top: -78,
      backgroundColor: 'rgba(23,26,36,0.07)',
    },

    summaryCircleSmall: {
      position: 'absolute',
      width: 105,
      height: 105,
      borderRadius: 53,
      left: -58,
      bottom: -70,
      backgroundColor: 'rgba(23,26,36,0.05)',
    },

    searchContainer: {
      marginHorizontal: 24,
      marginTop: 18,
    },

    searchInput: {
      height: 50,
      paddingHorizontal: 17,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2C63C',
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#171A24',
      shadowColor: '#171A24',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginHorizontal: 24,
      marginTop: 10,
    },

    filterButton: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E1C43A',
    },

    filterButtonActive: {
      backgroundColor: '#171A24',
      borderColor: '#171A24',
      shadowColor: '#171A24',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    filterText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#5B4A16',
    },

    filterTextActive: {
      color: '#FFD83D',
    },

    sectionHeader: {
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 13,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },

    sectionTitle: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 23,
      letterSpacing: -0.35,
      color: '#171A24',
    },

    sectionSubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#6B5A1A',
    },

    loanCard: {
      marginHorizontal: 24,
      marginBottom: 14,
      padding: 20,
      borderRadius: 20,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: '#E4C83E',
      shadowColor: '#171A24',
      shadowOpacity: 0.065,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    loanHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },

    loanIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },

    loanIcon: {
      width: 50,
      height: 50,
      borderRadius: 16,
      marginRight: 13,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#DDB000',
    },

    loanIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 17,
      color: '#171A24',
    },

    loanName: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 19,
      letterSpacing: -0.25,
      color: '#171A24',
    },

    lender: {
      marginTop: 4,
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#6B5A1A',
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },

    statusActive: {
      backgroundColor: '#E2F6EC',
      borderWidth: 1,
      borderColor: '#B8E5CE',
    },

    statusClosed: {
      backgroundColor: '#F1E7C4',
      borderWidth: 1,
      borderColor: '#DDCB8A',
    },

    statusPaused: {
      backgroundColor: '#FFF0D4',
      borderWidth: 1,
      borderColor: '#F1CC8A',
    },

    statusText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 10,
      letterSpacing: 0.35,
    },

    statusTextActive: {
      color: '#159A68',
    },

    statusTextClosed: {
      color: '#5B4A16',
    },

    statusTextPaused: {
      color: '#D97706',
    },

    divider: {
      height: 1,
      marginVertical: 17,
      backgroundColor: '#E4C83E',
    },

    metrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },

    metric: {
      flex: 1,
      minWidth: 125,
    },

    metricLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: '#806E2D',
    },

    metricValue: {
      marginTop: 5,
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#2B2410',
    },

    metricValuePrimary: {
      marginTop: 5,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 20,
      letterSpacing: -0.2,
      color: '#171A24',
    },

    progressSection: {
      marginTop: 19,
    },

    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    progressLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#5B4A16',
    },

    progressPercent: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 12,
      color: '#159A68',
    },

    progressTrack: {
      height: 8,
      marginTop: 8,
      borderRadius: 8,
      backgroundColor: '#E2D27D',
      overflow: 'hidden',
    },

    progressFill: {
      height: 8,
      borderRadius: 8,
      backgroundColor: '#159A68',
    },

    progressText: {
      marginTop: 6,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#806E2D',
    },

    loanFooter: {
      marginTop: 18,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: '#E4C83E',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },

    footerInfoGroup: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 24,
      flexShrink: 1,
    },

    footerLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#806E2D',
    },

    footerValue: {
      marginTop: 3,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#2B2410',
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },

    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 9,
      backgroundColor: '#171A24',
      borderWidth: 1,
      borderColor: '#171A24',
    },

    actionButtonDanger: {
      backgroundColor: '#FCE4E4',
      borderColor: '#E9A3A3',
    },

    actionButtonDisabled: {
      opacity: 0.55,
    },

    actionButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#FFD83D',
    },

    actionButtonTextDanger: {
      color: '#D93636',
    },

    emptyCard: {
      marginHorizontal: 24,
      padding: 42,
      borderRadius: 20,
      backgroundColor: '#FFF0A8',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E4C83E',
      shadowColor: '#171A24',
      shadowOpacity: 0.04,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },

    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: '#F4C400',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 26,
      color: '#171A24',
    },

    emptyTitle: {
      marginTop: 14,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
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

    bottomSpace: {
      height: 36,
    },

    viewHeader: {
      height: 66,
      paddingHorizontal: 24,
      backgroundColor: '#171A24',
      borderBottomWidth: 1,
      borderBottomColor: '#2A2E3A',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#171A24',
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    backButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: '#FFD83D',
      borderWidth: 1,
      borderColor: '#F4C400',
    },

    backButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#171A24',
    },

    viewHeaderTitle: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 17,
      color: '#FFD83D',
      letterSpacing: 0.1,
    },

    headerSpacer: {
      width: 86,
    },

  });


