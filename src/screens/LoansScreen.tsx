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
      backgroundColor: '#F3F7F6',
    },

    content: {
      paddingBottom: 44,
    },

    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F3F7F6',
    },

    loadingText: {
      marginTop: 12,
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#667085',
    },

    header: {
      paddingHorizontal: 30,
      paddingTop: 30,
      paddingBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 18,
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 30,
      letterSpacing: -0.7,
      color: '#101828',
    },

    subtitle: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#667085',
    },

    addButton: {
      minHeight: 46,
      paddingHorizontal: 19,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: '#356DFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#2454D8',
      shadowOpacity: 0.22,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },

    addButtonText: {
      fontFamily: 'Inter_700Bold',
      color: '#FFFFFF',
      fontSize: 12,
      letterSpacing: 0.1,
    },

    summaryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      paddingHorizontal: 24,
    },

    summaryCard: {
      flexGrow: 1,
      flexBasis: 225,
      minHeight: 150,
      padding: 20,
      borderRadius: 20,
      backgroundColor: '#356DFF',
      borderWidth: 1,
      borderColor: '#356DFF',
      shadowColor: '#2454D8',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
      overflow: 'hidden',
      position: 'relative',
    },

    summaryCardBlue: {
      backgroundColor: '#356DFF',
      borderColor: '#356DFF',
      shadowColor: '#2454D8',
    },

    summaryCardPurple: {
      backgroundColor: '#7857D8',
      borderColor: '#7857D8',
      shadowColor: '#5B3FB7',
    },

    summaryCardGreen: {
      backgroundColor: '#18A673',
      borderColor: '#18A673',
      shadowColor: '#087A55',
    },

    summaryCardOrange: {
      backgroundColor: '#E99A32',
      borderColor: '#E99A32',
      shadowColor: '#C87818',
    },

    summaryLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: 'rgba(255,255,255,0.82)',
      letterSpacing: 0.65,
      textTransform: 'uppercase',
    },

    summaryValue: {
      marginTop: 11,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 25,
      letterSpacing: -0.7,
      color: '#FFFFFF',
    },

    summaryHint: {
      marginTop: 7,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: 'rgba(255,255,255,0.72)',
    },

    summaryCircleLarge: {
      position: 'absolute',
      width: 145,
      height: 145,
      borderRadius: 73,
      right: -52,
      top: -72,
      backgroundColor: 'rgba(255,255,255,0.11)',
    },

    summaryCircleSmall: {
      position: 'absolute',
      width: 105,
      height: 105,
      borderRadius: 53,
      left: -58,
      bottom: -66,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },

    searchContainer: {
      marginHorizontal: 24,
      marginTop: 22,
    },

    searchInput: {
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E4E8F0',
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#101828',
      shadowColor: '#101828',
      shadowOpacity: 0.035,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },

    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginHorizontal: 24,
      marginTop: 12,
    },

    filterButton: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E1E6EF',
    },

    filterButtonActive: {
      backgroundColor: '#EAF0FF',
      borderColor: '#C9D7FF',
    },

    filterText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      color: '#667085',
    },

    filterTextActive: {
      color: '#356DFF',
    },

    sectionHeader: {
      paddingHorizontal: 28,
      paddingTop: 30,
      paddingBottom: 14,
    },

    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 19,
      letterSpacing: -0.25,
      color: '#101828',
    },

    sectionSubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#98A2B3',
    },

    loanCard: {
      marginHorizontal: 24,
      marginBottom: 14,
      padding: 20,
      borderRadius: 19,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E7EBF2',
      shadowColor: '#101828',
      shadowOpacity: 0.055,
      shadowRadius: 16,
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
      width: 48,
      height: 48,
      borderRadius: 15,
      marginRight: 13,
      backgroundColor: '#EAF0FF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#C9D7FF',
    },

    loanIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 13,
      letterSpacing: 0.2,
      color: '#356DFF',
    },

    loanName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      letterSpacing: -0.2,
      color: '#101828',
    },

    lender: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#667085',
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },

    statusActive: {
      backgroundColor: '#ECFDF3',
    },

    statusClosed: {
      backgroundColor: '#F2F4F7',
    },

    statusPaused: {
      backgroundColor: '#FFFAEB',
    },

    statusText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 0.25,
    },

    statusTextActive: {
      color: '#027A48',
    },

    statusTextClosed: {
      color: '#667085',
    },

    statusTextPaused: {
      color: '#B54708',
    },

    divider: {
      height: 1,
      marginVertical: 17,
      backgroundColor: '#EEF1F5',
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
      fontSize: 10,
      color: '#98A2B3',
    },

    metricValue: {
      marginTop: 5,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#344054',
    },

    metricValuePrimary: {
      marginTop: 5,
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 17,
      letterSpacing: -0.2,
      color: '#356DFF',
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
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      color: '#667085',
    },

    progressPercent: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: '#356DFF',
    },

    progressTrack: {
      height: 7,
      marginTop: 8,
      borderRadius: 8,
      backgroundColor: '#EAF0FF',
      overflow: 'hidden',
    },

    progressFill: {
      height: 7,
      borderRadius: 8,
      backgroundColor: '#356DFF',
    },

    progressText: {
      marginTop: 6,
      fontFamily: 'Inter_400Regular',
      fontSize: 9,
      color: '#98A2B3',
    },

    loanFooter: {
      marginTop: 18,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: '#EEF1F5',
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
      fontSize: 9,
      color: '#98A2B3',
    },

    footerValue: {
      marginTop: 3,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: '#344054',
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
      backgroundColor: '#EAF0FF',
      borderWidth: 1,
      borderColor: '#C9D7FF',
    },

    actionButtonDanger: {
      backgroundColor: '#FFF1F0',
      borderColor: '#FECACA',
    },

    actionButtonDisabled: {
      opacity: 0.55,
    },

    actionButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: '#356DFF',
    },

    actionButtonTextDanger: {
      color: '#D92D20',
    },

    emptyCard: {
      marginHorizontal: 24,
      padding: 42,
      borderRadius: 19,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E7EBF2',
      shadowColor: '#101828',
      shadowOpacity: 0.04,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },

    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 17,
      backgroundColor: '#EAF0FF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyIconText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 22,
      color: '#356DFF',
    },

    emptyTitle: {
      marginTop: 14,
      fontFamily: 'Inter_700Bold',
      fontSize: 17,
      color: '#101828',
    },

    emptyText: {
      marginTop: 7,
      maxWidth: 430,
      textAlign: 'center',
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 19,
      color: '#667085',
    },

    bottomSpace: {
      height: 34,
    },

    viewHeader: {
      height: 70,
      paddingHorizontal: 24,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E7EBF2',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    backButton: {
      minWidth: 96,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: '#EAF0FF',
      borderWidth: 1,
      borderColor: '#C9D7FF',
      alignItems: 'center',
      justifyContent: 'center',
    },

    backButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: '#356DFF',
    },

    viewHeaderTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#101828',
    },

    headerSpacer: {
      minWidth: 96,
    },

  });

