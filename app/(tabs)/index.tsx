import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { getLoans } from '../../src/services/loanService';
import { getAllPayments } from '../../src/services/paymentService';
import { getDebtFreeTarget } from '../../src/services/debtFreeTargetService';

import {
  generateAdjustedLoanSchedule,
} from '../../src/engine/loanSchedule';

import type {
  Loan,
  LoanType,
} from '../../src/models/loan';

import type {
  Payment,
} from '../../src/models/payment';

import type {
  DebtFreeTarget,
} from '../../src/models/target';

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type CalculatedLoan = {
  loan: Loan;
  position: any;
  payments: Payment[];
  principalPaid: number;
  interestPaid: number;
};

type LoanTypeAnalytics = {
  type: LoanType;
  count: number;
  activeCount: number;
  pausedCount: number;
  closedCount: number;
  outstanding: number;
  originalPrincipal: number;
  monthlyCommitment: number;
  principalPaid: number;
  interestPaid: number;
  repaymentPercent: number;
};

type UpcomingPayment = {
  loan: Loan;
  date: Date;
  amount: number;
  isInterestOnly: boolean;
};

type MonthlyPaymentPoint = {
  label: string;
  value: number;
};

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const LOAN_TYPE_META: Record<
  LoanType,
  {
    code: string;
    title: string;
    description: string;
  }
> = {
  PERSONAL_LOAN: {
    code: 'PL',
    title: 'Personal Loan',
    description: 'Personal borrowing',
  },
  GOLD_LOAN: {
    code: 'GL',
    title: 'Gold Loan',
    description: 'Gold-backed borrowing',
  },
  HOME_LOAN: {
    code: 'HL',
    title: 'Home Loan',
    description: 'Home financing',
  },
  VEHICLE_LOAN: {
    code: 'VL',
    title: 'Vehicle Loan',
    description: 'Vehicle financing',
  },
  BUSINESS_LOAN: {
    code: 'BL',
    title: 'Business Loan',
    description: 'Business borrowing',
  },
  OTHER: {
    code: 'OT',
    title: 'Other Loans',
    description: 'Other borrowing',
  },
};

const COLORS = {
  background: '#F4F7FB',
  surface: 'rgba(255,255,255,0.82)',
  surfaceSolid: '#FFFFFF',
  border: 'rgba(148,163,184,0.18)',
  text: '#14213D',
  muted: '#718096',
  subtle: '#94A3B8',
  blue: '#356DFF',
  blueDark: '#2454D8',
  blueSoft: '#EAF0FF',
  green: '#18A673',
  greenSoft: '#E8F8F1',
  orange: '#E99A32',
  orangeSoft: '#FFF4E4',
  red: '#E45C65',
  redSoft: '#FFF0F1',
  purple: '#7857D8',
  purpleSoft: '#F1EDFF',
  cyan: '#199BB5',
  cyanSoft: '#E9F8FB',
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function money(value: number): string {
  if (!Number.isFinite(value)) return '₹0';

  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function compactMoney(value: number): string {
  if (!Number.isFinite(value)) return '₹0';

  const abs = Math.abs(value);

  if (abs >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }

  if (abs >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }

  if (abs >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return money(value);
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date
    ? value
    : new Date(String(value));

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';

  const date = safeDate(value);

  if (!date) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function shortDate(value: Date | string | null | undefined): string {
  if (!value) return '—';

  const date = safeDate(value);

  if (!date) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    month: 'short',
  });
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  const b = new Date(to);

  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  return Math.ceil(
    (b.getTime() - a.getTime()) / 86400000,
  );
}

function getCommitment(loan: Loan): number {
  if (loan.repaymentType === 'INTEREST_ONLY') {
    return Number(loan.monthlyInterest || 0);
  }

  return Number(loan.emi || 0);
}

function getLoanTypeLabel(type: LoanType): string {
  return LOAN_TYPE_META[type]?.title || 'Other Loans';
}

function getLoanTypeCode(type: LoanType): string {
  return LOAN_TYPE_META[type]?.code || 'OT';
}

function calculateTargetPerformance(
  activeLoans: Loan[],
  baselineOutstanding: number,
  baselineDate: Date,
  targetDate: Date,
  additionalMonthlyPayment: number,
) {
  const now = new Date();
  const monthsToTarget = Math.max(
    0,
    (targetDate.getFullYear() - now.getFullYear()) * 12 +
      targetDate.getMonth() - now.getMonth(),
  );

  const monthlyCommitment = activeLoans.reduce(
    (sum, loan) => sum + getCommitment(loan),
    0,
  );
  const monthlyReduction = Math.max(
    0,
    monthlyCommitment + additionalMonthlyPayment,
  );
  const currentOutstanding = Math.max(
    0,
    baselineOutstanding -
      Math.max(0, monthsToTarget) * monthlyReduction,
  );
  const projectedMonths = monthlyReduction > 0
    ? Math.ceil(baselineOutstanding / monthlyReduction)
    : Infinity;
  const projectedDebtFreeDate = Number.isFinite(projectedMonths)
    ? new Date(
        baselineDate.getFullYear(),
        baselineDate.getMonth() + projectedMonths,
        baselineDate.getDate(),
      )
    : null;

  return {
    currentOutstanding,
    projectedDebtFreeDate,
    requiredAdditionalPrincipal: Math.max(
      0,
      baselineOutstanding -
        monthsToTarget * monthlyReduction,
    ),
    status: currentOutstanding <= 0
      ? 'AHEAD'
      : projectedDebtFreeDate && projectedDebtFreeDate <= targetDate
        ? 'ON_TRACK'
        : 'BEHIND',
  };
}

/* -------------------------------------------------------------------------- */
/* MAIN SCREEN                                                                */
/* -------------------------------------------------------------------------- */

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1100;
  const isTablet = width >= 700;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [target, setTarget] = useState<DebtFreeTarget | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);

      const [
        loadedLoans,
        loadedPayments,
        loadedTarget,
      ] = await Promise.all([
        getLoans(),
        getAllPayments(),
        getDebtFreeTarget(),
      ]);

      setLoans(loadedLoans || []);
      setPayments(loadedPayments || []);
      setTarget(loadedTarget || null);
    } catch (err) {
      console.error('Dashboard load error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  /* ------------------------------------------------------------------------ */
  /* CALCULATED LOANS                                                         */
  /* ------------------------------------------------------------------------ */

  const calculatedLoans = useMemo<CalculatedLoan[]>(() => {
    return loans.map((loan) => {
      const loanPayments = payments.filter(
        (payment) => payment.loanId === loan.id,
      );

      let position: any = {
        currentOutstanding: Number(
          loan.currentOutstanding || loan.originalPrincipal || 0,
        ),
        remainingMonths: Number(loan.remainingMonths || 0),
        nextEmiDate: null,
        maturityDate: safeDate(loan.maturityDate),
      };

      try {
        position = generateAdjustedLoanSchedule(
          loan,
          loanPayments,
          new Date(),
        );
      } catch (err) {
        console.warn(
          `Unable to calculate schedule for ${loan.loanName}`,
          err,
        );
      }

      const actualPrincipalPaid = loanPayments.reduce(
        (sum, payment) =>
          sum + Number(payment.principal || 0),
        0,
      );

      const actualInterestPaid = loanPayments.reduce(
        (sum, payment) =>
          sum + Number(payment.interest || 0),
        0,
      );

      const outstanding = Number(
        position.currentOutstanding ??
        loan.currentOutstanding ??
        0,
      );

      const principalReduction = Math.max(
        0,
        Number(loan.originalPrincipal || 0) - outstanding,
      );

      return {
        loan,
        position,
        payments: loanPayments,
        principalPaid: Math.max(
          actualPrincipalPaid,
          principalReduction,
        ),
        interestPaid: actualInterestPaid,
      };
    });
  }, [loans, payments]);

  /* ------------------------------------------------------------------------ */
  /* ACTIVE LOANS                                                             */
  /* ------------------------------------------------------------------------ */

  const activeLoans = useMemo(
    () =>
      calculatedLoans.filter(
        (item) => item.loan.status === 'ACTIVE',
      ),
    [calculatedLoans],
  );

  /* ------------------------------------------------------------------------ */
  /* SUMMARY                                                                  */
  /* ------------------------------------------------------------------------ */

  const summary = useMemo(() => {
    const totalOutstanding = activeLoans.reduce(
      (sum, item) =>
        sum + Number(item.position.currentOutstanding || 0),
      0,
    );

    const totalOriginalPrincipal = activeLoans.reduce(
      (sum, item) =>
        sum + Number(item.loan.originalPrincipal || 0),
      0,
    );

    const monthlyCommitment = activeLoans.reduce(
      (sum, item) =>
        sum + getCommitment(item.loan),
      0,
    );

    const principalPaid = activeLoans.reduce(
      (sum, item) =>
        sum + Number(item.principalPaid || 0),
      0,
    );

    const interestPaid = activeLoans.reduce(
      (sum, item) =>
        sum + Number(item.interestPaid || 0),
      0,
    );

    const repaymentPercent =
      totalOriginalPrincipal > 0
        ? Math.min(
            100,
            (principalPaid / totalOriginalPrincipal) * 100,
          )
        : 0;

    return {
      totalOutstanding,
      totalOriginalPrincipal,
      monthlyCommitment,
      principalPaid,
      interestPaid,
      repaymentPercent,
    };
  }, [activeLoans]);

  /* ------------------------------------------------------------------------ */
  /* LOAN TYPE ANALYTICS                                                      */
  /* ------------------------------------------------------------------------ */

  const loanTypeAnalytics = useMemo<LoanTypeAnalytics[]>(() => {
    const types = Object.keys(
      LOAN_TYPE_META,
    ) as LoanType[];

    return types
      .map((type) => {
        const typeLoans = calculatedLoans.filter(
          (item) => item.loan.loanType === type,
        );

        if (typeLoans.length === 0) {
          return null;
        }

        const active = typeLoans.filter(
          (item) => item.loan.status === 'ACTIVE',
        );

        const paused = typeLoans.filter(
          (item) => item.loan.status === 'PAUSED',
        );

        const closed = typeLoans.filter(
          (item) => item.loan.status === 'CLOSED',
        );

        const outstanding = active.reduce(
          (sum, item) =>
            sum +
            Number(
              item.position.currentOutstanding || 0,
            ),
          0,
        );

        const originalPrincipal = active.reduce(
          (sum, item) =>
            sum +
            Number(item.loan.originalPrincipal || 0),
          0,
        );

        const monthlyCommitment = active.reduce(
          (sum, item) =>
            sum + getCommitment(item.loan),
          0,
        );

        const principalPaid = active.reduce(
          (sum, item) =>
            sum + Number(item.principalPaid || 0),
          0,
        );

        const interestPaid = active.reduce(
          (sum, item) =>
            sum + Number(item.interestPaid || 0),
          0,
        );

        return {
          type,
          count: typeLoans.length,
          activeCount: active.length,
          pausedCount: paused.length,
          closedCount: closed.length,
          outstanding,
          originalPrincipal,
          monthlyCommitment,
          principalPaid,
          interestPaid,
          repaymentPercent:
            originalPrincipal > 0
              ? Math.min(
                  100,
                  (principalPaid / originalPrincipal) * 100,
                )
              : 0,
        };
      })
      .filter(Boolean) as LoanTypeAnalytics[];
  }, [calculatedLoans]);

  /* ------------------------------------------------------------------------ */
  /* OUTSTANDING DISTRIBUTION                                                  */
  /* ------------------------------------------------------------------------ */

  const typeDistribution = useMemo(() => {
    return loanTypeAnalytics
      .filter((item) => item.outstanding > 0)
      .sort(
        (a, b) =>
          b.outstanding - a.outstanding,
      )
      .map((item) => ({
        ...item,
        share:
          summary.totalOutstanding > 0
            ? (item.outstanding /
                summary.totalOutstanding) *
              100
            : 0,
      }));
  }, [loanTypeAnalytics, summary.totalOutstanding]);

  /* ------------------------------------------------------------------------ */
  /* UPCOMING PAYMENTS                                                        */
  /* ------------------------------------------------------------------------ */

  const upcomingPayments = useMemo<UpcomingPayment[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return activeLoans
      .map((item) => {
        const nextDate = safeDate(
          item.position.nextEmiDate,
        );

        if (!nextDate) return null;

        nextDate.setHours(0, 0, 0, 0);

        if (nextDate < today) return null;

        return {
          loan: item.loan,
          date: nextDate,
          amount: getCommitment(item.loan),
          isInterestOnly:
            item.loan.repaymentType ===
            'INTEREST_ONLY',
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (a as UpcomingPayment).date.getTime() -
          (b as UpcomingPayment).date.getTime(),
      ) as UpcomingPayment[];
  }, [activeLoans]);

  const nextPayment = upcomingPayments[0] || null;

  const next7DaysAmount = useMemo(() => {
    const today = new Date();

    return upcomingPayments
      .filter((item) => {
        const diff = daysBetween(
          today,
          item.date,
        );

        return diff >= 0 && diff <= 7;
      })
      .reduce(
        (sum, item) => sum + item.amount,
        0,
      );
  }, [upcomingPayments]);

  const thisMonthAmount = useMemo(() => {
    const today = new Date();

    return upcomingPayments
      .filter(
        (item) =>
          item.date.getMonth() ===
            today.getMonth() &&
          item.date.getFullYear() ===
            today.getFullYear(),
      )
      .reduce(
        (sum, item) => sum + item.amount,
        0,
      );
  }, [upcomingPayments]);

  /* ------------------------------------------------------------------------ */
  /* PAYMENT HEALTH                                                           */
  /* ------------------------------------------------------------------------ */

  const paymentHealth = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let missed = 0;
    let prepayment = 0;

    payments.forEach((payment) => {
      switch (payment.status) {
        case 'PAID':
          paid += 1;
          break;
        case 'PARTIAL':
          partial += 1;
          break;
        case 'MISSED':
          missed += 1;
          break;
        case 'PREPAYMENT':
          prepayment += 1;
          break;
      }
    });

    const total =
      paid +
      partial +
      missed +
      prepayment;

    return {
      paid,
      partial,
      missed,
      prepayment,
      total,
      successRate:
        total > 0
          ? ((paid + prepayment) / total) * 100
          : 0,
    };
  }, [payments]);

  /* ------------------------------------------------------------------------ */
  /* MONTHLY PRINCIPAL REPAYMENT                                              */
  /* ------------------------------------------------------------------------ */

  const monthlyPaymentTrend =
    useMemo<MonthlyPaymentPoint[]>(() => {
      const now = new Date();

      const months: {
        key: string;
        label: string;
      }[] = [];

      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(
          now.getFullYear(),
          now.getMonth() - i,
          1,
        );

        months.push({
          key: monthKey(date),
          label: monthLabel(date),
        });
      }

      return months.map((month) => {
        const value = payments
          .filter((payment) => {
            const date = safeDate(
              payment.paymentDate,
            );

            return (
              date &&
              monthKey(date) === month.key
            );
          })
          .reduce(
            (sum, payment) =>
              sum +
              Number(payment.principal || 0),
            0,
          );

        return {
          label: month.label,
          value,
        };
      });
    }, [payments]);

  const maxMonthlyPayment = useMemo(
    () =>
      Math.max(
        ...monthlyPaymentTrend.map(
          (item) => item.value,
        ),
        1,
      ),
    [monthlyPaymentTrend],
  );

  /* ------------------------------------------------------------------------ */
  /* TARGET                                                                   */
  /* ------------------------------------------------------------------------ */

  const targetPerformance = useMemo(() => {
    if (!target?.targetDate) return null;

    try {
      const targetDate =
        target.targetDate instanceof Date
          ? new Date(target.targetDate)
          : new Date(String(target.targetDate));

      const baselineDate =
        target.baselineDate instanceof Date
          ? new Date(target.baselineDate)
          : new Date(String(target.baselineDate));

      const baselineOutstanding = Number(
        target.baselineOutstanding,
      ) || summary.totalOutstanding || 0;

      const additionalMonthlyPayment = Number(
        target.additionalMonthlyPayment || 0,
      ) || 0;

      if (
        Number.isNaN(targetDate.getTime()) ||
        Number.isNaN(baselineDate.getTime())
      ) {
        console.warn('Invalid debt-free target dates:', {
          targetDate: target.targetDate,
          baselineDate: target.baselineDate,
        });
        return null;
      }

      return calculateTargetPerformance(
        activeLoans.map((item) => item.loan),
        baselineOutstanding,
        baselineDate,
        targetDate,
        additionalMonthlyPayment,
      );
    } catch (err) {
      console.warn(
        'Target performance calculation failed',
        err,
      );

      return null;
    }
  }, [target, activeLoans]);

  /* ------------------------------------------------------------------------ */
  /* INSIGHTS                                                                 */
  /* ------------------------------------------------------------------------ */

  const insights = useMemo(() => {
    const result: {
      icon: string;
      title: string;
      description: string;
      tone: 'blue' | 'green' | 'orange' | 'red';
    }[] = [];

    const largestType =
      typeDistribution[0];

    if (largestType && summary.totalOutstanding > 0) {
      result.push({
        icon: '◈',
        title: `${getLoanTypeCode(
          largestType.type,
        )} is your largest debt`,
        description: `${getLoanTypeLabel(
          largestType.type,
        )} represents ${largestType.share.toFixed(
          0,
        )}% of your current outstanding balance.`,
        tone: 'blue',
      });
    }

    if (next7DaysAmount > 0) {
      result.push({
        icon: '◷',
        title: 'Upcoming cash commitment',
        description: `${money(
          next7DaysAmount,
        )} is scheduled across your loans in the next 7 days.`,
        tone: 'orange',
      });
    }

    if (paymentHealth.missed > 0) {
      result.push({
        icon: '!',
        title: 'Payment attention needed',
        description: `${paymentHealth.missed} missed payment${
          paymentHealth.missed === 1
            ? ''
            : 's'
        } found in your payment history.`,
        tone: 'red',
      });
    } else if (
      paymentHealth.total > 0 &&
      paymentHealth.successRate >= 90
    ) {
      result.push({
        icon: '✓',
        title: 'Strong payment discipline',
        description: `${paymentHealth.successRate.toFixed(
          0,
        )}% of recorded payments are paid or prepayments.`,
        tone: 'green',
      });
    }

    const nearCompletion =
      activeLoans.filter(
        (item) =>
          Number(
            item.position.remainingMonths || 0,
          ) > 0 &&
          Number(
            item.position.remainingMonths || 0,
          ) <= 12,
      ).length;

    if (nearCompletion > 0) {
      result.push({
        icon: '↗',
        title: 'Loans nearing completion',
        description: `${nearCompletion} active loan${
          nearCompletion === 1
            ? ''
            : 's'
        } have 12 months or less remaining.`,
        tone: 'green',
      });
    }

    if (result.length === 0) {
      result.push({
        icon: '✦',
        title: 'Your financial picture is ready',
        description:
          'Add payment activity to unlock deeper repayment insights.',
        tone: 'blue',
      });
    }

    return result.slice(0, 4);
  }, [
    typeDistribution,
    summary.totalOutstanding,
    next7DaysAmount,
    paymentHealth,
    activeLoans,
  ]);

  /* ------------------------------------------------------------------------ */
  /* LOADING                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingOrb}>
          <ActivityIndicator
            size="large"
            color={COLORS.blue}
          />
        </View>

        <Text style={styles.loadingTitle}>
          Building your financial picture
        </Text>

        <Text style={styles.loadingSubtitle}>
          Calculating balances, repayments and
          upcoming commitments...
        </Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* ERROR                                                                    */
  /* ------------------------------------------------------------------------ */

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>
            !
          </Text>

          <Text style={styles.errorTitle}>
            Dashboard couldn't load
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            onPress={loadDashboard}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <View style={styles.screen}>
      {/* Background decorative blobs */}
      <View
        pointerEvents="none"
        style={[
          styles.backgroundBlob,
          styles.backgroundBlobBlue,
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.backgroundBlob,
          styles.backgroundBlobPurple,
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            maxWidth: isDesktop
              ? 1440
              : undefined,
            alignSelf: isDesktop
              ? 'center'
              : undefined,
            width: isDesktop
              ? '100%'
              : undefined,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.blue}
          />
        }
      >
        {/* ---------------------------------------------------------------- */}
        {/* HEADER                                                           */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>
                ₹
              </Text>
            </View>

            <View>
              <Text style={styles.eyebrow}>
                FINANCIAL OVERVIEW
              </Text>

              <Text style={styles.pageTitle}>
                Good morning
              </Text>

              <Text style={styles.pageSubtitle}>
                Here's how your debt is looking today.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && {
                opacity: 0.7,
                transform: [
                  { scale: 0.97 },
                ],
              },
            ]}
          >
            <Text style={styles.refreshIcon}>
              ↻
            </Text>

            {isTablet && (
              <Text style={styles.refreshText}>
                Refresh
              </Text>
            )}
          </Pressable>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* HERO                                                             */}
        {/* ---------------------------------------------------------------- */}

        <View
          style={[
            styles.heroGrid,
            !isDesktop && styles.heroGridStacked,
          ]}
        >
          <View
            style={[
              styles.heroCard,
              {
                flexBasis: isDesktop
                  ? 430
                  : '100%',
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={styles.heroGlowOne}
            />

            <View
              pointerEvents="none"
              style={styles.heroGlowTwo}
            />

            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>
                  CURRENT OUTSTANDING
                </Text>

                <Text style={styles.heroHint}>
                  Active loan portfolio
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  LIVE
                </Text>
              </View>
            </View>

            <Text
              style={styles.heroAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {compactMoney(
                summary.totalOutstanding,
              )}
            </Text>

            <View style={styles.heroProgressHeader}>
              <Text style={styles.heroProgressText}>
                {summary.repaymentPercent.toFixed(
                  1,
                )}% principal repaid
              </Text>

              <Text style={styles.heroProgressText}>
                {compactMoney(
                  summary.principalPaid,
                )}{' '}
                paid
              </Text>
            </View>

            <View style={styles.heroProgressTrack}>
              <View
                style={[
                  styles.heroProgressFill,
                  {
                    width: `${Math.min(
                      100,
                      summary.repaymentPercent,
                    )}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.heroBottom}>
              <View>
                <Text style={styles.heroBottomLabel}>
                  Original principal
                </Text>

                <Text style={styles.heroBottomValue}>
                  {compactMoney(
                    summary.totalOriginalPrincipal,
                  )}
                </Text>
              </View>

              <View style={styles.heroArrow}>
                <Text style={styles.heroArrowText}>
                  ↗
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.statsGrid,
              !isDesktop && styles.statsGridStacked,
            ]}
          >
            <MetricCard
              label="Monthly commitment"
              value={compactMoney(
                summary.monthlyCommitment,
              )}
              detail="EMI + interest-only"
              icon="◷"
              tone="blue"
            />

            <MetricCard
              label="Active loans"
              value={String(
                activeLoans.length,
              )}
              detail={`${loans.length} total loans`}
              icon="◈"
              tone="purple"
            />

            <MetricCard
              label="Principal paid"
              value={compactMoney(
                summary.principalPaid,
              )}
              detail={`${summary.repaymentPercent.toFixed(
                1,
              )}% of original`}
              icon="↘"
              tone="green"
            />

            <MetricCard
              label="Interest paid"
              value={compactMoney(
                summary.interestPaid,
              )}
              detail="Recorded interest"
              icon="₹"
              tone="orange"
            />
          </View>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* NEXT EMI STRIP                                                    */}
        {/* ---------------------------------------------------------------- */}

        {nextPayment && (
          <View style={styles.nextPaymentCard}>
            <View style={styles.nextPaymentIcon}>
              <Text style={styles.nextPaymentIconText}>
                ◷
              </Text>
            </View>

            <View style={styles.nextPaymentMain}>
              <Text style={styles.nextPaymentEyebrow}>
                NEXT COMMITMENT
              </Text>

              <Text style={styles.nextPaymentTitle}>
                {nextPayment.loan.loanName}
              </Text>

              <Text style={styles.nextPaymentSub}>
                {getLoanTypeCode(
                  nextPayment.loan.loanType,
                )}{' '}
                · {nextPayment.loan.lender}
                {nextPayment.isInterestOnly
                  ? ' · Interest Only'
                  : ''}
              </Text>
            </View>

            <View style={styles.nextPaymentRight}>
              <Text style={styles.nextPaymentAmount}>
                {money(nextPayment.amount)}
              </Text>

              <Text style={styles.nextPaymentDate}>
                {formatDate(
                  nextPayment.date,
                )}
              </Text>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* PORTFOLIO                                                        */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader
          eyebrow="YOUR PORTFOLIO"
          title="Debt by loan type"
          description="See exactly where your outstanding balance is concentrated."
        />

        {loanTypeAnalytics.length === 0 ? (
          <GlassCard>
            <EmptyState
              title="No loans yet"
              description="Add your first loan to start building your financial picture."
            />
          </GlassCard>
        ) : (
          <View style={styles.typeGrid}>
            {loanTypeAnalytics.map((item) => (
              <LoanTypeCard
                key={item.type}
                item={item}
                totalOutstanding={
                  summary.totalOutstanding
                }
                onPress={() =>
                  router.push('/loans')
                }
              />
            ))}
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* ANALYTICS ROW                                                     */}
        {/* ---------------------------------------------------------------- */}

        <View
          style={[
            styles.analyticsRow,
            !isDesktop &&
              styles.analyticsRowStacked,
          ]}
        >
          {/* Debt Distribution */}
          <GlassCard
            style={[
              styles.analyticsCard,
              {
                flexBasis: isDesktop
                  ? '48%'
                  : '100%',
              },
            ]}
          >
            <CardHeading
              title="Debt distribution"
              subtitle="Outstanding balance by type"
            />

            {typeDistribution.length === 0 ? (
              <EmptyState
                title="No active debt"
                description="Your active portfolio will appear here."
              />
            ) : (
              <View style={styles.distributionList}>
                {typeDistribution.map(
                  (item, index) => (
                    <View
                      key={item.type}
                      style={
                        styles.distributionItem
                      }
                    >
                      <View
                        style={
                          styles.distributionTop
                        }
                      >
                        <View
                          style={
                            styles.distributionName
                          }
                        >
                          <View
                            style={[
                              styles.distributionDot,
                              {
                                backgroundColor:
                                  [
                                    COLORS.blue,
                                    COLORS.purple,
                                    COLORS.cyan,
                                    COLORS.green,
                                    COLORS.orange,
                                    COLORS.red,
                                  ][
                                    index % 6
                                  ],
                              },
                            ]}
                          />

                          <Text
                            style={
                              styles.distributionLabel
                            }
                          >
                            {getLoanTypeCode(
                              item.type,
                            )}{' '}
                            ·{' '}
                            {getLoanTypeLabel(
                              item.type,
                            )}
                          </Text>
                        </View>

                        <Text
                          style={
                            styles.distributionValue
                          }
                        >
                          {compactMoney(
                            item.outstanding,
                          )}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.distributionTrack
                        }
                      >
                        <View
                          style={[
                            styles.distributionFill,
                            {
                              width: `${Math.min(
                                100,
                                item.share,
                              )}%`,
                              backgroundColor:
                                [
                                  COLORS.blue,
                                  COLORS.purple,
                                  COLORS.cyan,
                                  COLORS.green,
                                  COLORS.orange,
                                  COLORS.red,
                                ][
                                  index % 6
                                ],
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={
                          styles.distributionShare
                        }
                      >
                        {item.share.toFixed(
                          1,
                        )}
                        % of total outstanding
                      </Text>
                    </View>
                  ),
                )}
              </View>
            )}
          </GlassCard>

          {/* Payment Trend */}
          <GlassCard
            style={[
              styles.analyticsCard,
              {
                flexBasis: isDesktop
                  ? '48%'
                  : '100%',
              },
            ]}
          >
            <CardHeading
              title="Repayment activity"
              subtitle="Principal repaid over the last 6 months"
            />

            <View style={styles.chart}>
              {monthlyPaymentTrend.map(
                (point) => {
                  const height =
                    point.value > 0
                      ? Math.max(
                          8,
                          (point.value /
                            maxMonthlyPayment) *
                            130,
                        )
                      : 5;

                  return (
                    <View
                      key={point.label}
                      style={styles.chartColumn}
                    >
                      <Text
                        style={
                          styles.chartValue
                        }
                      >
                        {point.value > 0
                          ? compactMoney(
                              point.value,
                            )
                          : ''}
                      </Text>

                      <View
                        style={
                          styles.chartTrack
                        }
                      >
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height,
                            },
                          ]}
                        />
                      </View>

                      <Text
                        style={
                          styles.chartLabel
                        }
                      >
                        {point.label}
                      </Text>
                    </View>
                  );
                },
              )}
            </View>

            <View style={styles.chartFooter}>
              <Text style={styles.chartFooterLabel}>
                Total principal paid
              </Text>

              <Text
                style={styles.chartFooterValue}
              >
                {compactMoney(
                  summary.principalPaid,
                )}
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* UPCOMING + PAYMENT HEALTH                                         */}
        {/* ---------------------------------------------------------------- */}

        <View
          style={[
            styles.analyticsRow,
            !isDesktop &&
              styles.analyticsRowStacked,
          ]}
        >
          <GlassCard
            style={[
              styles.analyticsCard,
              {
                flexBasis: isDesktop
                  ? '62%'
                  : '100%',
              },
            ]}
          >
            <CardHeading
              title="Upcoming commitments"
              subtitle="Your next scheduled loan payments"
            />

            <View style={styles.commitmentSummary}>
              <MiniSummary
                label="Next 7 days"
                value={money(
                  next7DaysAmount,
                )}
                tone="orange"
              />

              <MiniSummary
                label="This month"
                value={money(
                  thisMonthAmount,
                )}
                tone="blue"
              />

              <MiniSummary
                label="Scheduled"
                value={String(
                  upcomingPayments.length,
                )}
                tone="green"
              />
            </View>

            <View style={styles.upcomingList}>
              {upcomingPayments
                .slice(0, 5)
                .map((item, index) => (
                  <View
                    key={`${item.loan.id}-${index}`}
                    style={
                      styles.upcomingRow
                    }
                  >
                    <View
                      style={
                        styles.upcomingDateBox
                      }
                    >
                      <Text
                        style={
                          styles.upcomingDate
                        }
                      >
                        {item.date
                          .getDate()
                          .toString()
                          .padStart(2, '0')}
                      </Text>

                      <Text
                        style={
                          styles.upcomingMonth
                        }
                      >
                        {item.date
                          .toLocaleDateString(
                            'en-IN',
                            {
                              month: 'short',
                            },
                          )
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.upcomingInfo
                      }
                    >
                      <Text
                        style={
                          styles.upcomingLoan
                        }
                        numberOfLines={1}
                      >
                        {item.loan.loanName}
                      </Text>

                      <Text
                        style={
                          styles.upcomingMeta
                        }
                      >
                        {getLoanTypeCode(
                          item.loan.loanType,
                        )}
                        {' · '}
                        {item.isInterestOnly
                          ? 'Interest only'
                          : 'EMI'}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.upcomingAmount
                      }
                    >
                      {money(item.amount)}
                    </Text>
                  </View>
                ))}

              {upcomingPayments.length ===
                0 && (
                <EmptyState
                  title="No upcoming commitments"
                  description="There are no future EMI dates available for your active loans."
                />
              )}
            </View>
          </GlassCard>

          <GlassCard
            style={[
              styles.analyticsCard,
              {
                flexBasis: isDesktop
                  ? '35%'
                  : '100%',
              },
            ]}
          >
            <CardHeading
              title="Payment health"
              subtitle="Based on recorded payment history"
            />

            <View style={styles.healthScore}>
              <View
                style={styles.healthCircle}
              >
                <Text
                  style={
                    styles.healthScoreValue
                  }
                >
                  {paymentHealth.total > 0
                    ? paymentHealth.successRate.toFixed(
                        0,
                      )
                    : '—'}
                  {paymentHealth.total > 0 &&
                    '%'}
                </Text>

                <Text
                  style={
                    styles.healthScoreLabel
                  }
                >
                  success
                </Text>
              </View>

              <View
                style={styles.healthLegend}
              >
                <HealthRow
                  label="Paid"
                  value={paymentHealth.paid}
                  dot={COLORS.green}
                />

                <HealthRow
                  label="Prepayment"
                  value={
                    paymentHealth.prepayment
                  }
                  dot={COLORS.blue}
                />

                <HealthRow
                  label="Partial"
                  value={
                    paymentHealth.partial
                  }
                  dot={COLORS.orange}
                />

                <HealthRow
                  label="Missed"
                  value={
                    paymentHealth.missed
                  }
                  dot={COLORS.red}
                />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* SMART INSIGHTS                                                    */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader
          eyebrow="FINANCIAL INTELLIGENCE"
          title="Smart insights"
          description="Useful observations generated from your actual loan and payment data."
        />

        <View
          style={[
            styles.insightGrid,
            !isDesktop &&
              styles.insightGridStacked,
          ]}
        >
          {insights.map((insight, index) => (
            <InsightCard
              key={`${insight.title}-${index}`}
              {...insight}
            />
          ))}
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* DEBT FREE TARGET                                                  */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader
          eyebrow="YOUR GOAL"
          title="Debt-free journey"
          description="Track how your current repayment path compares with your target."
        />

        <GlassCard
          style={styles.targetCard}
        >
          {!target ||
          !target.targetDate ? (
            <View
              style={
                styles.targetEmpty
              }
            >
              <View
                style={
                  styles.targetEmptyIcon
                }
              >
                <Text
                  style={
                    styles.targetEmptyIconText
                  }
                >
                  ✦
                </Text>
              </View>

              <View
                style={
                  styles.targetEmptyContent
                }
              >
                <Text
                  style={
                    styles.targetEmptyTitle
                  }
                >
                  Set your debt-free target
                </Text>

                <Text
                  style={
                    styles.targetEmptyText
                  }
                >
                  Choose a target date and
                  turn your dashboard into a
                  debt-free roadmap.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push(
                    '/debt-free-target',
                  )
                }
                style={styles.primaryButton}
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Set Target
                </Text>
              </Pressable>
            </View>
          ) : (
            <TargetContent
              target={target}
              performance={
                targetPerformance
              }
              router={router}
            />
          )}
        </GlassCard>

        {/* ---------------------------------------------------------------- */}
        {/* FOOTER                                                           */}
        {/* ---------------------------------------------------------------- */}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Financial overview · Updated{' '}
            {new Date().toLocaleTimeString(
              'en-IN',
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            )}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* METRIC CARD                                                                */
/* -------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
  tone: 'blue' | 'purple' | 'green' | 'orange';
}) {
  const toneMap = {
    blue: {
      background: COLORS.blueSoft,
      icon: COLORS.blue,
    },
    purple: {
      background: COLORS.purpleSoft,
      icon: COLORS.purple,
    },
    green: {
      background: COLORS.greenSoft,
      icon: COLORS.green,
    },
    orange: {
      background: COLORS.orangeSoft,
      icon: COLORS.orange,
    },
  };

  const current = toneMap[tone];

  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          {
            backgroundColor:
              current.background,
          },
        ]}
      >
        <Text
          style={[
            styles.metricIconText,
            {
              color: current.icon,
            },
          ]}
        >
          {icon}
        </Text>
      </View>

      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text
        style={styles.metricValue}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      <Text style={styles.metricDetail}>
        {detail}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* LOAN TYPE CARD                                                             */
/* -------------------------------------------------------------------------- */

function LoanTypeCard({
  item,
  totalOutstanding,
  onPress,
}: {
  item: LoanTypeAnalytics;
  totalOutstanding: number;
  onPress: () => void;
}) {
  const meta =
    LOAN_TYPE_META[item.type];

  const share =
    totalOutstanding > 0
      ? (item.outstanding /
          totalOutstanding) *
        100
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeCard,
        pressed && styles.typeCardPressed,
      ]}
    >
      <View style={styles.typeCardHeader}>
        <View style={styles.typeIdentity}>
          <View style={styles.typeCode}>
            <Text style={styles.typeCodeText}>
              {meta.code}
            </Text>
          </View>

          <View>
            <Text style={styles.typeTitle}>
              {meta.title}
            </Text>

            <Text style={styles.typeDescription}>
              {meta.description}
            </Text>
          </View>
        </View>

        <View style={styles.typeCountPill}>
          <Text style={styles.typeCount}>
            {item.count}
          </Text>

          <Text style={styles.typeCountLabel}>
            {item.count === 1
              ? 'loan'
              : 'loans'}
          </Text>
        </View>
      </View>

      <View style={styles.typeBalance}>
        <Text style={styles.typeBalanceLabel}>
          Outstanding
        </Text>

        <Text
          style={styles.typeBalanceValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {compactMoney(
            item.outstanding,
          )}
        </Text>
      </View>

      <View style={styles.typeProgressTrack}>
        <View
          style={[
            styles.typeProgressFill,
            {
              width: `${Math.min(
                100,
                item.repaymentPercent,
              )}%`,
            },
          ]}
        />
      </View>

      <View style={styles.typeStats}>
        <View>
          <Text style={styles.typeStatLabel}>
            Active
          </Text>

          <Text style={styles.typeStatValue}>
            {item.activeCount}
          </Text>
        </View>

        <View>
          <Text style={styles.typeStatLabel}>
            Monthly
          </Text>

          <Text style={styles.typeStatValue}>
            {compactMoney(
              item.monthlyCommitment,
            )}
          </Text>
        </View>

        <View>
          <Text style={styles.typeStatLabel}>
            Portfolio
          </Text>

          <Text style={styles.typeStatValue}>
            {share.toFixed(0)}%
          </Text>
        </View>
      </View>

      <View style={styles.typeFooter}>
        <Text style={styles.typeFooterText}>
          {item.repaymentPercent.toFixed(
            1,
          )}
          % principal repaid
        </Text>

        <Text style={styles.typeArrow}>
          →
        </Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* GLASS CARD                                                                 */
/* -------------------------------------------------------------------------- */

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const webGlass =
    Platform.OS === 'web'
      ? ({
          backdropFilter:
            'blur(18px)',
          WebkitBackdropFilter:
            'blur(18px)',
        } as any)
      : null;

  return (
    <View
      style={[
        styles.glassCard,
        webGlass,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* SECTION HEADER                                                             */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>
        {eyebrow}
      </Text>

      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <Text style={styles.sectionDescription}>
        {description}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* CARD HEADING                                                               */
/* -------------------------------------------------------------------------- */

function CardHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.cardHeading}>
      <Text style={styles.cardTitle}>
        {title}
      </Text>

      <Text style={styles.cardSubtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* MINI SUMMARY                                                               */
/* -------------------------------------------------------------------------- */

function MiniSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'orange';
}) {
  const colors = {
    blue: COLORS.blue,
    green: COLORS.green,
    orange: COLORS.orange,
  };

  return (
    <View style={styles.miniSummary}>
      <View
        style={[
          styles.miniSummaryDot,
          {
            backgroundColor:
              colors[tone],
          },
        ]}
      />

      <View>
        <Text style={styles.miniSummaryLabel}>
          {label}
        </Text>

        <Text style={styles.miniSummaryValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* HEALTH ROW                                                                 */
/* -------------------------------------------------------------------------- */

function HealthRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <View style={styles.healthRow}>
      <View style={styles.healthLabel}>
        <View
          style={[
            styles.healthDot,
            {
              backgroundColor: dot,
            },
          ]}
        />

        <Text style={styles.healthText}>
          {label}
        </Text>
      </View>

      <Text style={styles.healthValue}>
        {value}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* INSIGHT CARD                                                               */
/* -------------------------------------------------------------------------- */

function InsightCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: string;
  title: string;
  description: string;
  tone: 'blue' | 'green' | 'orange' | 'red';
}) {
  const map = {
    blue: {
      background: COLORS.blueSoft,
      icon: COLORS.blue,
    },
    green: {
      background: COLORS.greenSoft,
      icon: COLORS.green,
    },
    orange: {
      background: COLORS.orangeSoft,
      icon: COLORS.orange,
    },
    red: {
      background: COLORS.redSoft,
      icon: COLORS.red,
    },
  };

  const current = map[tone];

  return (
    <View style={styles.insightCard}>
      <View
        style={[
          styles.insightIcon,
          {
            backgroundColor:
              current.background,
          },
        ]}
      >
        <Text
          style={[
            styles.insightIconText,
            {
              color: current.icon,
            },
          ]}
        >
          {icon}
        </Text>
      </View>

      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>
          {title}
        </Text>

        <Text style={styles.insightDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* TARGET CONTENT                                                             */
/* -------------------------------------------------------------------------- */

function TargetContent({
  target,
  performance,
  router,
}: {
  target: DebtFreeTarget;
  performance: any;
  router: ReturnType<typeof useRouter>;
}) {
  const status =
    performance?.status || 'ON_TRACK';

  const statusConfig = {
    AHEAD: {
      label: 'Ahead of target',
      background: COLORS.greenSoft,
      color: COLORS.green,
      icon: '↗',
    },
    ON_TRACK: {
      label: 'On track',
      background: COLORS.blueSoft,
      color: COLORS.blue,
      icon: '✓',
    },
    BEHIND: {
      label: 'Needs attention',
      background: COLORS.orangeSoft,
      color: COLORS.orange,
      icon: '!',
    },
  } as const;

  const config =
    statusConfig[
      status as keyof typeof statusConfig
    ] || statusConfig.ON_TRACK;

  const currentOutstanding =
    Number(
      performance?.currentOutstanding ??
        0,
    );

  const projectedDate =
    performance?.projectedDebtFreeDate;

  const targetDate =
    target.targetDate;

  return (
    <View>
      <View style={styles.targetHeader}>
        <View>
          <Text style={styles.targetEyebrow}>
            DEBT-FREE TARGET
          </Text>

          <Text style={styles.targetTitle}>
            Your destination is{' '}
            {formatDate(targetDate)}
          </Text>

          <Text style={styles.targetSubtitle}>
            Keep reducing principal and
            stay on the path to becoming
            debt-free.
          </Text>
        </View>

        <View
          style={[
            styles.targetStatus,
            {
              backgroundColor:
                config.background,
            },
          ]}
        >
          <Text
            style={[
              styles.targetStatusIcon,
              {
                color: config.color,
              },
            ]}
          >
            {config.icon}
          </Text>

          <Text
            style={[
              styles.targetStatusText,
              {
                color: config.color,
              },
            ]}
          >
            {config.label}
          </Text>
        </View>
      </View>

      <View style={styles.targetMetrics}>
        <View style={styles.targetMetric}>
          <Text style={styles.targetMetricLabel}>
            Current outstanding
          </Text>

          <Text style={styles.targetMetricValue}>
            {compactMoney(
              currentOutstanding,
            )}
          </Text>
        </View>

        <View style={styles.targetMetric}>
          <Text style={styles.targetMetricLabel}>
            Target date
          </Text>

          <Text style={styles.targetMetricValue}>
            {formatDate(targetDate)}
          </Text>
        </View>

        <View style={styles.targetMetric}>
          <Text style={styles.targetMetricLabel}>
            Projected date
          </Text>

          <Text style={styles.targetMetricValue}>
            {formatDate(
              projectedDate,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.targetBottom}>
        <Text style={styles.targetBottomText}>
          {performance?.requiredAdditionalPrincipal
            ? `${money(
                performance.requiredAdditionalPrincipal,
              )} additional principal reduction may be required.`
            : 'Your current repayment path is being tracked against your target.'}
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              '/debt-free-target',
            )
          }
          style={styles.secondaryButton}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            View target
          </Text>

          <Text
            style={
              styles.secondaryButtonArrow
            }
          >
            →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* EMPTY STATE                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>
          ◇
        </Text>
      </View>

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptyDescription}>
        {description}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* STYLES                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor:
      COLORS.background,
    position: 'relative',
  },

  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 70,
  },

  /* Background ----------------------------------------------------------- */

  backgroundBlob: {
    position: 'absolute',
    borderRadius: 300,
    opacity: 0.16,
  },

  backgroundBlobBlue: {
    width: 420,
    height: 420,
    backgroundColor: '#AFC5FF',
    top: -170,
    right: -130,
  },

  backgroundBlobPurple: {
    width: 330,
    height: 330,
    backgroundColor: '#D9CCFF',
    top: 520,
    left: -180,
  },

  /* Header --------------------------------------------------------------- */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flexShrink: 1,
  },

  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  logoMarkText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  eyebrow: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 3,
  },

  pageTitle: {
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  pageSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 4,
  },

  refreshButton: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor:
      'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  refreshIcon: {
    fontSize: 20,
    color: COLORS.text,
  },

  refreshText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* Hero ----------------------------------------------------------------- */

  heroGrid: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 20,
  },

  heroGridStacked: {
    flexDirection: 'column',
  },

  heroCard: {
    minHeight: 300,
    borderRadius: 28,
    padding: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor:
      '#3168F6',

    shadowColor: '#2855C9',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 8,
  },

  heroGlowOne: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 200,
    backgroundColor:
      'rgba(255,255,255,0.10)',
    top: -170,
    right: -70,
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 150,
    backgroundColor:
      'rgba(103,161,255,0.22)',
    bottom: -130,
    left: -70,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  heroLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  heroHint: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    marginTop: 4,
  },

  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor:
      'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.16)',
  },

  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  heroAmount: {
    color: '#FFFFFF',
    fontSize: 54,
    lineHeight: 62,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: 38,
    maxWidth: '90%',
  },

  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 9,
  },

  heroProgressText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },

  heroProgressTrack: {
    height: 7,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor:
      'rgba(255,255,255,0.17)',
  },

  heroProgressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },

  heroBottom: {
    marginTop: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  heroBottomLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },

  heroBottomValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },

  heroArrow: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor:
      'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroArrowText: {
    color: '#FFFFFF',
    fontSize: 20,
  },

  /* Stats ---------------------------------------------------------------- */

  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },

  statsGridStacked: {
    width: '100%',
  },

  metricCard: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 141,
    padding: 20,
    borderRadius: 22,
    backgroundColor:
      COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#64748B',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 3,
  },

  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  metricIconText: {
    fontSize: 17,
    fontWeight: '800',
  },

  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  metricValue: {
    color: COLORS.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: -0.6,
  },

  metricDetail: {
    color: COLORS.subtle,
    fontSize: 10,
    marginTop: 4,
  },

  /* Next payment --------------------------------------------------------- */

  nextPaymentCard: {
    minHeight: 82,
    borderRadius: 20,
    padding: 16,
    paddingHorizontal: 20,
    marginBottom: 28,

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor:
      'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#64748B',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },

  nextPaymentIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  nextPaymentIconText: {
    color: COLORS.blue,
    fontSize: 20,
    fontWeight: '700',
  },

  nextPaymentMain: {
    flex: 1,
    minWidth: 0,
  },

  nextPaymentEyebrow: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  nextPaymentTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '750',
    marginTop: 2,
  },

  nextPaymentSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  nextPaymentRight: {
    alignItems: 'flex-end',
    marginLeft: 15,
  },

  nextPaymentAmount: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },

  nextPaymentDate: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  /* Sections ------------------------------------------------------------- */

  sectionHeader: {
    marginTop: 12,
    marginBottom: 16,
  },

  sectionEyebrow: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  sectionDescription: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  /* Glass ---------------------------------------------------------------- */

  glassCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor:
      COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#64748B',
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 3,
  },

  /* Loan type ------------------------------------------------------------ */

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginBottom: 30,
  },

  typeCard: {
    width: '31.5%',
    minWidth: 280,
    borderRadius: 23,
    padding: 21,
    backgroundColor:
      'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#64748B',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 2,
  },

  typeCardPressed: {
    transform: [
      { scale: 0.985 },
    ],
    opacity: 0.88,
  },

  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  typeIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  typeCode: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  typeCodeText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '900',
  },

  typeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },

  typeDescription: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
  },

  typeCountPill: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
  },

  typeCount: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },

  typeCountLabel: {
    color: COLORS.subtle,
    fontSize: 8,
  },

  typeBalance: {
    marginTop: 25,
  },

  typeBalanceLabel: {
    color: COLORS.muted,
    fontSize: 10,
  },

  typeBalanceValue: {
    color: COLORS.text,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 2,
  },

  typeProgressTrack: {
    height: 5,
    borderRadius: 99,
    backgroundColor: '#EDF1F6',
    overflow: 'hidden',
    marginTop: 17,
  },

  typeProgressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: COLORS.blue,
  },

  typeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
  },

  typeStatLabel: {
    color: COLORS.subtle,
    fontSize: 9,
  },

  typeStatValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '750',
    marginTop: 3,
  },

  typeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },

  typeFooterText: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
  },

  typeArrow: {
    color: COLORS.blue,
    fontSize: 18,
  },

  /* Analytics ------------------------------------------------------------ */

  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 18,
  },

  analyticsRowStacked: {
    flexDirection: 'column',
  },

  analyticsCard: {
    flexGrow: 1,
  },

  cardHeading: {
    marginBottom: 20,
  },

  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },

  cardSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  /* Distribution --------------------------------------------------------- */

  distributionList: {
    gap: 18,
  },

  distributionItem: {
    gap: 7,
  },

  distributionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  distributionName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  distributionDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginRight: 8,
  },

  distributionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '650',
  },

  distributionValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },

  distributionTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: '#EDF1F6',
    overflow: 'hidden',
  },

  distributionFill: {
    height: '100%',
    borderRadius: 99,
  },

  distributionShare: {
    color: COLORS.subtle,
    fontSize: 9,
  },

  /* Chart ---------------------------------------------------------------- */

  chart: {
    height: 185,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },

  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  chartValue: {
    color: COLORS.muted,
    fontSize: 8,
    height: 18,
    textAlign: 'center',
  },

  chartTrack: {
    height: 135,
    width: '70%',
    minWidth: 18,
    borderRadius: 99,
    backgroundColor: '#F0F3F8',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  chartBar: {
    width: '100%',
    borderRadius: 99,
    backgroundColor: COLORS.blue,
    opacity: 0.86,
  },

  chartLabel: {
    color: COLORS.subtle,
    fontSize: 9,
    marginTop: 8,
  },

  chartFooter: {
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  chartFooterLabel: {
    color: COLORS.muted,
    fontSize: 10,
  },

  chartFooterValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },

  /* Commitments ---------------------------------------------------------- */

  commitmentSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },

  miniSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F7F9FC',
    flexGrow: 1,
  },

  miniSummaryDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    marginRight: 8,
  },

  miniSummaryLabel: {
    color: COLORS.subtle,
    fontSize: 8,
  },

  miniSummaryValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },

  upcomingList: {
    gap: 8,
  },

  upcomingRow: {
    minHeight: 61,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  upcomingDateBox: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  upcomingDate: {
    color: COLORS.blue,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },

  upcomingMonth: {
    color: COLORS.blue,
    fontSize: 7,
    fontWeight: '800',
  },

  upcomingInfo: {
    flex: 1,
    minWidth: 0,
  },

  upcomingLoan: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '750',
  },

  upcomingMeta: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  upcomingAmount: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 10,
  },

  /* Health ---------------------------------------------------------------- */

  healthScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },

  healthCircle: {
    width: 132,
    height: 132,
    borderRadius: 80,
    backgroundColor: COLORS.greenSoft,
    borderWidth: 9,
    borderColor: '#D8F3E7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  healthScoreValue: {
    color: COLORS.green,
    fontSize: 27,
    fontWeight: '900',
  },

  healthScoreLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 1,
  },

  healthLegend: {
    flex: 1,
    gap: 12,
  },

  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  healthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    marginRight: 8,
  },

  healthText: {
    color: COLORS.muted,
    fontSize: 10,
  },

  healthValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },

  /* Insights ------------------------------------------------------------- */

  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 30,
  },

  insightGridStacked: {
    flexDirection: 'column',
  },

  insightCard: {
    flex: 1,
    minWidth: 240,
    padding: 17,
    borderRadius: 19,
    backgroundColor:
      'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    gap: 12,
  },

  insightIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  insightIconText: {
    fontSize: 17,
    fontWeight: '900',
  },

  insightContent: {
    flex: 1,
  },

  insightTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },

  insightDescription: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  /* Target ---------------------------------------------------------------- */

  targetCard: {
    marginBottom: 25,
  },

  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },

  targetEyebrow: {
    color: COLORS.blue,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  targetTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 5,
  },

  targetSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
    maxWidth: 650,
  },

  targetStatus: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  targetStatusIcon: {
    fontSize: 14,
    fontWeight: '900',
  },

  targetStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  targetMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
  },

  targetMetric: {
    flex: 1,
    minWidth: 180,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#F8FAFC',
  },

  targetMetricLabel: {
    color: COLORS.subtle,
    fontSize: 9,
  },

  targetMetricValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 5,
  },

  targetBottom: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },

  targetBottomText: {
    color: COLORS.muted,
    fontSize: 10,
    flex: 1,
  },

  /* Empty ---------------------------------------------------------------- */

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  emptyIconText: {
    color: COLORS.blue,
    fontSize: 20,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyDescription: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 360,
    marginTop: 5,
    lineHeight: 15,
  },

  /* Target empty --------------------------------------------------------- */

  targetEmpty: {
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  targetEmptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  targetEmptyIconText: {
    color: COLORS.blue,
    fontSize: 23,
  },

  targetEmptyContent: {
    flex: 1,
  },

  targetEmptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },

  targetEmptyText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    maxWidth: 600,
  },

  /* Buttons -------------------------------------------------------------- */

  primaryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  secondaryButton: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: COLORS.blueSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  secondaryButtonText: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '800',
  },

  secondaryButtonArrow: {
    color: COLORS.blue,
    fontSize: 15,
  },

  /* Loading -------------------------------------------------------------- */

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  loadingOrb: {
    width: 70,
    height: 70,
    borderRadius: 25,
    backgroundColor: COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  loadingTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },

  loadingSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 7,
  },

  /* Error ---------------------------------------------------------------- */

  errorCard: {
    width: '100%',
    maxWidth: 440,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.redSoft,
    color: COLORS.red,
    textAlign: 'center',
    lineHeight: 48,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 15,
  },

  errorTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },

  errorText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 20,
  },

  /* Footer ---------------------------------------------------------------- */

  footer: {
    alignItems: 'center',
    paddingTop: 8,
  },

  footerText: {
    color: COLORS.subtle,
    fontSize: 9,
  },
});