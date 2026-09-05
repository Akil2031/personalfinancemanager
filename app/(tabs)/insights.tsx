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

import { theme } from '../../src/theme';

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
              parseDateString(da).getTime() -
              parseDateString(db).getTime()
            );
          }
        );
    }, [activeLoans]);

  const nextLoan = upcomingLoans[0];

  /*
   * -------------------------------------------------------
   * FINANCIAL HEALTH
   * -------------------------------------------------------
   */

  const financialHealth = useMemo(() => {
    const outstandingRatio =
      totalOriginal > 0
        ? Math.min(100, Math.max(0, (totalOutstanding / totalOriginal) * 100))
        : 0;

    const paidAmount = totalPrincipalPaid + totalInterestPaid;
    const interestShare =
      paidAmount > 0
        ? Math.min(100, Math.max(0, (totalInterestPaid / paidAmount) * 100))
        : 0;

    const weightedRateBase = activeLoans.reduce(
      (sum, item) => sum + safeNumber(item.position.currentOutstanding),
      0,
    );

    const avgRate =
      weightedRateBase > 0
        ? activeLoans.reduce(
            (sum, item) =>
              sum +
              safeNumber(item.loan.annualInterestRate) *
                safeNumber(item.position.currentOutstanding),
            0,
          ) / weightedRateBase
        : activeLoans.length > 0
        ? activeLoans.reduce(
            (sum, item) => sum + safeNumber(item.loan.annualInterestRate),
            0,
          ) / activeLoans.length
        : 0;

    const score = Math.round(
      Math.min(100, Math.max(0, 100 - outstandingRatio * 0.55 - interestShare * 0.15))
    );

    return {
      score,
      label: score >= 80 ? 'Healthy' : score >= 60 ? 'Stable' : score >= 40 ? 'Needs attention' : 'Needs focus',
      outstandingRatio,
      interestShare,
      avgRate,
    };
  }, [
    activeLoans,
    totalOriginal,
    totalOutstanding,
    totalPrincipalPaid,
    totalInterestPaid,
  ]);

  /*
   * -------------------------------------------------------
   * HIGHEST RATE LOAN
   * -------------------------------------------------------
   */

  const highestRateLoan = useMemo(
    () =>
      activeLoans.length === 0
        ? null
        : activeLoans
            .slice()
            .sort(
              (a, b) =>
                safeNumber(b.loan.annualInterestRate) -
                safeNumber(a.loan.annualInterestRate),
            )[0] || null,
    [activeLoans],
  );

  const highestEMILoan = useMemo(
    () =>
      activeLoans.length === 0
        ? null
        : activeLoans
            .slice()
            .sort(
              (a, b) => safeNumber(b.loan.emi) - safeNumber(a.loan.emi),
            )[0] || null,
    [activeLoans],
  );

  const longestLoan = useMemo(
    () =>
      activeLoans.length === 0
        ? null
        : activeLoans
            .slice()
            .sort(
              (a, b) =>
                safeNumber(b.position.remainingMonths) -
                safeNumber(a.position.remainingMonths),
            )[0] || null,
    [activeLoans],
  );

  const maximumRemainingMonths = useMemo(
    () =>
      activeLoans.reduce(
        (max, item) =>
          Math.max(max, safeNumber(item.position.remainingMonths)),
        0,
      ),
    [activeLoans],
  );

  const insights = useMemo<InsightItem[]>(() => {
    const result: InsightItem[] = [];

    if (activeLoans.length === 0) {
      return result;
    }

    if (highestRateLoan && safeNumber(highestRateLoan.loan.annualInterestRate) > 12) {
      result.push({
        id: 'high-rate',
        severity: 'HIGH',
        title: 'High-interest loan',
        message: `${highestRateLoan.loan.loanName} has the highest interest rate at ${safeNumber(highestRateLoan.loan.annualInterestRate).toFixed(2)}%.`,
        recommendation: 'Consider prioritising principal reduction on this loan when surplus funds are available.',
      });
    }

    if (highestEMILoan && totalMonthlyEMI > 0) {
      const share = (safeNumber(highestEMILoan.loan.emi) / totalMonthlyEMI) * 100;
      if (share >= 40) {
        result.push({
          id: 'emi-concentration',
          severity: 'MEDIUM',
          title: 'High EMI concentration',
          message: `${highestEMILoan.loan.loanName} contributes approximately ${share.toFixed(1)}% of your total monthly EMI.`,
          recommendation: 'This loan has a large impact on monthly cash flow. Consider reducing its principal when surplus funds are available.',
        });
      }
    }

    if (longestLoan && safeNumber(longestLoan.position.remainingMonths) >= 60) {
      result.push({
        id: 'long-tenure',
        severity: 'MEDIUM',
        title: 'Long repayment horizon',
        message: `${longestLoan.loan.loanName} has approximately ${Math.round(safeNumber(longestLoan.position.remainingMonths))} months remaining.`,
        recommendation: 'Even small additional principal payments can help shorten a long repayment period.',
      });
    }

    if (nextLoan) {
      const days = getDaysUntil(nextLoan.position.nextEmiDate);
      if (days !== null && days >= 0 && days <= 7) {
        result.push({
          id: 'upcoming-emi',
          severity: 'MEDIUM',
          title: 'Upcoming EMI',
          message: `${nextLoan.loan.loanName} has an EMI of ${formatCurrency(safeNumber(nextLoan.position.nextEmiAmount > 0 ? nextLoan.position.nextEmiAmount : nextLoan.loan.emi))} due on ${formatDate(nextLoan.position.nextEmiDate)}.`,
          recommendation: 'Keep the EMI amount available in your payment account before the due date.',
        });
      }
    }

    if (repaymentPercentage >= 50) {
      result.push({
        id: 'strong-progress',
        severity: 'POSITIVE',
        title: 'Strong repayment progress',
        message: `You have repaid approximately ${repaymentPercentage.toFixed(1)}% of your original active-loan principal.`,
        recommendation: 'Continue your current repayment discipline and use suitable surplus funds for principal reduction.',
      });
    } else if (repaymentPercentage >= 25) {
      result.push({
        id: 'good-progress',
        severity: 'POSITIVE',
        title: 'Good repayment progress',
        message: `You have repaid approximately ${repaymentPercentage.toFixed(1)}% of your original active-loan principal.`,
        recommendation: 'Maintain regular repayments and look for opportunities to reduce principal faster.',
      });
    }

    return result;
  }, [
    activeLoans,
    highestRateLoan,
    highestEMILoan,
    longestLoan,
    nextLoan,
    totalMonthlyEMI,
    repaymentPercentage,
  ]);

  const primaryInsight = insights[0] || null;

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.decorBlobOne} />
      <View pointerEvents="none" style={styles.decorBlobTwo} />
      <View pointerEvents="none" style={styles.decorCircle} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.success}
          />
        }
      >
        {/* =================================================
            HEADER
        ================================================== */}
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>FINANCIAL INTELLIGENCE</Text>
            <Text style={styles.title}>Financial Insights</Text>
            <Text style={styles.subtitle}>
              A clear view of your debt position, repayment progress,
              commitments and the opportunities that matter most.
            </Text>
          </View>

          <View style={styles.healthBadge}>
            <Text style={styles.healthBadgeLabel}>DEBT HEALTH</Text>
            <Text style={styles.healthBadgeScore}>
              {financialHealth.score}
              <Text style={styles.healthBadgeOutOf}>/100</Text>
            </Text>
            <Text style={styles.healthBadgeStatus}>
              {financialHealth.label}
            </Text>
          </View>
        </View>

        {/* =================================================
            KEY NUMBERS
        ================================================== */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Total Outstanding"
            tone="blue"
            value={formatCurrency(totalOutstanding)}
            caption="Calculated as of today"
            highlight
          />
          <MetricCard
            label="Monthly EMI"
            tone="green"
            value={formatCurrency(totalMonthlyEMI)}
            caption="Active loan commitments"
          />
          <MetricCard
            label="Active Loans"
            tone="purple"
            value={String(activeLoans.length)}
            caption={`${loans.length} total loans`}
          />
          <MetricCard
            label="Principal Paid"
            tone="orange"
            value={formatCurrency(totalPrincipalPaid)}
            caption={`${repaymentPercentage.toFixed(1)}% of original principal`}
          />
          <MetricCard
            label="Interest Paid"
            tone="green"
            value={formatCurrency(totalInterestPaid)}
            caption="Interest recognized to date"
          />
        </View>

        {/* =================================================
            PROGRESS + HEALTH
        ================================================== */}
        <View style={styles.twoColumn}>
          <View style={[styles.card, styles.flexCard]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Overall Debt Repayment</Text>
                <Text style={styles.sectionSubtitle}>
                  Progress against your original active-loan principal
                </Text>
              </View>
              <View style={styles.percentPill}>
                <Text style={styles.percentPillText}>
                  {repaymentPercentage.toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.progressHero}>
              <View style={styles.progressHeroTop}>
                <View>
                  <Text style={styles.progressLabel}>Principal repaid</Text>
                  <Text style={styles.progressValue}>
                    {formatCurrency(totalPrincipalPaid)}
                  </Text>
                </View>
                <Text style={styles.progressRemaining}>
                  {formatCurrency(totalOutstanding)} remaining
                </Text>
              </View>

              <View style={styles.progressTrackLarge}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.max(0, repaymentPercentage))}%` },
                  ]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.muted}>
                  Original {formatCurrency(totalOriginal)}
                </Text>
                <Text style={styles.muted}>
                  {Math.max(0, 100 - repaymentPercentage).toFixed(1)}% remaining
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.healthCard]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.cardTitle}>Debt Health</Text>
                <Text style={styles.sectionSubtitle}>
                  Portfolio-level snapshot
                </Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreCircleText}>
                  {financialHealth.score}
                </Text>
              </View>
            </View>

            <View style={styles.healthRows}>
              <View style={styles.healthRow}>
                <Text style={styles.healthRowLabel}>Debt remaining</Text>
                <Text style={styles.healthRowValue}>
                  {financialHealth.outstandingRatio.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.healthBar}>
                <View
                  style={[
                    styles.healthBarFill,
                    { width: `${financialHealth.outstandingRatio}%` },
                  ]}
                />
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthRowLabel}>Interest share of paid amount</Text>
                <Text style={styles.healthRowValue}>
                  {financialHealth.interestShare.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.healthBar}>
                <View
                  style={[
                    styles.healthBarFill,
                    { width: `${financialHealth.interestShare}%` },
                  ]}
                />
              </View>

              <View style={styles.healthMiniGrid}>
                <View style={styles.healthMini}>
                  <Text style={styles.healthMiniLabel}>Avg. rate</Text>
                  <Text style={styles.healthMiniValue}>
                    {financialHealth.avgRate.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.healthMini}>
                  <Text style={styles.healthMiniLabel}>Loans</Text>
                  <Text style={styles.healthMiniValue}>
                    {activeLoans.length}
                  </Text>
                </View>
                <View style={styles.healthMini}>
                  <Text style={styles.healthMiniLabel}>Tenure</Text>
                  <Text style={styles.healthMiniValue}>
                    {Math.round(maximumRemainingMonths)} mo
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* =================================================
            PRIORITY INSIGHT
        ================================================== */}
        {primaryInsight && (
          <View
            style={[
              styles.priorityCard,
              primaryInsight.severity === 'HIGH' && styles.priorityCardDanger,
              primaryInsight.severity === 'MEDIUM' && styles.priorityCardWarning,
              primaryInsight.severity === 'POSITIVE' && styles.priorityCardPositive,
            ]}
          >
            <View
              style={[
                styles.priorityIcon,
                primaryInsight.severity === 'HIGH' && styles.priorityIconDanger,
              ]}
            >
              <Text style={styles.priorityIconText}>
                {primaryInsight.severity === 'HIGH' ? '!' : '✓'}
              </Text>
            </View>
            <View style={styles.priorityContent}>
              <Text style={styles.priorityEyebrow}>TOP PRIORITY</Text>
              <Text style={styles.priorityTitle}>
                {primaryInsight.title}
              </Text>
              <Text style={styles.priorityMessage}>
                {primaryInsight.message}
              </Text>
              <Text style={styles.priorityRecommendation}>
                {primaryInsight.recommendation}
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            WHAT NEEDS ATTENTION
        ================================================== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>What Needs Your Attention?</Text>
              <Text style={styles.sectionSubtitle}>
                Recommendations based on your current loan position
              </Text>
            </View>
            <View style={styles.insightCount}>
              <Text style={styles.insightCountText}>{insights.length}</Text>
            </View>
          </View>

          <View style={styles.insightList}>
            {insights.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </View>
        </View>

        {/* =================================================
            LOAN-BY-LOAN INSIGHTS
        ================================================== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>Loan-by-Loan Insights</Text>
              <Text style={styles.sectionSubtitle}>
                Compare outstanding balance, EMI, rate and repayment progress
              </Text>
            </View>
          </View>

          {activeLoans.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>No active loans</Text>
              <Text style={styles.muted}>
                Add a loan to start seeing financial insights.
              </Text>
            </View>
          ) : (
            <View style={styles.loanList}>
              {activeLoans.map(item => {
                const percentage = Math.min(
                  100,
                  Math.max(0, safeNumber(item.position.principalPaidPercent)),
                );

                return (
                  <LoanInsightRow
                    key={item.loan.id}
                    item={item}
                    percentage={percentage}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* =================================================
            STRATEGY SNAPSHOT
        ================================================== */}
        <View style={styles.strategyGrid}>
          <View style={styles.strategyCard}>
            <Text style={styles.strategyEyebrow}>HIGHEST RATE</Text>
            <Text style={styles.strategyTitle}>
              {highestRateLoan?.loan.loanName || '—'}
            </Text>
            <Text style={styles.strategyValue}>
              {highestRateLoan
                ? `${safeNumber(highestRateLoan.loan.annualInterestRate).toFixed(2)}%`
                : '—'}
            </Text>
            <Text style={styles.strategyHint}>
              Potential priority for surplus principal reduction.
            </Text>
          </View>

          <View style={styles.strategyCard}>
            <Text style={styles.strategyEyebrow}>HIGHEST EMI</Text>
            <Text style={styles.strategyTitle}>
              {highestEMILoan?.loan.loanName || '—'}
            </Text>
            <Text style={styles.strategyValue}>
              {highestEMILoan
                ? formatCurrency(safeNumber(highestEMILoan.loan.emi))
                : '—'}
            </Text>
            <Text style={styles.strategyHint}>
              Largest recurring impact on monthly cash flow.
            </Text>
          </View>

          <View style={styles.strategyCard}>
            <Text style={styles.strategyEyebrow}>LONGEST TENURE</Text>
            <Text style={styles.strategyTitle}>
              {longestLoan?.loan.loanName || '—'}
            </Text>
            <Text style={styles.strategyValue}>
              {longestLoan
                ? `${Math.round(safeNumber(longestLoan.position.remainingMonths))} months`
                : '—'}
            </Text>
            <Text style={styles.strategyHint}>
              Extra principal can help shorten the repayment horizon.
            </Text>
          </View>
        </View>

        {/* =================================================
            DEBT SUMMARY
        ================================================== */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>Debt Summary</Text>
              <Text style={styles.sectionSubtitle}>
                Your consolidated position as of today
              </Text>
            </View>
          </View>

          <SummaryRow label="Original Principal" value={formatCurrency(totalOriginal)} />
          <SummaryRow label="Principal Paid" value={formatCurrency(totalPrincipalPaid)} />
          <SummaryRow
            label="Current Outstanding"
            value={formatCurrency(totalOutstanding)}
            strong
          />
          <SummaryRow label="Interest Paid" value={formatCurrency(totalInterestPaid)} />
          <SummaryRow label="Monthly EMI" value={formatCurrency(totalMonthlyEMI)} />
          <SummaryRow
            label="Longest Remaining Tenure"
            value={`${Math.round(maximumRemainingMonths)} months`}
          />
        </View>

        <View style={styles.bottomSpace} />
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
      backgroundColor: theme.colors.background,
    },

    scroll: { flex: 1 },

    content: {
      width: '100%',
      maxWidth: 1600,
      alignSelf: 'center',
      paddingHorizontal: 28,
      paddingTop: 30,
      paddingBottom: 70,
    },

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },

    loadingText: {
      marginTop: 12,
      color: theme.colors.textSecondary,
      fontSize: 15,
      fontFamily: 'Inter_500Medium',
    },

    pageHeader: {
      marginBottom: 24,
    },

    title: {
      fontSize: 35,
      lineHeight: 38,
      fontFamily: 'Inter_800ExtraBold',
      color: theme.colors.text,
      letterSpacing: -0.6,
    },

    subtitle: {
      marginTop: 6,
      maxWidth: 850,
      color: theme.colors.textSecondary,
      fontSize: 15,
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
      backgroundColor: '#FFD83D',
      borderColor: '#E0B900',
      shadowColor: '#B58F00',
    },
    metricPurple: {
      backgroundColor: '#FFC928',
      borderColor: '#E0A900',
      shadowColor: '#B57F00',
    },
    metricGreen: {
      backgroundColor: '#E9F6B8',
      borderColor: '#B9D95A',
      shadowColor: '#7E9D2B',
    },
    metricOrange: {
      backgroundColor: '#FFB347',
      borderColor: '#E38A19',
      shadowColor: '#B86A08',
    },

    metricIndigo: {
      backgroundColor: '#171A24',
      borderColor: '#171A24',
      shadowColor: '#0C0E15',
    },

    metricCardHighlight: {
      borderColor: '#B58F00',
    },

    metricLabel: {
      color: '#171A24',
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.65,
    },

    metricLabelColored: { color: 'rgba(23,26,36,0.70)' },

    metricValue: {
      marginTop: 11,
      color: '#FFFFFF',
      fontSize: 30,
      lineHeight: 31,
      fontFamily: 'Inter_800ExtraBold',
      letterSpacing: -0.7,
    },

    metricValueBlue: { color: '#171A24' },
    metricValuePurple: { color: '#171A24' },
    metricValueGreen: { color: '#171A24' },
    metricValueOrange: { color: '#171A24' },
    metricValueIndigo: { color: '#FFFFFF' },
    metricValueHighlight: { color: '#171A24' },

    metricCaption: {
      marginTop: 7,
      color: 'rgba(23,26,36,0.62)',
      fontSize: 12,
      lineHeight: 14,
      fontFamily: 'Inter_400Regular',
    },

    card: {
      marginTop: 18,
      padding: 22,
      backgroundColor: theme.colors.surfaceSoft,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      shadowColor: '#172033',
      shadowOpacity: 0.035,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    },

    cardTitle: {
      color: theme.colors.text,
      fontSize: 20,
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
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 15,
      fontFamily: 'Inter_400Regular',
    },

    muted: {
      color: theme.colors.textSecondary,
      fontSize: 12,
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
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
    },

    progressValue: {
      marginTop: 4,
      color: theme.colors.text,
      fontSize: 26,
      fontFamily: 'Inter_800ExtraBold',
    },

    progressPercent: {
      color: theme.colors.success,
      fontSize: 24,
      fontFamily: 'Inter_800ExtraBold',
    },

    progressTrack: {
      height: 10,
      marginTop: 14,
      backgroundColor: 'rgba(23,26,36,0.12)',
      borderRadius: 99,
      overflow: 'hidden',
    },

    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: 99,
    },

    progressFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },

    progressFooterValue: {
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },

    nextEMIRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 18,
      borderRadius: 16,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    nextEMILeft: { flex: 1, paddingRight: 16 },

    nextEMILoan: {
      color: theme.colors.text,
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
    },

    nextEMILender: {
      marginTop: 3,
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
    },

    nextEMIType: {
      marginTop: 7,
      color: theme.colors.text,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
    },

    nextEMIRight: { alignItems: 'flex-end' },

    nextEMIAmount: {
      color: theme.colors.text,
      fontSize: 26,
      fontFamily: 'Inter_800ExtraBold',
    },

    nextEMIDate: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
    },

    nextEMIDays: {
      marginTop: 5,
      color: '#C47718',
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
    },

    insightCount: {
      minWidth: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    insightCountText: {
      color: theme.colors.text,
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
    },

    insightList: {
      marginTop: 16,
      gap: 10,
    },

    insightCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    insightHigh: { backgroundColor: '#FFE0D8', borderColor: '#E6A08F' },
    insightMedium: { backgroundColor: '#FFE3A8', borderColor: '#E3B65D' },
    insightPositive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border },

    insightTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },

    insightIcon: {
      width: 27,
      height: 27,
      borderRadius: 9,
      backgroundColor: theme.colors.primarySoft,
      textAlign: 'center',
      textAlignVertical: 'center',
      paddingTop: 5,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: 'Inter_800ExtraBold',
      overflow: 'hidden',
    },

    insightTitle: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
    },

    insightMessage: {
      marginTop: 9,
      color: '#596579',
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
    },

    insightRecommendation: {
      marginTop: 9,
      color: theme.colors.text,
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'Inter_600SemiBold',
    },

    loanList: { marginTop: 15, gap: 10 },

    loanRow: {
      padding: 17,
      borderRadius: 16,
      backgroundColor: '#FFE8A3',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    loanRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    loanIdentity: { flex: 1, paddingRight: 14 },

    loanName: {
      color: theme.colors.text,
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
    },

    loanLender: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
    },

    loanOutstandingBox: { alignItems: 'flex-end' },

    loanOutstanding: {
      color: theme.colors.text,
      fontSize: 19,
      fontFamily: 'Inter_800ExtraBold',
    },

    loanOutstandingLabel: {
      marginTop: 3,
      color: theme.colors.textMuted,
      fontSize: 9,
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
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    loanMetricLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.35,
      fontFamily: 'Inter_600SemiBold',
    },

    loanMetricValue: {
      marginTop: 4,
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: 'Inter_700Bold',
    },

    loanProgressHeader: {
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },

    loanProgressLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
    },

    loanProgressPercent: {
      color: '#168A61',
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
    },

    loanProgressTrack: {
      height: 7,
      marginTop: 7,
      borderRadius: 99,
      backgroundColor: 'rgba(23,26,36,0.12)',
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
      borderBottomColor: theme.colors.border,
    },

    summaryRowLabel: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },

    summaryRowValue: {
      color: theme.colors.text,
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
    },

    summaryRowLabelStrong: {
      color: theme.colors.text,
      fontFamily: 'Inter_700Bold',
    },

    summaryRowValueStrong: {
      color: theme.colors.success,
      fontFamily: 'Inter_800ExtraBold',
    },

    emptyBlock: {
      marginTop: 14,
      padding: 22,
      borderRadius: 15,
      backgroundColor: '#FFF0A8',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    emptyTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
    },


    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 24,
      marginBottom: 24,
      padding: 26,
      borderRadius: 26,
      backgroundColor: theme.colors.primary,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      shadowColor: '#172033',
      shadowOpacity: 0.04,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },

    heroCopy: { flex: 1 },

    eyebrow: {
      color: theme.colors.text,
      fontSize: 11,
      letterSpacing: 1.1,
      fontFamily: 'Inter_800ExtraBold',
    },

    healthBadge: {
      minWidth: 150,
      paddingHorizontal: 18,
      paddingVertical: 15,
      borderRadius: 18,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },

    healthBadgeLabel: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      letterSpacing: 0.8,
      fontFamily: 'Inter_700Bold',
    },

    healthBadgeScore: {
      marginTop: 4,
      color: theme.colors.text,
      fontSize: 34,
      fontFamily: 'Inter_800ExtraBold',
    },

    healthBadgeOutOf: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
    },

    healthBadgeStatus: {
      marginTop: 1,
      color: '#168A61',
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
    },

    twoColumn: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 18,
    },

    flexCard: {
      flexGrow: 1,
      flexBasis: 520,
    },

    healthCard: {
      flexGrow: 1,
      flexBasis: 360,
    },

    percentPill: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: theme.colors.primarySoft,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    percentPillText: {
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: 'Inter_800ExtraBold',
    },

    progressHero: { marginTop: 18 },

    progressHeroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },

    progressRemaining: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },

    progressTrackLarge: {
      height: 13,
      marginTop: 16,
      backgroundColor: 'rgba(23,26,36,0.12)',
      borderRadius: 99,
      overflow: 'hidden',
    },

    healthRows: { marginTop: 16 },

    healthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },

    healthRowLabel: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
    },

    healthRowValue: {
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: 'Inter_800ExtraBold',
    },

    healthBar: {
      height: 6,
      marginTop: 7,
      borderRadius: 99,
      backgroundColor: 'rgba(23,26,36,0.12)',
      overflow: 'hidden',
    },

    healthBarFill: {
      height: '100%',
      borderRadius: 99,
      backgroundColor: theme.colors.success,
    },

    healthMiniGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
    },

    healthMini: {
      flex: 1,
      padding: 10,
      borderRadius: 12,
      backgroundColor: '#FFF0A8',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    healthMiniLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: 'Inter_600SemiBold',
    },

    healthMiniValue: {
      marginTop: 4,
      color: theme.colors.text,
      fontSize: 13,
      fontFamily: 'Inter_800ExtraBold',
    },

    priorityCard: {
      marginTop: 18,
      width: '100%',
      alignSelf: 'stretch',
      padding: 20,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryDark,
      flexDirection: 'row',
      gap: 16,
      alignItems: 'flex-start',
      shadowColor: '#172033',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },

    priorityCardDanger: {
      backgroundColor: theme.colors.danger,
      borderWidth: 1,
      borderColor: '#B92525',
      shadowColor: '#B92525',
      shadowOpacity: 0.22,
    },

    priorityCardWarning: {
      backgroundColor: theme.colors.warning,
      borderWidth: 1,
      borderColor: '#D87900',
    },

    priorityCardPositive: {
      backgroundColor: theme.colors.success,
      borderWidth: 1,
      borderColor: '#087A55',
      shadowColor: '#087A55',
    },

    priorityIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    priorityIconDanger: {
      backgroundColor: theme.colors.dangerSoft,
    },

    priorityIconText: {
      color: theme.colors.danger,
      fontSize: 21,
      fontFamily: 'Inter_800ExtraBold',
    },

    priorityContent: { flex: 1 },

    priorityEyebrow: {
      color: theme.colors.primary,
      fontSize: 9,
      letterSpacing: 1,
      fontFamily: 'Inter_800ExtraBold',
    },

    priorityTitle: {
      marginTop: 4,
      color: '#FFFFFF',
      fontSize: 19,
      fontFamily: 'Inter_800ExtraBold',
    },

    priorityMessage: {
      marginTop: 5,
      color: 'rgba(255,255,255,0.88)',
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Inter_400Regular',
    },

    priorityRecommendation: {
      marginTop: 8,
      color: '#FFFFFF',
      fontSize: 11,
      lineHeight: 15,
      fontFamily: 'Inter_600SemiBold',
    },

    strategyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 18,
    },

    strategyCard: {
      flexGrow: 1,
      flexBasis: 240,
      minHeight: 165,
      padding: 18,
      borderRadius: 18,
      backgroundColor: '#FFE08A',
      borderWidth: 1,
      borderColor: '#D9AD19',
      shadowColor: '#172033',
      shadowOpacity: 0.025,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },

    strategyEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 9,
      letterSpacing: 0.8,
      fontFamily: 'Inter_800ExtraBold',
    },

    strategyTitle: {
      marginTop: 9,
      color: theme.colors.text,
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
    },

    strategyValue: {
      marginTop: 7,
      color: theme.colors.text,
      fontSize: 25,
      fontFamily: 'Inter_800ExtraBold',
    },

    strategyHint: {
      marginTop: 7,
      color: theme.colors.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: 'Inter_400Regular',
    },

    decorBlobOne: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(255,255,255,0.18)',
      top: 80,
      right: -90,
      transform: [{ rotate: '18deg' }],
    },

    decorBlobTwo: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 36,
      backgroundColor: 'rgba(255,122,0,0.12)',
      top: 520,
      left: -80,
      transform: [{ rotate: '-16deg' }],
    },

    decorCircle: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(23,26,36,0.05)',
      top: 980,
      right: 40,
    },

    bottomSpace: { height: 20 },
  });

