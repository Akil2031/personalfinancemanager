import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Loan,
} from '../../src/models/loan';

import {
  getLoans,
} from '../../src/services/loanService';

import {
  getPortfolioLoanPositionMetrics,
  LoanPositionMetrics,
} from '../../src/services/loanMetricsService';

import {
  getAllPayments,
} from '../../src/services/paymentService';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

interface LoanWithPosition {
  loan: Loan;
  position: LoanPositionMetrics;
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function safeNumber(
  value: unknown
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    safeNumber(value)
  ).toLocaleString('en-IN')}`;
}

function formatCurrencyDecimal(
  value: number
): string {
  return `₹${safeNumber(
    value
  ).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(
  value?: string | Date | null
): string {
  if (!value) {
    return '—';
  }

  const date =
    value instanceof Date
      ? new Date(value)
      : parseDateString(
          value
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
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
 * Parse YYYY-MM-DD as local date.
 * This avoids the UTC date-shift problem.
 */
function parseDateString(
  value: string
): Date {
  const normalized =
    String(value)
      .substring(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );

  if (!match) {
    return new Date(
      value
    );
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function getDaysUntil(
  value?: string | null
): number | null {
  if (!value) {
    return null;
  }

  const target =
    parseDateString(
      value
    );

  if (
    Number.isNaN(
      target.getTime()
    )
  ) {
    return null;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  target.setHours(
    0,
    0,
    0,
    0
  );

  return Math.ceil(
    (
      target.getTime() -
      today.getTime()
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}

function getLoanTypeLabel(
  loanType: Loan['loanType']
): string {
  const labels: Record<
    Loan['loanType'],
    string
  > = {
    HOME_LOAN:
      'Home Loan',

    VEHICLE_LOAN:
      'Vehicle Loan',

    PERSONAL_LOAN:
      'Personal Loan',

    BUSINESS_LOAN:
      'Business Loan',

    GOLD_LOAN:
      'Gold Loan',

    OTHER:
      'Other',
  };

  return (
    labels[loanType] ||
    loanType
  );
}

/*
 * =========================================================
 * INSIGHT DATA
 * =========================================================
 */

interface InsightItem {
  id: string;

  severity:
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW'
    | 'POSITIVE';

  title: string;

  message: string;

  recommendation: string;
}

/*
 * =========================================================
 * MAIN
 * =========================================================
 */

export default function InsightsRoute() {
  const [
    loans,
    setLoans,
  ] = useState<Loan[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loanPositions,
    setLoanPositions,
  ] = useState<LoanWithPosition[]>([]);

  /*
   * -------------------------------------------------------
   * LOAD LOANS
   * -------------------------------------------------------
   */

  const loadLoans =
    useCallback(
      async () => {
        try {
          const [data, payments] =
            await Promise.all([
              getLoans(),
              getAllPayments(),
            ]);

          const positions =
            await getPortfolioLoanPositionMetrics(
              data,
              payments,
              new Date()
            );

          setLoans(data);
          setLoanPositions(positions);
        } catch (error) {
          console.error(
            'Insights loading failed:',
            error
          );

          setLoans([]);
          setLoanPositions([]);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadLoans();
  }, [
    loadLoans,
  ]);

  /*
   * -------------------------------------------------------
   * REFRESH
   * -------------------------------------------------------
   */

  const handleRefresh =
    async () => {
      setRefreshing(true);

      await loadLoans();
    };

  /*
   * -------------------------------------------------------
   * CALCULATE POSITIONS
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * This is the same calculation used by the Loans screen.
   *
   * Every loan position is loaded through the centralized
   * schedule-aware metrics service. Persisted lender amortization
   * is authoritative, including adjustments and prepayments.
   */

  /*
   * -------------------------------------------------------
   * ACTIVE LOANS
   * -------------------------------------------------------
   */

  const activeLoans =
    useMemo(
      () =>
        loanPositions.filter(
          item =>
            item.loan.status ===
            'ACTIVE'
        ),
      [
        loanPositions,
      ]
    );

  /*
   * -------------------------------------------------------
   * TOTAL ORIGINAL PRINCIPAL
   * -------------------------------------------------------
   */

  const totalOriginal =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            total,
            item
          ) =>
            total +
            safeNumber(
              item.loan
                .originalPrincipal
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * TOTAL OUTSTANDING
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Do NOT read loan.currentOutstanding directly.
   *
   * The position is calculated as of today.
   */

  const totalOutstanding =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            total,
            item
          ) =>
            total +
            safeNumber(
              item.position
                .currentOutstanding
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * TOTAL PRINCIPAL PAID
   * -------------------------------------------------------
   */

  const totalPrincipalPaid =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            total,
            item
          ) =>
            total +
            safeNumber(
              item.position
                .principalPaid
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * TOTAL INTEREST PAID
   * -------------------------------------------------------
   */

  const totalInterestPaid =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            total,
            item
          ) =>
            total +
            safeNumber(
              item.position
                .interestPaid
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * MONTHLY EMI
   * -------------------------------------------------------
   */

  const totalMonthlyEMI =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            total,
            item
          ) =>
            total +
            safeNumber(
              item.loan.emi
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * REPAYMENT %
   * -------------------------------------------------------
   */

  const repaymentPercentage =
    useMemo(() => {
      if (
        totalOriginal <= 0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (
            totalPrincipalPaid /
            totalOriginal
          ) *
            100
        )
      );
    }, [
      totalOriginal,
      totalPrincipalPaid,
    ]);

  /*
   * -------------------------------------------------------
   * NEXT EMI
   * -------------------------------------------------------
   */

  const upcomingLoans =
    useMemo(() => {
      return activeLoans
        .filter(
          item =>
            !!item.position
              .nextEmiDate
        )
        .slice()
        .sort(
          (
            a,
            b
          ) => {
            const da =
              a.position
                .nextEmiDate;

            const db =
              b.position
                .nextEmiDate;

            if (!da && !db) {
              return 0;
            }

            if (!da) {
              return 1;
            }

            if (!db) {
              return -1;
            }

            return (
              parseDateString(
                da
              ).getTime() -
              parseDateString(
                db
              ).getTime()
            );
          }
        );
    }, [
      activeLoans,
    ]);

  const nextLoan =
    upcomingLoans[0];

  /*
   * -------------------------------------------------------
   * HIGHEST RATE LOAN
   * -------------------------------------------------------
   */

  const highestRateLoan =
    useMemo(
      () => {
        if (
          activeLoans.length ===
          0
        ) {
          return null;
        }

        return (
          activeLoans
            .slice()
            .sort(
              (
                a,
                b
              ) =>
                safeNumber(
                  b.loan
                    .annualInterestRate
                ) -
                safeNumber(
                  a.loan
                    .annualInterestRate
                )
            )[0] ||
          null
        );
      },
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * HIGHEST EMI LOAN
   * -------------------------------------------------------
   */

  const highestEMILoan =
    useMemo(
      () => {
        if (
          activeLoans.length ===
          0
        ) {
          return null;
        }

        return (
          activeLoans
            .slice()
            .sort(
              (
                a,
                b
              ) =>
                safeNumber(
                  b.loan.emi
                ) -
                safeNumber(
                  a.loan.emi
                )
            )[0] ||
          null
        );
      },
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * LONGEST REMAINING LOAN
   * -------------------------------------------------------
   */

  const longestLoan =
    useMemo(
      () => {
        if (
          activeLoans.length ===
          0
        ) {
          return null;
        }

        return (
          activeLoans
            .slice()
            .sort(
              (
                a,
                b
              ) =>
                safeNumber(
                  b.position
                    .remainingMonths
                ) -
                safeNumber(
                  a.position
                    .remainingMonths
                )
            )[0] ||
          null
        );
      },
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * TOTAL REMAINING MONTHS
   * -------------------------------------------------------
   */

  const maximumRemainingMonths =
    useMemo(
      () =>
        activeLoans.reduce(
          (
            max,
            item
          ) =>
            Math.max(
              max,
              safeNumber(
                item.position
                  .remainingMonths
              )
            ),
          0
        ),
      [
        activeLoans,
      ]
    );

  /*
   * -------------------------------------------------------
   * INSIGHTS
   * -------------------------------------------------------
   */

  const insights =
    useMemo<
      InsightItem[]
    >(() => {
      const result: InsightItem[] =
        [];

      /*
       * No loans.
       */

      if (
        activeLoans.length ===
        0
      ) {
        result.push({
          id:
            'no-active-loans',

          severity:
            'POSITIVE',

          title:
            'No active loans',

          message:
            'You currently have no active loans to manage.',

          recommendation:
            'Your debt position is clear. Keep maintaining your savings and investment discipline.',
        });

        return result;
      }

      /*
       * HIGH INTEREST RATE
       */

      if (
        highestRateLoan &&
        safeNumber(
          highestRateLoan.loan
            .annualInterestRate
        ) >= 10
      ) {
        result.push({
          id:
            'high-interest-rate',

          severity:
            'HIGH',

          title:
            'High-interest loan',

          message:
            `${highestRateLoan.loan.loanName} has an interest rate of ${safeNumber(
              highestRateLoan.loan
                .annualInterestRate
            ).toFixed(
              2
            )}%.`,

          recommendation:
            'Consider directing surplus cash toward this loan after maintaining your emergency reserve.',
        });
      }

      /*
       * HIGH EMI COMMITMENT
       */

      if (
        highestEMILoan
      ) {
        const emi =
          safeNumber(
            highestEMILoan.loan
              .emi
          );

        if (
          totalMonthlyEMI >
            0 &&
          emi /
            totalMonthlyEMI >=
            0.5
        ) {
          result.push({
            id:
              'high-emi-concentration',

            severity:
              'MEDIUM',

            title:
              'High EMI concentration',

            message:
              `${highestEMILoan.loan.loanName} accounts for ${Math.round(
                (
                  emi /
                  totalMonthlyEMI
                ) *
                  100
              )}% of your total monthly EMI.`,

            recommendation:
              'This loan has a large impact on monthly cash flow. Consider reducing its principal when surplus funds are available.',
          });
        }
      }

      /*
       * LONG REMAINING TENURE
       */

      if (
        longestLoan &&
        safeNumber(
          longestLoan.position
            .remainingMonths
        ) >= 60
      ) {
        result.push({
          id:
            'long-tenure',

          severity:
            'MEDIUM',

          title:
            'Long repayment horizon',

          message:
            `${longestLoan.loan.loanName} has approximately ${Math.round(
              safeNumber(
                longestLoan.position
                  .remainingMonths
              )
            )} months remaining.`,

          recommendation:
            'Even small additional principal payments can help shorten a long repayment period.',
        });
      }

      /*
       * UPCOMING EMI
       */

      if (
        nextLoan
      ) {
        const days =
          getDaysUntil(
            nextLoan.position
              .nextEmiDate
          );

        if (
          days !== null &&
          days >= 0 &&
          days <= 7
        ) {
          result.push({
            id:
              'upcoming-emi',

            severity:
              'MEDIUM',

            title:
              'Upcoming EMI',

            message:
              `${nextLoan.loan.loanName} has an EMI of ${formatCurrency(
                safeNumber(
                  nextLoan.loan
                    .emi
                )
              )} due on ${formatDate(
                nextLoan.position
                  .nextEmiDate
              )}.`,

            recommendation:
              'Keep the EMI amount available in your payment account before the due date.',
          });
        }
      }

      /*
       * GOOD REPAYMENT PROGRESS
       */

      if (
        repaymentPercentage >=
        50
      ) {
        result.push({
          id:
            'strong-progress',

          severity:
            'POSITIVE',

          title:
            'Strong repayment progress',

          message:
            `You have repaid approximately ${repaymentPercentage.toFixed(
              1
            )}% of your original active-loan principal.`,

          recommendation:
            'Continue your current repayment discipline and use suitable surplus funds for principal reduction.',
        });
      } else if (
        repaymentPercentage >=
        25
      ) {
        result.push({
          id:
            'good-progress',

          severity:
            'POSITIVE',

          title:
            'Good repayment progress',

          message:
            `You have repaid approximately ${repaymentPercentage.toFixed(
              1
            )}% of your original active-loan principal.`,

          recommendation:
            'Maintaining regular EMI payments will steadily reduce your debt burden.',
        });
      }

      /*
       * LOW DEBT POSITION
       */

      if (
        totalOriginal >
          0 &&
        totalOutstanding /
          totalOriginal <=
          0.25
      ) {
        result.push({
          id:
            'low-outstanding',

          severity:
            'POSITIVE',

          title:
            'Debt is nearing completion',

          message:
            `Only approximately ${(
              (
                totalOutstanding /
                totalOriginal
              ) *
              100
            ).toFixed(
              1
            )}% of your original active-loan principal remains outstanding.`,

          recommendation:
            'Stay consistent. You are approaching the final stage of your current debt commitments.',
        });
      }

      /*
       * If nothing else generated,
       * provide a positive insight.
       */

      if (
        result.length ===
        0
      ) {
        result.push({
          id:
            'healthy-position',

          severity:
            'POSITIVE',

          title:
            'Loan position looks healthy',

          message:
            'Your current loan portfolio does not show any major warning based on the available data.',

          recommendation:
            'Continue paying EMIs on time and review opportunities for principal prepayment when surplus cash is available.',
        });
      }

      return result.slice(
        0,
        6
      );
    }, [
      activeLoans,
      highestRateLoan,
      highestEMILoan,
      longestLoan,
      nextLoan,
      repaymentPercentage,
      totalMonthlyEMI,
      totalOriginal,
      totalOutstanding,
    ]);

  /*
   * -------------------------------------------------------
   * LOADING
   * -------------------------------------------------------
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
          color="#356DFF"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading financial insights...
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
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
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
      >
        {/* =================================================
            HEADER
        ================================================== */}

        <View
          style={
            styles.pageHeader
          }
        >
          <Text
            style={
              styles.title
            }
          >
            Financial Insights
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Understand your debt position and identify opportunities to improve your finances.
          </Text>
        </View>

        {/* =================================================
            OVERVIEW
        ================================================== */}

        <View
          style={
            styles.metricsGrid
          }
        >
          <MetricCard
            label="Total Outstanding"
            tone="blue"
            value={formatCurrency(
              totalOutstanding
            )}
            caption="Calculated as of today"
            highlight
          />

          <MetricCard
            label="Monthly EMI"
            tone="green"
            value={formatCurrency(
              totalMonthlyEMI
            )}
            caption="Active loan commitments"
          />

          <MetricCard
            label="Active Loans"
            tone="purple"
            value={String(
              activeLoans.length
            )}
            caption={`${loans.length} total loans`}
          />

          <MetricCard
            label="Principal Paid"
            tone="orange"
            value={formatCurrency(
              totalPrincipalPaid
            )}
            caption={`${repaymentPercentage.toFixed(
              1
            )}% of original principal`}
          />

          <MetricCard
            label="Interest Paid"
            tone="indigo"
            value={formatCurrency(
              totalInterestPaid
            )}
            caption="Interest recognized to date"
          />
        </View>

        {/* =================================================
            REPAYMENT PROGRESS
        ================================================== */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Overall Debt Repayment
          </Text>

          <View
            style={
              styles.progressHeader
            }
          >
            <View>
              <Text
                style={
                  styles.progressLabel
                }
              >
                Principal repaid
              </Text>

              <Text
                style={
                  styles.progressValue
                }
              >
                {formatCurrency(
                  totalPrincipalPaid
                )}
              </Text>
            </View>

            <Text
              style={
                styles.progressPercent
              }
            >
              {repaymentPercentage.toFixed(
                1
              )}
              %
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
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      repaymentPercentage
                    )
                  )}%`,
                },
              ]}
            />
          </View>

          <View
            style={
              styles.progressFooter
            }
          >
            <Text
              style={
                styles.muted
              }
            >
              Original principal
            </Text>

            <Text
              style={
                styles.progressFooterValue
              }
            >
              {formatCurrency(
                totalOriginal
              )}
            </Text>
          </View>

          <View
            style={
              styles.progressFooter
            }
          >
            <Text
              style={
                styles.muted
              }
            >
              Remaining principal
            </Text>

            <Text
              style={
                styles.progressFooterValue
              }
            >
              {formatCurrency(
                totalOutstanding
              )}
            </Text>
          </View>
        </View>

        {/* =================================================
            NEXT EMI
        ================================================== */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Next EMI
          </Text>

          {!nextLoan ? (
            <View
              style={
                styles.emptyBlock
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No upcoming EMI
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                There are no active loans with a remaining EMI schedule.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.nextEMIRow
              }
            >
              <View
                style={
                  styles.nextEMILeft
                }
              >
                <Text
                  style={
                    styles.nextEMILoan
                  }
                >
                  {
                    nextLoan.loan
                      .loanName
                  }
                </Text>

                <Text
                  style={
                    styles.nextEMILender
                  }
                >
                  {
                    nextLoan.loan
                      .lender
                  }
                </Text>

                <Text
                  style={
                    styles.nextEMIType
                  }
                >
                  {getLoanTypeLabel(
                    nextLoan.loan
                      .loanType
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.nextEMIRight
                }
              >
                <Text
                  style={
                    styles.nextEMIAmount
                  }
                >
                  {formatCurrency(
                    safeNumber(
                      nextLoan.loan
                        .emi
                    )
                  )}
                </Text>

                <Text
                  style={
                    styles.nextEMIDate
                  }
                >
                  Due{' '}
                  {formatDate(
                    nextLoan.position
                      .nextEmiDate
                  )}
                </Text>

                {getDaysUntil(
                  nextLoan.position
                    .nextEmiDate
                ) !== null && (
                  <Text
                    style={
                      styles.nextEMIDays
                    }
                  >
                    {(() => {
                      const days =
                        getDaysUntil(
                          nextLoan
                            .position
                            .nextEmiDate
                        );

                      if (
                        days ===
                        null
                      ) {
                        return '';
                      }

                      if (
                        days < 0
                      ) {
                        return `${Math.abs(
                          days
                        )} days overdue`;
                      }

                      if (
                        days ===
                        0
                      ) {
                        return 'Due today';
                      }

                      return `In ${days} day${
                        days ===
                        1
                          ? ''
                          : 's'
                      }`;
                    })()}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* =================================================
            WHAT NEEDS ATTENTION
        ================================================== */}

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.cardTitle
                }
              >
                What Needs Your Attention?
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Recommendations based on your current loan position
              </Text>
            </View>

            <View
              style={
                styles.insightCount
              }
            >
              <Text
                style={
                  styles.insightCountText
                }
              >
                {
                  insights.length
                }
              </Text>
            </View>
          </View>

          <View
            style={
              styles.insightList
            }
          >
            {insights.map(
              insight => (
                <InsightCard
                  key={
                    insight.id
                  }
                  insight={
                    insight
                  }
                />
              )
            )}
          </View>
        </View>

        {/* =================================================
            LOAN POSITION
        ================================================== */}

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.cardTitle
                }
              >
                Loan Position
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Current position calculated automatically as of today
              </Text>
            </View>
          </View>

          {activeLoans.length ===
          0 ? (
            <View
              style={
                styles.emptyBlock
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                No active loans
              </Text>

              <Text
                style={
                  styles.muted
                }
              >
                Add a loan to start seeing financial insights.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.loanList
              }
            >
              {activeLoans.map(
                item => {
                  const percentage =
                    Math.min(
                      100,
                      Math.max(
                        0,
                        safeNumber(
                          item.position.principalPaidPercent
                        )
                      )
                    );

                  return (
                    <LoanInsightRow
                      key={
                        item.loan.id
                      }
                      item={
                        item
                      }
                      percentage={
                        percentage
                      }
                    />
                  );
                }
              )}
            </View>
          )}
        </View>

        {/* =================================================
            DEBT SUMMARY
        ================================================== */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.cardTitle
            }
          >
            Debt Summary
          </Text>

          <SummaryRow
            label="Original Principal"
            value={formatCurrency(
              totalOriginal
            )}
          />

          <SummaryRow
            label="Principal Paid"
            value={formatCurrency(
              totalPrincipalPaid
            )}
          />

          <SummaryRow
            label="Current Outstanding"
            value={formatCurrency(
              totalOutstanding
            )}
            strong
          />

          <SummaryRow
            label="Interest Paid"
            value={formatCurrency(
              totalInterestPaid
            )}
          />

          <SummaryRow
            label="Monthly EMI"
            value={formatCurrency(
              totalMonthlyEMI
            )}
          />

          <SummaryRow
            label="Longest Remaining Tenure"
            value={`${Math.round(
              maximumRemainingMonths
            )} months`}
          />
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
 * METRIC CARD
 * =========================================================
 */

function MetricCard({
  label,
  value,
  caption,
  tone = 'neutral',
  highlight = false,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'blue' | 'purple' | 'green' | 'orange' | 'indigo' | 'neutral';
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === 'blue' && styles.metricBlue,
        tone === 'purple' && styles.metricPurple,
        tone === 'green' && styles.metricGreen,
        tone === 'orange' && styles.metricOrange,
        tone === 'indigo' && styles.metricIndigo,
        highlight && styles.metricCardHighlight,
      ]}
    >
      <Text
        style={[
          styles.metricLabel,
          tone !== 'neutral' && styles.metricLabelColored,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.metricValue,
          tone === 'blue' && styles.metricValueBlue,
          tone === 'purple' && styles.metricValuePurple,
          tone === 'green' && styles.metricValueGreen,
          tone === 'orange' && styles.metricValueOrange,
          tone === 'indigo' && styles.metricValueIndigo,
          highlight && styles.metricValueHighlight,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.metricCaption}>
        {caption}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * INSIGHT CARD
 * =========================================================
 */

function InsightCard({
  insight,
}: {
  insight: InsightItem;
}) {
  const isHigh =
    insight.severity ===
    'HIGH';

  const isMedium =
    insight.severity ===
    'MEDIUM';

  const isPositive =
    insight.severity ===
      'POSITIVE' ||
    insight.severity ===
      'LOW';

  return (
    <View
      style={[
        styles.insightCard,

        isHigh &&
          styles.insightHigh,

        isMedium &&
          styles.insightMedium,

        isPositive &&
          styles.insightPositive,
      ]}
    >
      <View
        style={
          styles.insightTitleRow
        }
      >
        <Text
          style={
            styles.insightIcon
          }
        >
          {isHigh
            ? '!'
            : isMedium
            ? 'i'
            : '✓'}
        </Text>

        <Text
          style={
            styles.insightTitle
          }
        >
          {
            insight.title
          }
        </Text>
      </View>

      <Text
        style={
          styles.insightMessage
        }
      >
        {
          insight.message
        }
      </Text>

      <Text
        style={
          styles.insightRecommendation
        }
      >
        Recommendation: {
          insight.recommendation
        }
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * LOAN ROW
 * =========================================================
 */

function LoanInsightRow({
  item,
  percentage,
}: {
  item: LoanWithPosition;
  percentage: number;
}) {
  return (
    <View
      style={
        styles.loanRow
      }
    >
      <View
        style={
          styles.loanRowTop
        }
      >
        <View
          style={
            styles.loanIdentity
          }
        >
          <Text
            style={
              styles.loanName
            }
          >
            {
              item.loan
                .loanName
            }
          </Text>

          <Text
            style={
              styles.loanLender
            }
          >
            {
              item.loan
                .lender
            }
          </Text>
        </View>

        <View
          style={
            styles.loanOutstandingBox
          }
        >
          <Text
            style={
              styles.loanOutstanding
            }
          >
            {formatCurrency(
              item.position
                .currentOutstanding
            )}
          </Text>

          <Text
            style={
              styles.loanOutstandingLabel
            }
          >
            outstanding
          </Text>
        </View>
      </View>

      <View
        style={
          styles.loanMetrics
        }
      >
        <LoanMetric
          label="EMI"
          value={formatCurrency(
            safeNumber(
              item.position.nextEmiAmount > 0
                ? item.position.nextEmiAmount
                : item.loan.emi
            )
          )}
        />

        <LoanMetric
          label="Rate"
          value={`${safeNumber(
            item.loan
              .annualInterestRate
          ).toFixed(
            2
          )}%`}
        />

        <LoanMetric
          label="Remaining"
          value={`${Math.round(
            safeNumber(
              item.position
                .remainingMonths
            )
          )} months`}
        />

        <LoanMetric
          label="Next EMI"
          value={formatDate(
            item.position
              .nextEmiDate
          )}
        />
      </View>

      <View
        style={
          styles.loanProgressHeader
        }
      >
        <Text
          style={
            styles.loanProgressLabel
          }
        >
          Principal repaid
        </Text>

        <Text
          style={
            styles.loanProgressPercent
          }
        >
          {percentage.toFixed(
            1
          )}
          %
        </Text>
      </View>

      <View
        style={
          styles.loanProgressTrack
        }
      >
        <View
          style={[
            styles.loanProgressFill,
            {
              width: `${percentage}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

/*
 * =========================================================
 * LOAN METRIC
 * =========================================================
 */

function LoanMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.loanMetric
      }
    >
      <Text
        style={
          styles.loanMetricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.loanMetricValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * SUMMARY ROW
 * =========================================================
 */

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <Text
        style={[
          styles.summaryRowLabel,
          strong &&
            styles.summaryRowLabelStrong,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryRowValue,
          strong &&
            styles.summaryRowValueStrong,
        ]}
      >
        {value}
      </Text>
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

    scroll: { flex: 1 },

    content: {
      width: '100%',
      maxWidth: 1280,
      alignSelf: 'center',
      paddingHorizontal: 28,
      paddingTop: 30,
      paddingBottom: 70,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F7FB',
    },

    loadingText: {
      marginTop: 12,
      color: '#667085',
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
    },

    pageHeader: {
      marginBottom: 24,
    },

    title: {
      fontSize: 30,
      lineHeight: 38,
      fontFamily: 'Inter_800ExtraBold',
      color: '#172033',
      letterSpacing: -0.6,
    },

    subtitle: {
      marginTop: 6,
      maxWidth: 850,
      color: '#667085',
      fontSize: 13,
      lineHeight: 20,
      fontFamily: 'Inter_400Regular',
    },

    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },

    metricCard: {
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

    metricBlue: {
      backgroundColor: '#356DFF',
      borderColor: '#356DFF',
      shadowColor: '#2454D8',
    },
    metricPurple: {
      backgroundColor: '#7857D8',
      borderColor: '#7857D8',
      shadowColor: '#5B3FB7',
    },
    metricGreen: {
      backgroundColor: '#18A673',
      borderColor: '#18A673',
      shadowColor: '#087A55',
    },
    metricOrange: {
      backgroundColor: '#E99A32',
      borderColor: '#E99A32',
      shadowColor: '#C87818',
    },

    metricIndigo: {
      backgroundColor: '#5B4CC4',
      borderColor: '#5B4CC4',
      shadowColor: '#43359A',
    },

    metricCardHighlight: {
      borderColor: '#356DFF',
    },

    metricLabel: {
      color: '#FFFFFF',
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.65,
    },

    metricLabelColored: { color: 'rgba(255,255,255,0.82)' },

    metricValue: {
      marginTop: 11,
      color: '#FFFFFF',
      fontSize: 25,
      lineHeight: 31,
      fontFamily: 'Inter_800ExtraBold',
      letterSpacing: -0.7,
    },

    metricValueBlue: { color: '#FFFFFF' },
    metricValuePurple: { color: '#FFFFFF' },
    metricValueGreen: { color: '#FFFFFF' },
    metricValueOrange: { color: '#FFFFFF' },
    metricValueIndigo: { color: '#FFFFFF' },
    metricValueHighlight: { color: '#FFFFFF' },

    metricCaption: {
      marginTop: 7,
      color: 'rgba(255,255,255,0.72)',
      fontSize: 10,
      lineHeight: 14,
      fontFamily: 'Inter_400Regular',
    },

    card: {
      marginTop: 18,
      padding: 22,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#E7EBF3',
      shadowColor: '#172033',
      shadowOpacity: 0.035,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    },

    cardTitle: {
      color: '#172033',
      fontSize: 17,
      lineHeight: 23,
      fontFamily: 'Inter_700Bold',
      letterSpacing: -0.15,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 14,
    },

    sectionSubtitle: {
      marginTop: 5,
      color: '#7B8496',
      fontSize: 10,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
    },

    muted: {
      color: '#7B8496',
      fontSize: 10,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
    },

    progressHeader: {
      marginTop: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },

    progressLabel: {
      color: '#667085',
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
    },

    progressValue: {
      marginTop: 4,
      color: '#172033',
      fontSize: 22,
      fontFamily: 'Inter_800ExtraBold',
    },

    progressPercent: {
      color: '#3156D3',
      fontSize: 20,
      fontFamily: 'Inter_800ExtraBold',
    },

    progressTrack: {
      height: 10,
      marginTop: 14,
      backgroundColor: '#EDF1F7',
      borderRadius: 99,
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      backgroundColor: '#356DFF',
      borderRadius: 99,
    },

    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },

    progressFooterValue: {
      color: '#344054',
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
    },

    nextEMIRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 18,
      borderRadius: 16,
      backgroundColor: '#F2F5FF',
      borderWidth: 1,
      borderColor: '#DCE5FF',
    },

    nextEMILeft: { flex: 1, paddingRight: 16 },

    nextEMILoan: {
      color: '#172033',
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
    },

    nextEMILender: {
      marginTop: 3,
      color: '#667085',
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
    },

    nextEMIType: {
      marginTop: 7,
      color: '#3156D3',
      fontSize: 9,
      fontFamily: 'Inter_600SemiBold',
    },

    nextEMIRight: { alignItems: 'flex-end' },

    nextEMIAmount: {
      color: '#3156D3',
      fontSize: 22,
      fontFamily: 'Inter_800ExtraBold',
    },

    nextEMIDate: {
      marginTop: 4,
      color: '#667085',
      fontSize: 9,
      fontFamily: 'Inter_500Medium',
    },

    nextEMIDays: {
      marginTop: 5,
      color: '#C47718',
      fontSize: 9,
      fontFamily: 'Inter_700Bold',
    },

    insightCount: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: '#F2F5FF',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#DCE5FF',
    },

    insightCountText: {
      color: '#3156D3',
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
    },

    insightList: {
      marginTop: 16,
      gap: 10,
    },

    insightCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#E7EBF3',
    },

    insightHigh: { backgroundColor: '#FFF4F2', borderColor: '#F6D7D1' },
    insightMedium: { backgroundColor: '#FFF8EC', borderColor: '#F4E0BA' },
    insightPositive: { backgroundColor: '#F2F5FF', borderColor: '#DCE5FF' },

    insightTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },

    insightIcon: {
      width: 27,
      height: 27,
      borderRadius: 9,
      backgroundColor: '#FFFFFF',
      textAlign: 'center',
      textAlignVertical: 'center',
      paddingTop: 5,
      color: '#3156D3',
      fontSize: 12,
      fontFamily: 'Inter_800ExtraBold',
      overflow: 'hidden',
    },

    insightTitle: {
      flex: 1,
      color: '#172033',
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
    },

    insightMessage: {
      marginTop: 9,
      color: '#596579',
      fontSize: 10,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
    },

    insightRecommendation: {
      marginTop: 9,
      color: '#344054',
      fontSize: 9,
      lineHeight: 15,
      fontFamily: 'Inter_600SemiBold',
    },

    loanList: { marginTop: 15, gap: 10 },

    loanRow: {
      padding: 17,
      borderRadius: 16,
      backgroundColor: '#FBFCFE',
      borderWidth: 1,
      borderColor: '#E7EBF3',
    },

    loanRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    loanIdentity: { flex: 1, paddingRight: 14 },

    loanName: {
      color: '#172033',
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
    },

    loanLender: {
      marginTop: 4,
      color: '#7B8496',
      fontSize: 9,
      fontFamily: 'Inter_400Regular',
    },

    loanOutstandingBox: { alignItems: 'flex-end' },

    loanOutstanding: {
      color: '#3156D3',
      fontSize: 16,
      fontFamily: 'Inter_800ExtraBold',
    },

    loanOutstandingLabel: {
      marginTop: 3,
      color: '#98A2B3',
      fontSize: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      fontFamily: 'Inter_600SemiBold',
    },

    loanMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 15,
    },

    loanMetric: {
      minWidth: 105,
      flexGrow: 1,
      padding: 10,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#EDF0F5',
    },

    loanMetricLabel: {
      color: '#98A2B3',
      fontSize: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.35,
      fontFamily: 'Inter_600SemiBold',
    },

    loanMetricValue: {
      marginTop: 4,
      color: '#344054',
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
    },

    loanProgressHeader: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    loanProgressLabel: {
      color: '#667085',
      fontSize: 9,
      fontFamily: 'Inter_500Medium',
    },

    loanProgressPercent: {
      color: '#168A61',
      fontSize: 9,
      fontFamily: 'Inter_700Bold',
    },

    loanProgressTrack: {
      height: 7,
      marginTop: 7,
      borderRadius: 99,
      backgroundColor: '#EDF1F7',
      overflow: 'hidden',
    },

    loanProgressFill: {
      height: '100%',
      borderRadius: 99,
      backgroundColor: '#18A673',
    },

    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: '#EEF1F5',
    },

    summaryRowLabel: {
      color: '#667085',
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
    },

    summaryRowValue: {
      color: '#344054',
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
    },

    summaryRowLabelStrong: {
      color: '#172033',
      fontFamily: 'Inter_700Bold',
    },

    summaryRowValueStrong: {
      color: '#3156D3',
      fontFamily: 'Inter_800ExtraBold',
    },

    emptyBlock: {
      marginTop: 14,
      padding: 22,
      borderRadius: 15,
      backgroundColor: '#F8FAFC',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E7EBF3',
    },

    emptyTitle: {
      color: '#344054',
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
    },

    bottomSpace: { height: 20 },
  });

