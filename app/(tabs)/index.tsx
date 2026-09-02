import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useRouter,
} from 'expo-router';


import {
  DashboardSummary,
  getDashboardSummary,
} from '../../src/services/dashboardService';

import {
  getLoans,
} from '../../src/services/loanService';

import {
  getAllPayments,
} from '../../src/services/paymentService';

import {
  Payment,
} from '../../src/models/payment';

import {
  generateAdjustedLoanSchedule,
} from '../../src/engine/loanSchedule';

import {
  LoanPosition,
} from '../../src/engine/loanPosition';

import {
  calculateTargetPerformance,
  TargetPerformance,
} from '../../src/engine/targetPerformance';


export default function DashboardScreen() {

  const router = useRouter();

  /*
   * =====================================================
   * STATE
   * =====================================================
   */

  const [summary, setSummary] =
    useState<DashboardSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [payments, setPayments] =
    useState<Payment[]>([]);


  /*
   * =====================================================
   * LOAD DASHBOARD
   * =====================================================
   */

  const loadDashboard =
    useCallback(async () => {

      try {

        /*
         * Keep the existing dashboard service because it supplies
         * target information and the normal dashboard structure.
         *
         * We separately load actual payments and recalculate the
         * financial position using the same payment-aware engine
         * used by the Loans screen.
         */
        const [
          baseSummary,
          loans,
          payments,
        ] = await Promise.all([
          getDashboardSummary(),
          getLoans(),
          getAllPayments(),
        ]);

        setPayments(
          Array.isArray(payments)
            ? payments
            : []
        );

        const calculatedLoans =
          loans.map((loan) => {
            const safePayments =
              Array.isArray(payments) ? payments : [];

            const loanPayments =
              safePayments.filter(
                (payment) =>
                  payment.loanId === loan.id
              );

            const position =
              generateAdjustedLoanSchedule(
                loan,
                loanPayments,
                new Date()
              );

            const principalPaid =
              loanPayments.reduce(
                (sum, payment) =>
                  sum + (Number(payment.principal) || 0),
                0
              );

            const interestPaid =
              loanPayments.reduce(
                (sum, payment) =>
                  sum + (Number(payment.interest) || 0),
                0
              );

            const originalPrincipal =
              Number(loan.originalPrincipal) || 0;

            const currentOutstanding =
              Number(position.currentOutstanding) || 0;

            const positionForSummary: LoanPosition = {
              originalPrincipal,
              currentOutstanding,
              principalPaid: Math.max(
                principalPaid,
                Math.max(0, originalPrincipal - currentOutstanding)
              ),
              interestPaid,
              installmentsDue: Number(position.paidInstallments) || 0,
              installmentsRemaining: Number(position.remainingMonths) || 0,
              remainingMonths: Number(position.remainingMonths) || 0,
              repaymentPercentage:
                originalPrincipal > 0
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((Math.max(0, originalPrincipal - currentOutstanding)) /
                          originalPrincipal) *
                          100
                      )
                    )
                  : 0,
              nextEmiDate: position.nextEmiDate
                ? position.nextEmiDate.toISOString()
                : null,
              maturityDate: position.lastEmiDate
                ? position.lastEmiDate.toISOString()
                : position.maturityDate
                  ? position.maturityDate.toISOString()
                  : null,
              asOfDate: new Date().toISOString().substring(0, 10),
            };

            return {
              loan: {
                ...loan,
                currentOutstanding,
                remainingMonths: position.remainingMonths,
                nextEmiDate: position.nextEmiDate,
                lastEmiDate: position.lastEmiDate,
              },
              position: positionForSummary,
              principalPaid: positionForSummary.principalPaid,
              interestPaid: positionForSummary.interestPaid,
            };
          });

        const activeLoans =
          calculatedLoans.filter(
            (item) =>
              item.loan.status === 'ACTIVE'
          );

        const totalOutstanding =
          activeLoans.reduce(
            (sum, item) =>
              sum +
              (Number(
                item.position.currentOutstanding
              ) || 0),
            0
          );

        const totalPrincipalPaid =
          activeLoans.reduce(
            (sum, item) =>
              sum +
              (Array.isArray(payments) ? payments : [])
                .filter(
                  (payment) =>
                    payment.loanId === item.loan.id
                )
                .reduce(
                  (paymentSum, payment) =>
                    paymentSum +
                    (Number(payment.principal) || 0),
                  0
                ),
            0
          );

        const totalInterestPaid =
          activeLoans.reduce(
            (sum, item) =>
              sum +
              (Array.isArray(payments) ? payments : [])
                .filter(
                  (payment) =>
                    payment.loanId === item.loan.id
                )
                .reduce(
                  (paymentSum, payment) =>
                    paymentSum +
                    (Number(payment.interest) || 0),
                  0
                ),
            0
          );

        const totalMonthlyEMI =
          activeLoans.reduce(
            (sum, item) =>
              sum +
              (Number(item.loan.emi) || 0),
            0
          );

        const nextLoan =
          activeLoans
            .filter(
              (item) =>
                !!item.position.nextEmiDate
            )
            .sort(
              (a, b) =>
                new Date(
                  a.position.nextEmiDate!
                ).getTime() -
                new Date(
                  b.position.nextEmiDate!
                ).getTime()
            )[0];

        const data: DashboardSummary = {
          ...baseSummary,
          totalOutstanding,
          totalPrincipalPaid,
          totalInterestPaid,
          totalMonthlyEMI,
          activeLoans: activeLoans.length,
          nextEMIDate:
            nextLoan?.position.nextEmiDate
              ? nextLoan.position.nextEmiDate
              : null,
          nextEMIAmount:
            nextLoan
              ? Number(nextLoan.loan.emi) || 0
              : 0,
          loans: calculatedLoans
            .filter(
              (item) =>
                item.loan.status !== 'CLOSED'
            ),
        };

        setSummary(data);

      } catch (error) {

        console.error(
          'Dashboard loading failed:',
          error
        );

      } finally {

        setLoading(false);
        setRefreshing(false);

      }

    }, []);


  /*
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */

  useEffect(() => {

    loadDashboard();

  }, [loadDashboard]);


  /*
   * =====================================================
   * REFRESH
   * =====================================================
   */

  const handleRefresh =
    async () => {

      setRefreshing(true);

      await loadDashboard();

    };


  /*
   * =====================================================
   * TARGET PERFORMANCE
   * =====================================================
   */

  let targetPerformance:
    | TargetPerformance
    | null = null;

  if (
    summary?.target?.targetDate
  ) {
    const targetDate = new Date(
      summary.target.targetDate
    );

    if (!Number.isNaN(targetDate.getTime())) {
      targetPerformance =
        calculateTargetPerformance(
          summary.loans.map(
            (item) => item.loan
          ),
          targetDate
        );
    }
  }

  const targetCurrentOutstanding =
    Number(
      targetPerformance?.currentOutstanding
    ) || 0;

  const targetExpectedOutstanding =
    Math.max(
      0,
      targetCurrentOutstanding -
        (Number(
          targetPerformance?.currentMonthEMIPrincipal
        ) || 0) -
        (Number(
          targetPerformance?.requiredAdditionalPrincipal
        ) || 0)
    );

  const targetActualReduction =
    Number(
      (targetPerformance as
        | (TargetPerformance & {
            actualReduction?: number;
          })
        | null)?.actualReduction
    ) ||
    Math.max(
      0,
      Number(
        summary?.target?.baselineOutstanding || 0
      ) - targetCurrentOutstanding
    );

  const targetExpectedReduction =
    Number(
      (targetPerformance as
        | (TargetPerformance & {
            expectedReduction?: number;
          })
        | null)?.expectedReduction
    ) ||
    Math.max(
      0,
      Number(
        summary?.target?.baselineOutstanding || 0
      ) - targetExpectedOutstanding
    );

  const targetReductionDifference =
    Number(
      (targetPerformance as
        | (TargetPerformance & {
            reductionDifference?: number;
          })
        | null)?.reductionDifference
    ) ||
    targetActualReduction -
      targetExpectedReduction;


  /*
   * =====================================================
   * REPAYMENT PROGRESS
   *
   * This is presentation-only.
   * We do NOT modify the existing financial engine.
   * =====================================================
   */

  const totalOutstanding =
    Number(
      summary?.totalOutstanding || 0
    );


  const totalPrincipalPaid =
    Number(
      summary?.totalPrincipalPaid || 0
    );


  const originalPrincipal =
    totalOutstanding +
    totalPrincipalPaid;


  const repaymentPercent =
    originalPrincipal > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              totalPrincipalPaid /
              originalPrincipal
            ) * 100
          )
        )
      : 0;


  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {

    return (
      

        <View
          style={styles.loading}
        >

          <ActivityIndicator
            size="large"
          />

          <Text
            style={styles.loadingText}
          >
            Loading your financial position...
          </Text>

        </View>

      
    );

  }


  /*
   * =====================================================
   * DASHBOARD
   * =====================================================
   */

  return (

    

      <View
        style={styles.container}
      >

        <ScrollView

          showsVerticalScrollIndicator={
            false
          }

          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={
                handleRefresh
              }
            />
          }

          contentContainerStyle={
            styles.content
          }

        >

          {/* =================================================
              PAGE HEADER
             ================================================= */}

          <View
            style={styles.pageHeader}
          >

            <Text
              style={styles.title}
            >
              Financial Dashboard
            </Text>

            <Text
              style={styles.subtitle}
            >
              Your complete financial picture at a glance
            </Text>

          </View>


          {/* =================================================
              SUMMARY CARDS
             ================================================= */}

          <View
            style={styles.summaryGrid}
          >

            <DashboardMetricCard
              title="Total Outstanding"
              value={formatCurrency(
                summary?.totalOutstanding ??
                  0
              )}
              caption="Current balance"
              icon="₹"
              variant="green"
            />


            <DashboardMetricCard
              title="Monthly EMI"
              value={formatCurrency(
                summary?.totalMonthlyEMI ??
                  0
              )}
              caption="Monthly commitment"
              icon="↻"
              variant="blue"
            />


            <DashboardMetricCard
              title="Active Loans"
              value={String(
                summary?.activeLoans ??
                  0
              )}
              caption="Currently active"
              icon="▣"
              variant="purple"
            />


            <DashboardMetricCard
              title="Principal Paid"
              value={formatCurrency(
                summary?.totalPrincipalPaid ??
                  0
              )}
              caption="Amount repaid"
              icon="↓"
              variant="orange"
            />


            <DashboardMetricCard
              title="Interest Paid"
              value={formatCurrency(
                summary?.totalInterestPaid ??
                  0
              )}
              caption="Interest paid to date"
              icon="%"
              variant="red"
            />

          </View>


          {/* =================================================
              NEXT EMI
             ================================================= */}

          <View
            style={styles.nextEMICard}
          >

            <View
              style={styles.sectionHeaderRow}
            >

              <View>

                <Text
                  style={styles.cardTitle}
                >
                  Next EMI
                </Text>

                <Text
                  style={styles.sectionDescription}
                >
                  Your upcoming loan commitment
                </Text>

              </View>

              <View
                style={styles.nextEMIIcon}
              >
                <Text
                  style={styles.nextEMIIconText}
                >
                  ₹
                </Text>
              </View>

            </View>


            {summary?.nextEMIDate ? (

              <View
                style={styles.nextEMIRow}
              >

                <View>

                  <Text
                    style={styles.nextEMILabel}
                  >
                    Upcoming payment
                  </Text>

                  <Text
                    style={styles.nextEMIAmount}
                  >
                    {formatCurrency(
                      summary.nextEMIAmount ??
                        0
                    )}
                  </Text>

                </View>


                <View
                  style={styles.nextEMIDateBox}
                >

                  <Text
                    style={styles.nextEMIDateLabel}
                  >
                    DUE DATE
                  </Text>

                  <Text
                    style={styles.nextEMIDate}
                  >
                    {formatDate(
                      new Date(
                        summary.nextEMIDate
                      )
                    )}
                  </Text>

                </View>

              </View>

            ) : (

              <Text
                style={styles.muted}
              >
                No upcoming EMI found.
              </Text>

            )}

          </View>


          {/* =================================================
              REPAYMENT PROGRESS
             ================================================= */}

          <View
            style={styles.progressCard}
          >

            <View
              style={styles.progressHeader}
            >

              <View>

                <Text
                  style={styles.cardTitle}
                >
                  Repayment Progress
                </Text>

                <Text
                  style={styles.sectionDescription}
                >
                  Principal repaid against your current debt
                </Text>

              </View>


              <Text
                style={styles.progressPercent}
              >
                {repaymentPercent.toFixed(1)}%
              </Text>

            </View>


            <View
              style={styles.progressAmountRow}
            >

              <View>

                <Text
                  style={styles.smallLabel}
                >
                  Principal Paid
                </Text>

                <Text
                  style={styles.progressAmount}
                >
                  {formatCurrency(
                    totalPrincipalPaid
                  )}
                </Text>

              </View>


              <View
                style={styles.progressOutstanding}
              >

                <Text
                  style={styles.smallLabel}
                >
                  Current Outstanding
                </Text>

                <Text
                  style={styles.outstandingAmount}
                >
                  {formatCurrency(
                    totalOutstanding
                  )}
                </Text>

              </View>

            </View>


            <View
              style={styles.progressTrack}
            >

              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${repaymentPercent}%`,
                  },
                ]}
              />

            </View>


            <View
              style={styles.progressFooter}
            >

              <Text
                style={styles.progressFooterText}
              >
                Original Principal
              </Text>

              <Text
                style={styles.progressFooterValue}
              >
                {formatCurrency(
                  originalPrincipal
                )}
              </Text>

            </View>

          </View>


          {/* =================================================
              DEBT-FREE TARGET
             ================================================= */}

          <View
            style={styles.targetCard}
          >

            <View
              style={styles.sectionHeaderRow}
            >

              <View
                style={styles.targetHeaderContent}
              >

                <Text
                  style={styles.cardTitle}
                >
                  🎯 Debt-Free Target
                </Text>

                <Text
                  style={styles.sectionDescription}
                >
                  Track your progress toward becoming debt-free
                </Text>

              </View>

              {targetPerformance && (
                <Pressable
                  onPress={() =>
                    router.push(
                      '/debt-free-target'
                    )
                  }
                  style={({ pressed }) => [
                    styles.targetEditButton,
                    pressed &&
                      styles.targetEditButtonPressed,
                  ]}
                >
                  <Text
                    style={styles.targetEditButtonText}
                  >
                    Edit Target
                  </Text>
                </Pressable>
              )}

            </View>

            {!targetPerformance ? (

              <View
                style={styles.targetNotSetBox}
              >

                <Text
                  style={styles.targetNotSet}
                >
                  🎯 Target Not Set
                </Text>

                <Text
                  style={styles.muted}
                >
                  Set a date by which you want all
                  your loans to be completely paid.
                </Text>

                

              </View>

            ) : (

              <>

                <View
                  style={styles.targetDates}
                >

                  <View
                    style={[
                      styles.targetDateItem,
                      styles.targetDateGreen,
                    ]}
                  >

                    <Text
                      style={styles.smallLabel}
                    >
                      Target Date
                    </Text>

                    <Text
                      style={styles.targetDateValue}
                    >
                      {formatDate(
                        targetPerformance.targetDate
                      )}
                    </Text>

                  </View>

                  <View
                    style={[
                      styles.targetDateItem,
                      styles.targetDateBlue,
                    ]}
                  >

                    <Text
                      style={styles.smallLabel}
                    >
                      Current Projection
                    </Text>

                    <Text
                      style={styles.targetDateValue}
                    >
                      {targetPerformance
                        .projectedDebtFreeDate
                        ? formatDate(
                            targetPerformance
                              .projectedDebtFreeDate
                          )
                        : 'Unable to project'}
                    </Text>

                  </View>

                </View>

                <View
                  style={[
                    styles.statusBox,
                    targetPerformance.status ===
                      'AHEAD'
                      ? styles.statusAhead
                      : targetPerformance.status ===
                        'ON_TRACK'
                      ? styles.statusTrack
                      : styles.statusBehind,
                  ]}
                >

                  <Text
                    style={styles.statusText}
                  >
                    {targetPerformance.status ===
                      'AHEAD'
                      ? '🟢 AHEAD OF TARGET'
                      : targetPerformance.status ===
                        'ON_TRACK'
                      ? '🔵 ON TRACK'
                      : '🔴 BEHIND TARGET'}
                  </Text>

                </View>

                <View
                  style={styles.performanceGrid}
                >

                  <View
                    style={[
                      styles.performanceItem,
                      styles.performanceExpected,
                    ]}
                  >
                    <Text
                      style={styles.smallLabel}
                    >
                      Expected Balance
                    </Text>

                    <Text
                      style={styles.performanceValue}
                    >
                      {formatCurrency(
                        targetExpectedOutstanding
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.performanceItem,
                      styles.performanceActual,
                    ]}
                  >
                    <Text
                      style={styles.smallLabel}
                    >
                      Actual Balance
                    </Text>

                    <Text
                      style={styles.performanceValue}
                    >
                      {formatCurrency(
                        targetPerformance
                          .currentOutstanding
                      )}
                    </Text>
                  </View>

                </View>

                <View
                  style={styles.reductionBox}
                >
                  <Text
                    style={styles.smallLabel}
                  >
                    Actual Debt Reduction
                  </Text>

                  <Text
                    style={styles.reductionValue}
                  >
                    {formatCurrency(
                      targetActualReduction
                    )}
                  </Text>

                  <Text
                    style={styles.muted}
                  >
                    Expected reduction:{' '}
                    {formatCurrency(
                      targetExpectedReduction
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.differenceBox,
                    targetReductionDifference >= 0
                      ? styles.differencePositive
                      : styles.differenceNegative,
                  ]}
                >
                  <Text
                    style={styles.smallLabel}
                  >
                    Difference vs Target
                  </Text>

                  <Text
                    style={[
                      styles.differenceValue,
                      targetReductionDifference >= 0
                        ? styles.positiveText
                        : styles.negativeText,
                    ]}
                  >
                    {targetReductionDifference >= 0
                      ? '+'
                      : ''}
                    {formatCurrency(
                      targetReductionDifference
                    )}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    router.push(
                      '/debt-free-target'
                    )
                  }
                  style={({ pressed }) => [
                    styles.targetFullButton,
                    pressed &&
                      styles.targetFullButtonPressed,
                  ]}
                >
                  <Text
                    style={styles.targetFullButtonText}
                  >
                    ✏️ Edit Debt-Free Target
                  </Text>
                </Pressable>

              </>

            )}

          </View>


          {/* =================================================
              LOAN POSITION
             ================================================= */}

          <View
            style={styles.loanPositionCard}
          >

            <View
              style={styles.sectionHeaderRow}
            >

              <View>

                <Text
                  style={styles.cardTitle}
                >
                  Loan Position
                </Text>

                <Text
                  style={styles.sectionDescription}
                >
                  Current position of each active loan
                </Text>

              </View>

              <View
                style={styles.loanCountBadge}
              >

                <Text
                  style={styles.loanCountText}
                >
                  {summary?.loans?.length ?? 0}
                </Text>

              </View>

            </View>


            {!summary?.loans ||
            summary.loans.length === 0 ? (

              <View
                style={styles.emptyLoanBox}
              >

                <Text
                  style={styles.emptyLoanTitle}
                >
                  No active loans
                </Text>

                <Text
                  style={styles.muted}
                >
                  Add a loan to see your financial
                  position here.
                </Text>

              </View>

            ) : (

              <View
                style={styles.loanList}
              >

                {summary.loans.map(
                  (item, index) => (

                    <View
                      key={item.loan.id}
                      style={[
                        styles.loanRow,

                        index ===
                          summary.loans.length - 1
                          ? styles.loanRowLast
                          : null,
                      ]}
                    >

                      <View
                        style={
                          styles.loanIdentity
                        }
                      >

                        <View
                          style={[
                            styles.loanIcon,
                            index % 3 === 0
                              ? styles.loanIconGreen
                              : index % 3 === 1
                              ? styles.loanIconBlue
                              : styles.loanIconPurple,
                          ]}
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
                            styles.loanInfo
                          }
                        >

                          <Text
                            style={
                              styles.loanName
                            }
                            numberOfLines={1}
                          >
                            {item.loan.loanName}
                          </Text>

                          <Text
                            style={
                              styles.loanLender
                            }
                            numberOfLines={1}
                          >
                            {item.loan.lender}
                          </Text>

                        </View>

                      </View>


                      <View
                        style={
                          styles.loanNumbers
                        }
                      >

                        <Text
                          style={
                            styles.loanOutstanding
                          }
                        >
                          {formatCurrency(
                            Number(
                              item.loan
                                .currentOutstanding ||
                                0
                            )
                          )}
                        </Text>

                        <Text
                          style={
                            styles.loanEMI
                          }
                        >
                          EMI{' '}
                          {formatCurrency(
                            Number(
                              item.loan.emi ||
                                0
                            )
                          )}
                        </Text>

                      </View>

                    </View>

                  )
                )}

              </View>

            )}

          </View>


        </ScrollView>

      </View>

    
  );
}


/*
 * =====================================================
 * DASHBOARD METRIC CARD
 * =====================================================
 */

function DashboardMetricCard({
  title,
  value,
  caption,
  icon,
  variant,
}: {
  title: string;
  value: string;
  caption: string;
  icon: string;
  variant:
    | 'green'
    | 'blue'
    | 'purple'
    | 'orange'
    | 'red';
}) {

  return (

    <View
      style={[
        styles.dashboardMetricCard,

        variant === 'green'
          ? styles.metricGreen
          : variant === 'blue'
          ? styles.metricBlue
          : variant === 'purple'
          ? styles.metricPurple
          : variant === 'orange'
          ? styles.metricOrange
          : styles.metricRed,
      ]}
    >

      <View
        style={styles.metricTopRow}
      >

        <View
          style={[
            styles.metricIcon,

            variant === 'green'
              ? styles.metricIconGreen
              : variant === 'blue'
              ? styles.metricIconBlue
              : variant === 'purple'
              ? styles.metricIconPurple
              : variant === 'orange'
              ? styles.metricIconOrange
              : styles.metricIconRed,
          ]}
        >

          <Text
            style={styles.metricIconText}
          >
            {icon}
          </Text>

        </View>


        <Text
          style={styles.metricTitle}
          numberOfLines={1}
        >
          {title}
        </Text>

      </View>


      <Text
        style={[
          styles.metricAmount,

          variant === 'green'
            ? styles.metricAmountGreen
            : styles.metricAmountDefault,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>


      <Text
        style={styles.metricCaption}
      >
        {caption}
      </Text>

    </View>

  );
}


/*
 * =====================================================
 * FORMATTING
 * =====================================================
 */

function formatCurrency(
  value: number
): string {

  return `₹${Math.round(
    Number(value) || 0
  ).toLocaleString('en-IN')}`;

}


function formatDate(
  value: Date
): string {

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return '-';
  }


  return value.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );

}


/*
 * =====================================================
 * STYLES
 * =====================================================
 */

const styles =
  StyleSheet.create({

    /*
     * ---------------------------------------------------
     * PAGE
     * ---------------------------------------------------
     */

    container: {
      flex: 1,
      backgroundColor: '#F1F5F9',
    },

    content: {
      width: '100%',
      maxWidth: 1400,
      alignSelf: 'center',

      paddingHorizontal: 28,
      paddingTop: 28,
      paddingBottom: 60,
    },


    /*
     * ---------------------------------------------------
     * LOADING
     * ---------------------------------------------------
     */

    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',

      backgroundColor: '#F1F5F9',
    },

    loadingText: {
      marginTop: 12,
      color: '#64748B',
      fontSize: 14,
    },


    /*
     * ---------------------------------------------------
     * PAGE HEADER
     * ---------------------------------------------------
     */

    pageHeader: {
      marginBottom: 2,
    },

    title: {
      fontSize: 30,
      fontWeight: '800',
      color: '#0F172A',
    },

    subtitle: {
      marginTop: 5,
      color: '#64748B',
      fontSize: 14,
    },


    /*
     * ---------------------------------------------------
     * SUMMARY GRID
     * ---------------------------------------------------
     */

    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,

      marginTop: 24,
    },


    /*
     * ---------------------------------------------------
     * SUMMARY CARD
     * ---------------------------------------------------
     */

    dashboardMetricCard: {
      flexGrow: 1,
      flexBasis: 210,

      minHeight: 145,

      borderRadius: 16,

      padding: 18,

      borderWidth: 1,

      overflow: 'hidden',
    },

    metricGreen: {
      backgroundColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },

    metricBlue: {
      backgroundColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },

    metricPurple: {
      backgroundColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },

    metricOrange: {
      backgroundColor: '#FFF7ED',
      borderColor: '#FED7AA',
    },

    metricRed: {
      backgroundColor: '#FFF1F2',
      borderColor: '#FECDD3',
    },


    metricTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    metricIcon: {
      width: 38,
      height: 38,

      borderRadius: 11,

      alignItems: 'center',
      justifyContent: 'center',
    },

    metricIconGreen: {
      backgroundColor: '#16A34A',
    },

    metricIconBlue: {
      backgroundColor: '#2563EB',
    },

    metricIconPurple: {
      backgroundColor: '#7C3AED',
    },

    metricIconOrange: {
      backgroundColor: '#EA580C',
    },

    metricIconRed: {
      backgroundColor: '#DC2626',
    },

    metricIconText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },

    metricTitle: {
      flex: 1,

      marginLeft: 11,

      fontSize: 13,
      fontWeight: '600',

      color: '#475569',
    },

    metricAmount: {
      marginTop: 17,

      fontSize: 24,
      fontWeight: '800',

      color: '#0F172A',
    },

    metricAmountGreen: {
      color: '#15803D',
    },

    metricAmountDefault: {
      color: '#0F172A',
    },

    metricCaption: {
      marginTop: 6,

      fontSize: 12,

      color: '#64748B',
    },


    /*
     * ---------------------------------------------------
     * COMMON SECTION
     * ---------------------------------------------------
     */

    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    cardTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: '#0F172A',
    },

    sectionDescription: {
      marginTop: 4,

      fontSize: 12,

      color: '#64748B',
    },

    muted: {
      marginTop: 7,

      color: '#64748B',

      lineHeight: 20,

      fontSize: 13,
    },


    /*
     * ---------------------------------------------------
     * NEXT EMI
     * ---------------------------------------------------
     */

    nextEMICard: {
      marginTop: 20,

      padding: 22,

      backgroundColor: '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor: '#BFDBFE',

      borderLeftWidth: 5,

      borderLeftColor: '#2563EB',
    },

    nextEMIIcon: {
      width: 42,
      height: 42,

      borderRadius: 13,

      backgroundColor: '#EFF6FF',

      alignItems: 'center',
      justifyContent: 'center',
    },

    nextEMIIconText: {
      color: '#2563EB',

      fontSize: 18,

      fontWeight: '800',
    },

    nextEMIRow: {
      marginTop: 20,

      flexDirection: 'row',

      justifyContent: 'space-between',

      alignItems: 'center',
    },

    nextEMILabel: {
      color: '#64748B',

      fontSize: 12,
    },

    nextEMIAmount: {
      marginTop: 5,

      fontSize: 28,

      fontWeight: '800',

      color: '#2563EB',
    },

    nextEMIDateBox: {
      alignItems: 'flex-end',
    },

    nextEMIDateLabel: {
      color: '#64748B',

      fontSize: 11,

      fontWeight: '700',

      letterSpacing: 0.5,
    },

    nextEMIDate: {
      marginTop: 5,

      fontSize: 17,

      fontWeight: '800',

      color: '#0F172A',
    },


    /*
     * ---------------------------------------------------
     * REPAYMENT PROGRESS
     * ---------------------------------------------------
     */

    progressCard: {
      marginTop: 20,

      padding: 22,

      backgroundColor: '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor: '#A7F3D0',

      borderLeftWidth: 5,

      borderLeftColor: '#16A34A',
    },

    progressHeader: {
      flexDirection: 'row',

      justifyContent: 'space-between',

      alignItems: 'center',
    },

    progressPercent: {
      fontSize: 25,

      fontWeight: '800',

      color: '#15803D',
    },

    progressAmountRow: {
      marginTop: 20,

      flexDirection: 'row',

      justifyContent: 'space-between',
    },

    progressAmount: {
      marginTop: 5,

      fontSize: 22,

      fontWeight: '800',

      color: '#15803D',
    },

    progressOutstanding: {
      alignItems: 'flex-end',
    },

    outstandingAmount: {
      marginTop: 5,

      fontSize: 18,

      fontWeight: '700',

      color: '#0F172A',
    },

    progressTrack: {
      height: 12,

      marginTop: 20,

      borderRadius: 10,

      backgroundColor: '#DCFCE7',

      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',

      borderRadius: 10,

      backgroundColor: '#16A34A',
    },

    progressFooter: {
      marginTop: 10,

      flexDirection: 'row',

      justifyContent: 'space-between',
    },

    progressFooterText: {
      fontSize: 12,

      color: '#64748B',
    },

    progressFooterValue: {
      fontSize: 12,

      fontWeight: '700',

      color: '#475569',
    },


    /*
     * ---------------------------------------------------
     * DEBT-FREE TARGET
     * ---------------------------------------------------
     */

    targetCard: {
      marginTop: 20,

      padding: 22,

      backgroundColor: '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor: '#DDD6FE',

      borderLeftWidth: 5,

      borderLeftColor: '#7C3AED',
    },

    targetHeaderContent: {
      flex: 1,
      minWidth: 0,
    },

    targetEditButton: {
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: '#7C3AED',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    targetEditButtonPressed: {
      opacity: 0.75,
    },

    targetEditButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },

    targetButton: {
      marginTop: 16,
      minHeight: 46,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: '#7C3AED',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },

    targetButtonPressed: {
      opacity: 0.75,
    },

    targetButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    targetFullButton: {
      marginTop: 16,
      minHeight: 46,
      borderRadius: 10,
      backgroundColor: '#7C3AED',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    targetFullButtonPressed: {
      opacity: 0.75,
    },

    targetFullButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    targetNotSetBox: {
      marginTop: 18,

      padding: 18,

      borderRadius: 12,

      backgroundColor: '#F5F3FF',
    },

    targetNotSet: {
      fontSize: 22,

      fontWeight: '800',

      color: '#7C3AED',
    },

    targetDates: {
      flexDirection: 'row',

      gap: 14,

      marginTop: 20,
    },

    targetDateItem: {
      flex: 1,

      padding: 17,

      borderRadius: 12,

      borderWidth: 1,
    },

    targetDateGreen: {
      backgroundColor: '#F0FDF4',

      borderColor: '#BBF7D0',
    },

    targetDateBlue: {
      backgroundColor: '#EFF6FF',

      borderColor: '#BFDBFE',
    },

    smallLabel: {
      color: '#64748B',

      fontSize: 12,

      fontWeight: '500',
    },

    targetDateValue: {
      marginTop: 6,

      fontSize: 19,

      fontWeight: '800',

      color: '#0F172A',
    },

    statusBox: {
      marginTop: 16,

      padding: 14,

      borderRadius: 10,
    },

    statusAhead: {
      backgroundColor: '#DCFCE7',
    },

    statusTrack: {
      backgroundColor: '#DBEAFE',
    },

    statusBehind: {
      backgroundColor: '#FEE2E2',
    },

    statusText: {
      fontSize: 13,

      fontWeight: '800',

      color: '#0F172A',
    },

    performanceGrid: {
      flexDirection: 'row',

      gap: 14,

      marginTop: 16,
    },

    performanceItem: {
      flex: 1,

      padding: 16,

      borderRadius: 12,

      borderWidth: 1,
    },

    performanceExpected: {
      backgroundColor: '#FFFBEB',

      borderColor: '#FDE68A',
    },

    performanceActual: {
      backgroundColor: '#F0FDF4',

      borderColor: '#BBF7D0',
    },

    performanceValue: {
      marginTop: 6,

      fontSize: 19,

      fontWeight: '800',

      color: '#0F172A',
    },

    reductionBox: {
      marginTop: 14,

      padding: 16,

      borderRadius: 12,

      backgroundColor: '#ECFDF5',

      borderWidth: 1,

      borderColor: '#A7F3D0',
    },

    reductionValue: {
      marginTop: 6,

      fontSize: 23,

      fontWeight: '800',

      color: '#15803D',
    },

    differenceBox: {
      marginTop: 14,

      padding: 16,

      borderRadius: 12,

      borderWidth: 1,
    },

    differencePositive: {
      backgroundColor: '#F0FDF4',

      borderColor: '#BBF7D0',
    },

    differenceNegative: {
      backgroundColor: '#FEF2F2',

      borderColor: '#FECACA',
    },

    differenceValue: {
      marginTop: 6,

      fontSize: 23,

      fontWeight: '800',
    },

    positiveText: {
      color: '#15803D',
    },

    negativeText: {
      color: '#B91C1C',
    },


    /*
     * ---------------------------------------------------
     * LOAN POSITION
     * ---------------------------------------------------
     */

    loanPositionCard: {
      marginTop: 20,

      padding: 22,

      backgroundColor: '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor: '#BFDBFE',

      borderLeftWidth: 5,

      borderLeftColor: '#2563EB',
    },

    loanCountBadge: {
      minWidth: 34,

      height: 34,

      paddingHorizontal: 10,

      borderRadius: 17,

      backgroundColor: '#EFF6FF',

      alignItems: 'center',

      justifyContent: 'center',
    },

    loanCountText: {
      fontSize: 13,

      fontWeight: '800',

      color: '#2563EB',
    },

    loanList: {
      marginTop: 12,
    },

    loanRow: {
      flexDirection: 'row',

      justifyContent: 'space-between',

      alignItems: 'center',

      paddingVertical: 16,

      borderBottomWidth: 1,

      borderBottomColor: '#E2E8F0',
    },

    loanRowLast: {
      borderBottomWidth: 0,
    },

    loanIdentity: {
      flexDirection: 'row',

      alignItems: 'center',

      flex: 1,

      minWidth: 0,
    },

    loanIcon: {
      width: 40,

      height: 40,

      borderRadius: 12,

      alignItems: 'center',

      justifyContent: 'center',

      marginRight: 12,
    },

    loanIconGreen: {
      backgroundColor: '#DCFCE7',
    },

    loanIconBlue: {
      backgroundColor: '#DBEAFE',
    },

    loanIconPurple: {
      backgroundColor: '#EDE9FE',
    },

    loanIconText: {
      fontSize: 16,

      fontWeight: '800',

      color: '#0F172A',
    },

    loanInfo: {
      flex: 1,

      minWidth: 0,
    },

    loanName: {
      fontSize: 15,

      fontWeight: '800',

      color: '#0F172A',
    },

    loanLender: {
      marginTop: 4,

      color: '#64748B',

      fontSize: 12,
    },

    loanNumbers: {
      alignItems: 'flex-end',

      marginLeft: 20,
    },

    loanOutstanding: {
      fontSize: 15,

      fontWeight: '800',

      color: '#0F172A',
    },

    loanEMI: {
      marginTop: 4,

      fontSize: 12,

      color: '#64748B',
    },

    emptyLoanBox: {
      marginTop: 16,

      padding: 18,

      borderRadius: 12,

      backgroundColor: '#F8FAFC',
    },

    emptyLoanTitle: {
      fontSize: 15,

      fontWeight: '800',

      color: '#0F172A',
    },

  });