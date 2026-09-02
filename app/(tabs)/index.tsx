import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  getLoans,
} from '../../src/services/loanService';

import {
  getAllPayments,
} from '../../src/services/paymentService';

import {
  getDebtFreeTarget,
} from '../../src/services/debtFreeTargetService';

import {
  generateAdjustedLoanSchedule,
} from '../../src/engine/loanSchedule';

import {
  calculateTargetPerformance,
} from '../../src/engine/targetPerformance';

import type {
  Loan,
  LoanType,
} from '../../src/models/loan';

import type {
  Payment,
} from '../../src/models/payment';

/* ============================================================================
   TYPES
============================================================================ */

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

type InsightTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red';

/* ============================================================================
   DESIGN SYSTEM
============================================================================ */

const COLORS = {
  background: '#F7F7FB',
  white: '#FFFFFF',

  ink: '#171522',
  inkSoft: '#39364A',

  muted: '#8B8899',
  subtle: '#AAA7B5',

  line: '#ECEAF1',

  purple: '#7651E8',
  purpleDark: '#6339D7',
  purpleSoft: '#F0EAFF',

  lavender: '#E8DFFF',
  lavenderSoft: '#F8F4FF',

  blue: '#4C6FFF',
  blueSoft: '#EEF2FF',

  green: '#29A36A',
  greenSoft: '#EAF8F1',

  orange: '#E79B35',
  orangeSoft: '#FFF5E7',

  red: '#D95D67',
  redSoft: '#FFF0F2',

  dark: '#252033',
};

const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

/* ============================================================================
   LOAN TYPE META
============================================================================ */

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

/* ============================================================================
   HELPERS
============================================================================ */

function money(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  return `₹${Math.round(
    value,
  ).toLocaleString('en-IN')}`;
}

function compactMoney(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  const abs = Math.abs(value);

  if (abs >= 10000000) {
    return `₹${(
      value / 10000000
    ).toFixed(2)} Cr`;
  }

  if (abs >= 100000) {
    return `₹${(
      value / 100000
    ).toFixed(2)} L`;
  }

  if (abs >= 1000) {
    return `₹${(
      value / 1000
    ).toFixed(1)}K`;
  }

  return money(value);
}

function safeDate(
  value: unknown,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(String(value));

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

function formatDate(
  value: unknown,
): string {
  const date = safeDate(value);

  if (!date) {
    return '—';
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
}

function shortDate(
  value: unknown,
): string {
  const date = safeDate(value);

  if (!date) {
    return '—';
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
    },
  );
}

function monthKey(
  date: Date,
): string {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`;
}

function monthLabel(
  date: Date,
): string {
  return date.toLocaleDateString(
    'en-IN',
    {
      month: 'short',
    },
  );
}

function daysBetween(
  from: Date,
  to: Date,
): number {
  const a = new Date(from);
  const b = new Date(to);

  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  return Math.ceil(
    (b.getTime() - a.getTime()) /
      86400000,
  );
}

function getCommitment(
  loan: Loan,
): number {
  if (
    loan.repaymentType ===
    'INTEREST_ONLY'
  ) {
    return Number(
      loan.monthlyInterest || 0,
    );
  }

  return Number(
    loan.emi || 0,
  );
}

function getLoanTypeLabel(
  type: LoanType,
): string {
  return (
    LOAN_TYPE_META[type]
      ?.title ||
    'Other Loans'
  );
}

function getLoanTypeCode(
  type: LoanType,
): string {
  return (
    LOAN_TYPE_META[type]
      ?.code ||
    'OT'
  );
}

function getGreeting(): string {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

/* ============================================================================
   MAIN DASHBOARD
============================================================================ */

export default function Dashboard() {
  const router =
    useRouter();

  const {
    width,
  } = useWindowDimensions();

  const isDesktop =
    width >= 1100;

  const isTablet =
    width >= 700;

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [loans, setLoans] =
    useState<Loan[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  /*
   * Do not explicitly import DebtFreeTarget here.
   * This avoids the model mismatch that existed previously.
   */
  const [target, setTarget] =
    useState<any>(null);

  /* --------------------------------------------------------------------------
     LOAD DATA
  -------------------------------------------------------------------------- */

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setError(null);

          const [
            loadedLoans,
            loadedPayments,
            loadedTarget,
          ] =
            await Promise.all([
              getLoans(),
              getAllPayments(),
              getDebtFreeTarget(),
            ]);

          setLoans(
            Array.isArray(
              loadedLoans,
            )
              ? loadedLoans
              : [],
          );

          setPayments(
            Array.isArray(
              loadedPayments,
            )
              ? loadedPayments
              : [],
          );

          setTarget(
            loadedTarget ||
              null,
          );
        } catch (err) {
          console.error(
            'Dashboard load error:',
            err,
          );

          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load dashboard data.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        loadDashboard();
      },
      [loadDashboard],
    ),
  );

  const handleRefresh =
    useCallback(
      () => {
        setRefreshing(true);
        loadDashboard();
      },
      [loadDashboard],
    );

  /* --------------------------------------------------------------------------
     PAYMENT-AWARE LOAN CALCULATIONS
  -------------------------------------------------------------------------- */

  const calculatedLoans =
    useMemo<
      CalculatedLoan[]
    >(
      () => {
        return loans.map(
          (loan) => {
            const loanPayments =
              payments.filter(
                (payment) =>
                  payment.loanId ===
                  loan.id,
              );

            let position: any = {
              currentOutstanding:
                Number(
                  loan.currentOutstanding ||
                    loan.originalPrincipal ||
                    0,
                ),

              remainingMonths:
                Number(
                  loan.remainingMonths ||
                    0,
                ),

              nextEmiDate:
                null,

              maturityDate:
                safeDate(
                  loan.maturityDate,
                ),
            };

            try {
              position =
                generateAdjustedLoanSchedule(
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

            const actualPrincipalPaid =
              loanPayments.reduce(
                (
                  sum,
                  payment,
                ) =>
                  sum +
                  Number(
                    payment.principal ||
                      0,
                  ),
                0,
              );

            const actualInterestPaid =
              loanPayments.reduce(
                (
                  sum,
                  payment,
                ) =>
                  sum +
                  Number(
                    payment.interest ||
                      0,
                  ),
                0,
              );

            const outstanding =
              Number(
                position.currentOutstanding ??
                  loan.currentOutstanding ??
                  0,
              );

            const principalReduction =
              Math.max(
                0,
                Number(
                  loan.originalPrincipal ||
                    0,
                ) -
                  outstanding,
              );

            return {
              loan,
              position,
              payments:
                loanPayments,

              principalPaid:
                Math.max(
                  actualPrincipalPaid,
                  principalReduction,
                ),

              interestPaid:
                actualInterestPaid,
            };
          },
        );
      },
      [
        loans,
        payments,
      ],
    );

  /* --------------------------------------------------------------------------
     ACTIVE LOANS
  -------------------------------------------------------------------------- */

  const activeLoans =
    useMemo(
      () =>
        calculatedLoans.filter(
          (item) =>
            item.loan.status ===
            'ACTIVE',
        ),
      [calculatedLoans],
    );

  /* --------------------------------------------------------------------------
     SUMMARY
  -------------------------------------------------------------------------- */

  const summary =
    useMemo(
      () => {
        const totalOutstanding =
          activeLoans.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              Number(
                item.position
                  .currentOutstanding ||
                  0,
              ),
            0,
          );

        const totalOriginalPrincipal =
          activeLoans.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              Number(
                item.loan
                  .originalPrincipal ||
                  0,
              ),
            0,
          );

        const monthlyCommitment =
          activeLoans.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              getCommitment(
                item.loan,
              ),
            0,
          );

        const principalPaid =
          activeLoans.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              Number(
                item.principalPaid ||
                  0,
              ),
            0,
          );

        const interestPaid =
          activeLoans.reduce(
            (
              sum,
              item,
            ) =>
              sum +
              Number(
                item.interestPaid ||
                  0,
              ),
            0,
          );

        const repaymentPercent =
          totalOriginalPrincipal >
          0
            ? Math.min(
                100,
                Math.max(
                  0,
                  (principalPaid /
                    totalOriginalPrincipal) *
                    100,
                ),
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
      },
      [activeLoans],
    );

  /* --------------------------------------------------------------------------
     LOAN TYPE ANALYTICS
  -------------------------------------------------------------------------- */

  const loanTypeAnalytics =
    useMemo<
      LoanTypeAnalytics[]
    >(
      () => {
        const types =
          Object.keys(
            LOAN_TYPE_META,
          ) as LoanType[];

        return types
          .map(
            (type) => {
              const typeLoans =
                calculatedLoans.filter(
                  (item) =>
                    item.loan
                      .loanType ===
                    type,
                );

              if (
                typeLoans.length ===
                0
              ) {
                return null;
              }

              const active =
                typeLoans.filter(
                  (item) =>
                    item.loan
                      .status ===
                    'ACTIVE',
                );

              const paused =
                typeLoans.filter(
                  (item) =>
                    item.loan
                      .status ===
                    'PAUSED',
                );

              const closed =
                typeLoans.filter(
                  (item) =>
                    item.loan
                      .status ===
                    'CLOSED',
                );

              const outstanding =
                active.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    Number(
                      item.position
                        .currentOutstanding ||
                        0,
                    ),
                  0,
                );

              const originalPrincipal =
                active.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    Number(
                      item.loan
                        .originalPrincipal ||
                        0,
                    ),
                  0,
                );

              const monthlyCommitment =
                active.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    getCommitment(
                      item.loan,
                    ),
                  0,
                );

              const principalPaid =
                active.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    Number(
                      item.principalPaid ||
                        0,
                    ),
                  0,
                );

              const interestPaid =
                active.reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    Number(
                      item.interestPaid ||
                        0,
                    ),
                  0,
                );

              return {
                type,
                count:
                  typeLoans.length,

                activeCount:
                  active.length,

                pausedCount:
                  paused.length,

                closedCount:
                  closed.length,

                outstanding,
                originalPrincipal,
                monthlyCommitment,
                principalPaid,
                interestPaid,

                repaymentPercent:
                  originalPrincipal >
                  0
                    ? Math.min(
                        100,
                        (
                          principalPaid /
                          originalPrincipal
                        ) *
                          100,
                      )
                    : 0,
              };
            },
          )
          .filter(
            Boolean,
          ) as LoanTypeAnalytics[];
      },
      [calculatedLoans],
    );

  /* --------------------------------------------------------------------------
     DISTRIBUTION
  -------------------------------------------------------------------------- */

  const typeDistribution =
    useMemo(
      () =>
        loanTypeAnalytics
          .filter(
            (item) =>
              item.outstanding >
              0,
          )
          .sort(
            (a, b) =>
              b.outstanding -
              a.outstanding,
          )
          .map(
            (item) => ({
              ...item,

              share:
                summary.totalOutstanding >
                0
                  ? (
                      item.outstanding /
                      summary.totalOutstanding
                    ) *
                    100
                  : 0,
            }),
          ),
      [
        loanTypeAnalytics,
        summary.totalOutstanding,
      ],
    );

  /* --------------------------------------------------------------------------
     UPCOMING PAYMENTS
  -------------------------------------------------------------------------- */

  const upcomingPayments =
    useMemo<
      UpcomingPayment[]
    >(
      () => {
        const today =
          new Date();

        today.setHours(
          0,
          0,
          0,
          0,
        );

        return activeLoans
          .map(
            (item) => {
              const nextDate =
                safeDate(
                  item.position
                    .nextEmiDate,
                );

              if (!nextDate) {
                return null;
              }

              nextDate.setHours(
                0,
                0,
                0,
                0,
              );

              if (
                nextDate < today
              ) {
                return null;
              }

              return {
                loan:
                  item.loan,

                date:
                  nextDate,

                amount:
                  getCommitment(
                    item.loan,
                  ),

                isInterestOnly:
                  item.loan
                    .repaymentType ===
                  'INTEREST_ONLY',
              };
            },
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              (
                a as UpcomingPayment
              ).date.getTime() -
              (
                b as UpcomingPayment
              ).date.getTime(),
          ) as UpcomingPayment[];
      },
      [activeLoans],
    );

  const nextPayment =
    upcomingPayments[0] ||
    null;

  const next7DaysAmount =
    useMemo(
      () => {
        const today =
          new Date();

        return upcomingPayments
          .filter(
            (item) => {
              const diff =
                daysBetween(
                  today,
                  item.date,
                );

              return (
                diff >= 0 &&
                diff <= 7
              );
            },
          )
          .reduce(
            (
              sum,
              item,
            ) =>
              sum +
              item.amount,
            0,
          );
      },
      [upcomingPayments],
    );

  const thisMonthAmount =
    useMemo(
      () => {
        const today =
          new Date();

        return upcomingPayments
          .filter(
            (item) =>
              item.date.getMonth() ===
                today.getMonth() &&
              item.date.getFullYear() ===
                today.getFullYear(),
          )
          .reduce(
            (
              sum,
              item,
            ) =>
              sum +
              item.amount,
            0,
          );
      },
      [upcomingPayments],
    );

  /* --------------------------------------------------------------------------
     PAYMENT HEALTH
  -------------------------------------------------------------------------- */

  const paymentHealth =
    useMemo(
      () => {
        let paid = 0;
        let partial = 0;
        let missed = 0;
        let prepayment = 0;

        payments.forEach(
          (payment) => {
            switch (
              payment.status
            ) {
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
          },
        );

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
              ? (
                  (paid +
                    prepayment) /
                  total
                ) *
                100
              : 0,
        };
      },
      [payments],
    );

  /* --------------------------------------------------------------------------
     MONTHLY PRINCIPAL REPAYMENT
  -------------------------------------------------------------------------- */

  const monthlyPaymentTrend =
    useMemo<
      MonthlyPaymentPoint[]
    >(
      () => {
        const now =
          new Date();

        const months: {
          key: string;
          label: string;
        }[] = [];

        for (
          let i = 5;
          i >= 0;
          i -= 1
        ) {
          const date =
            new Date(
              now.getFullYear(),
              now.getMonth() -
                i,
              1,
            );

          months.push({
            key:
              monthKey(
                date,
              ),
            label:
              monthLabel(
                date,
              ),
          });
        }

        return months.map(
          (month) => {
            const value =
              payments
                .filter(
                  (
                    payment,
                  ) => {
                    const date =
                      safeDate(
                        payment.paymentDate,
                      );

                    return (
                      date !==
                        null &&
                      monthKey(
                        date,
                      ) ===
                        month.key
                    );
                  },
                )
                .reduce(
                  (
                    sum,
                    payment,
                  ) =>
                    sum +
                    Number(
                      payment.principal ||
                        0,
                    ),
                  0,
                );

            return {
              label:
                month.label,
              value,
            };
          },
        );
      },
      [payments],
    );

  const maxMonthlyPayment =
    useMemo(
      () =>
        Math.max(
          ...monthlyPaymentTrend.map(
            (item) =>
              item.value,
          ),
          1,
        ),
      [monthlyPaymentTrend],
    );

  /* --------------------------------------------------------------------------
     TARGET PERFORMANCE

     IMPORTANT:
     Use the existing target performance engine.
     Do not recreate this calculation in the UI.
  -------------------------------------------------------------------------- */

  const targetPerformance =
    useMemo(
      () => {
        if (
          !target?.targetDate
        ) {
          return null;
        }

        try {
          return calculateTargetPerformance(
            activeLoans.map(
              (item) =>
                item.loan,
            ),
            target.targetDate,
          );
        } catch (err) {
          console.warn(
            'Target performance calculation failed:',
            err,
          );

          return null;
        }
      },
      [
        target,
        activeLoans,
      ],
    );

  /* --------------------------------------------------------------------------
     INSIGHTS
  -------------------------------------------------------------------------- */

  const insights =
    useMemo(
      () => {
        const result: {
          icon: string;
          title: string;
          description: string;
          tone: InsightTone;
        }[] = [];

        const largestType =
          typeDistribution[0];

        if (
          largestType &&
          summary.totalOutstanding >
            0
        ) {
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

        if (
          next7DaysAmount >
          0
        ) {
          result.push({
            icon: '◷',

            title:
              'Upcoming cash commitment',

            description: `${money(
              next7DaysAmount,
            )} is scheduled across your loans in the next 7 days.`,

            tone: 'orange',
          });
        }

        if (
          paymentHealth.missed >
          0
        ) {
          result.push({
            icon: '!',

            title:
              'Payment attention needed',

            description: `${
              paymentHealth.missed
            } missed payment${
              paymentHealth.missed ===
              1
                ? ''
                : 's'
            } found in your payment history.`,

            tone: 'red',
          });
        } else if (
          paymentHealth.total >
            0 &&
          paymentHealth.successRate >=
            90
        ) {
          result.push({
            icon: '✓',

            title:
              'Strong payment discipline',

            description: `${paymentHealth.successRate.toFixed(
              0,
            )}% of recorded payments are paid or prepayments.`,

            tone: 'green',
          });
        }

        const nearCompletion =
          activeLoans.filter(
            (item) => {
              const remaining =
                Number(
                  item.position
                    .remainingMonths ||
                    0,
                );

              return (
                remaining >
                  0 &&
                remaining <=
                  12
              );
            },
          ).length;

        if (
          nearCompletion >
          0
        ) {
          result.push({
            icon: '↗',

            title:
              'Loans nearing completion',

            description: `${nearCompletion} active loan${
              nearCompletion ===
              1
                ? ''
                : 's'
            } have 12 months or less remaining.`,

            tone: 'green',
          });
        }

        if (
          result.length ===
          0
        ) {
          result.push({
            icon: '✦',

            title:
              'Your financial picture is ready',

            description:
              'Add payment activity to unlock deeper repayment insights.',

            tone: 'blue',
          });
        }

        return result.slice(
          0,
          4,
        );
      },
      [
        typeDistribution,
        summary.totalOutstanding,
        next7DaysAmount,
        paymentHealth,
        activeLoans,
      ],
    );

  /* --------------------------------------------------------------------------
     RECENT PAYMENTS
  -------------------------------------------------------------------------- */

  const recentPayments =
    useMemo(
      () => {
        return [
          ...payments,
        ]
          .sort(
            (a, b) => {
              const ad =
                safeDate(
                  a.paymentDate,
                )?.getTime() ||
                0;

              const bd =
                safeDate(
                  b.paymentDate,
                )?.getTime() ||
                0;

              return bd - ad;
            },
          )
          .slice(0, 5)
          .map(
            (payment) => ({
              payment,

              loan:
                loans.find(
                  (loan) =>
                    loan.id ===
                    payment.loanId,
                ) ||
                null,
            }),
          );
      },
      [
        payments,
        loans,
      ],
    );

  /* --------------------------------------------------------------------------
     LOADING
  -------------------------------------------------------------------------- */

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <View
          style={
            styles.loadingOrb
          }
        >
          <ActivityIndicator
            size="large"
            color={
              COLORS.purple
            }
          />
        </View>

        <Text
          style={
            styles.loadingTitle
          }
        >
          Building your financial picture
        </Text>

        <Text
          style={
            styles.loadingSubtitle
          }
        >
          Calculating balances, repayments and upcoming commitments...
        </Text>
      </View>
    );
  }

  /* --------------------------------------------------------------------------
     ERROR
  -------------------------------------------------------------------------- */

  if (error) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <View
          style={
            styles.errorCard
          }
        >
          <View
            style={
              styles.errorIconBox
            }
          >
            <Text
              style={
                styles.errorIcon
              }
            >
              !
            </Text>
          </View>

          <Text
            style={
              styles.errorTitle
            }
          >
            Dashboard couldn't load
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>

          <Pressable
            onPress={
              loadDashboard
            }
            style={
              styles.primaryButton
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <View
      style={
        styles.screen
      }
    >
      <ScrollView
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
            tintColor={
              COLORS.purple
            }
          />
        }
        contentContainerStyle={[
          styles.content,
          isDesktop &&
            styles.desktopContent,
        ]}
      >

        {/* ==================================================================
            HEADER
        ================================================================== */}

        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.headerLeft
            }
          >
            <View
              style={
                styles.brandMark
              }
            >
              <Text
                style={
                  styles.brandMarkText
                }
              >
                ₹
              </Text>
            </View>

            <View>
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                FINANCIAL OVERVIEW
              </Text>

              <Text
                style={
                  styles.pageTitle
                }
              >
                {getGreeting()}
              </Text>

              <Text
                style={
                  styles.pageSubtitle
                }
              >
                Here's how your debt is looking today.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={
              handleRefresh
            }
            style={({ pressed }) => [
              styles.refreshButton,
              pressed &&
                styles.refreshButtonPressed,
            ]}
          >
            <Text
              style={
                styles.refreshIcon
              }
            >
              ↻
            </Text>

            {isTablet && (
              <Text
                style={
                  styles.refreshText
                }
              >
                Refresh
              </Text>
            )}
          </Pressable>
        </View>

        {/* ==================================================================
            HERO + METRICS
        ================================================================== */}

        <View
          style={[
            styles.heroGrid,
            !isDesktop &&
              styles.stack,
          ]}
        >

          {/* MAIN BALANCE */}

          <View
            style={
              styles.heroCard
            }
          >
            <View
              pointerEvents="none"
              style={
                styles.heroGlowOne
              }
            />

            <View
              pointerEvents="none"
              style={
                styles.heroGlowTwo
              }
            />

            <View
              style={
                styles.heroTop
              }
            >
              <View>
                <Text
                  style={
                    styles.heroLabel
                  }
                >
                  CURRENT OUTSTANDING
                </Text>

                <Text
                  style={
                    styles.heroHint
                  }
                >
                  Active loan portfolio
                </Text>
              </View>

              <View
                style={
                  styles.livePill
                }
              >
                <View
                  style={
                    styles.liveDot
                  }
                />

                <Text
                  style={
                    styles.liveText
                  }
                >
                  LIVE
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.heroAmount
              }
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {compactMoney(
                summary.totalOutstanding,
              )}
            </Text>

            <View
              style={
                styles.heroProgressHeader
              }
            >
              <Text
                style={
                  styles.heroProgressText
                }
              >
                {summary.repaymentPercent.toFixed(
                  1,
                )}
                % principal repaid
              </Text>

              <Text
                style={
                  styles.heroProgressText
                }
              >
                {compactMoney(
                  summary.principalPaid,
                )}{' '}
                paid
              </Text>
            </View>

            <View
              style={
                styles.heroProgressTrack
              }
            >
              <View
                style={[
                  styles.heroProgressFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        summary.repaymentPercent,
                      ),
                    )}%`,
                  },
                ]}
              />
            </View>

            <View
              style={
                styles.heroBottom
              }
            >
              <View>
                <Text
                  style={
                    styles.heroBottomLabel
                  }
                >
                  Original principal
                </Text>

                <Text
                  style={
                    styles.heroBottomValue
                  }
                >
                  {compactMoney(
                    summary.totalOriginalPrincipal,
                  )}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push(
                    '/loans',
                  )
                }
                style={
                  styles.heroArrow
                }
              >
                <Text
                  style={
                    styles.heroArrowText
                  }
                >
                  ↗
                </Text>
              </Pressable>
            </View>
          </View>

          {/* METRICS */}

          <View
            style={[
              styles.statsGrid,
              !isDesktop &&
                styles.statsGridMobile,
            ]}
          >
            <MetricCard
              label="Monthly commitment"
              value={compactMoney(
                summary.monthlyCommitment,
              )}
              detail="EMI + interest-only"
              icon="◷"
              tone="purple"
            />

            <MetricCard
              label="Active loans"
              value={String(
                activeLoans.length,
              )}
              detail={`${loans.length} total loans`}
              icon="◈"
              tone="blue"
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

        {/* ==================================================================
            NEXT COMMITMENT
        ================================================================== */}

        <View
          style={
            styles.nextPaymentCard
          }
        >
          <View
            style={
              styles.nextPaymentIcon
            }
          >
            <Text
              style={
                styles.nextPaymentIconText
              }
            >
              ◷
            </Text>
          </View>

          <View
            style={
              styles.nextPaymentMain
            }
          >
            <Text
              style={
                styles.nextPaymentEyebrow
              }
            >
              NEXT COMMITMENT
            </Text>

            {nextPayment ? (
              <>
                <Text
                  style={
                    styles.nextPaymentTitle
                  }
                  numberOfLines={1}
                >
                  {nextPayment.loan.loanName}
                </Text>

                <Text
                  style={
                    styles.nextPaymentSub
                  }
                >
                  {getLoanTypeCode(
                    nextPayment.loan.loanType,
                  )}
                  {' · '}
                  {nextPayment.loan.lender}
                  {nextPayment.isInterestOnly
                    ? ' · Interest Only'
                    : ' · EMI'}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={
                    styles.nextPaymentTitle
                  }
                >
                  No upcoming payment
                </Text>

                <Text
                  style={
                    styles.nextPaymentSub
                  }
                >
                  No future EMI date is currently available.
                </Text>
              </>
            )}
          </View>

          <View
            style={
              styles.nextPaymentRight
            }
          >
            <Text
              style={
                styles.nextPaymentAmount
              }
            >
              {nextPayment
                ? money(
                    nextPayment.amount,
                  )
                : '—'}
            </Text>

            <Text
              style={
                styles.nextPaymentDate
              }
            >
              {nextPayment
                ? formatDate(
                    nextPayment.date,
                  )
                : '—'}
            </Text>
          </View>
        </View>

        {/* ==================================================================
            PORTFOLIO
        ================================================================== */}

        <SectionHeader
          eyebrow="YOUR PORTFOLIO"
          title="Debt by loan type"
          description="See exactly where your outstanding balance is concentrated."
        />

        {loanTypeAnalytics.length ===
        0 ? (
          <GlassCard>
            <EmptyState
              title="No loans yet"
              description="Add your first loan to start building your financial picture."
            />
          </GlassCard>
        ) : (
          <View
            style={
              styles.typeGrid
            }
          >
            {loanTypeAnalytics.map(
              (item) => (
                <LoanTypeCard
                  key={item.type}
                  item={item}
                  totalOutstanding={
                    summary.totalOutstanding
                  }
                  onPress={() =>
                    router.push(
                      '/loans',
                    )
                  }
                />
              ),
            )}
          </View>
        )}

        {/* ==================================================================
            ANALYTICS
        ================================================================== */}

        <View
          style={[
            styles.analyticsRow,
            !isDesktop &&
              styles.stack,
          ]}
        >

          {/* DEBT DISTRIBUTION */}

          <GlassCard
            style={
              styles.analyticsCard
            }
          >
            <CardHeading
              title="Debt distribution"
              subtitle="Outstanding balance by type"
            />

            {typeDistribution.length ===
            0 ? (
              <EmptyState
                title="No active debt"
                description="Your active portfolio will appear here."
              />
            ) : (
              <View
                style={
                  styles.distributionList
                }
              >
                {typeDistribution.map(
                  (
                    item,
                    index,
                  ) => {
                    const barColors =
                      [
                        COLORS.purple,
                        COLORS.blue,
                        COLORS.green,
                        COLORS.orange,
                        COLORS.red,
                      ];

                    const barColor =
                      barColors[
                        index %
                          barColors.length
                      ];

                    return (
                      <View
                        key={
                          item.type
                        }
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
                                    barColor,
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
                              )}
                              {' · '}
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
                                  barColor,
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
                    );
                  },
                )}
              </View>
            )}
          </GlassCard>

          {/* REPAYMENT ACTIVITY */}

          <GlassCard
            style={
              styles.analyticsCard
            }
          >
            <CardHeading
              title="Repayment activity"
              subtitle="Principal repaid over the last 6 months"
            />

            <View
              style={
                styles.chartSummary
              }
            >
              <View>
                <Text
                  style={
                    styles.chartSummaryLabel
                  }
                >
                  TOTAL PRINCIPAL PAID
                </Text>

                <Text
                  style={
                    styles.chartSummaryValue
                  }
                >
                  {compactMoney(
                    summary.principalPaid,
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.chartLegend
                }
              >
                <View
                  style={
                    styles.chartLegendDot
                  }
                />

                <Text
                  style={
                    styles.chartLegendText
                  }
                >
                  Principal
                </Text>
              </View>
            </View>

            <View
              style={
                styles.chart
              }
            >
              {monthlyPaymentTrend.map(
                (point) => {
                  const height =
                    point.value >
                    0
                      ? Math.max(
                          8,
                          (
                            point.value /
                            maxMonthlyPayment
                          ) *
                            125,
                        )
                      : 5;

                  return (
                    <View
                      key={
                        point.label
                      }
                      style={
                        styles.chartColumn
                      }
                    >
                      <Text
                        style={
                          styles.chartValue
                        }
                      >
                        {point.value >
                        0
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
                        {
                          point.label
                        }
                      </Text>
                    </View>
                  );
                },
              )}
            </View>

            <View
              style={
                styles.chartFooter
              }
            >
              <Text
                style={
                  styles.chartFooterLabel
                }
              >
                Current outstanding
              </Text>

              <Text
                style={
                  styles.chartFooterValue
                }
              >
                {compactMoney(
                  summary.totalOutstanding,
                )}
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* ==================================================================
            UPCOMING + HEALTH
        ================================================================== */}

        <View
          style={[
            styles.analyticsRow,
            !isDesktop &&
              styles.stack,
          ]}
        >

          {/* UPCOMING */}

          <GlassCard
            style={
              styles.upcomingCard
            }
          >
            <CardHeading
              title="Upcoming commitments"
              subtitle="Your next scheduled loan payments"
            />

            <View
              style={
                styles.commitmentSummary
              }
            >
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

            <View
              style={
                styles.upcomingList
              }
            >
              {upcomingPayments
                .slice(0, 5)
                .map(
                  (
                    item,
                    index,
                  ) => (
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
                            .padStart(
                              2,
                              '0',
                            )}
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
                                month:
                                  'short',
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
                          numberOfLines={
                            1
                          }
                        >
                          {
                            item.loan
                              .loanName
                          }
                        </Text>

                        <Text
                          style={
                            styles.upcomingMeta
                          }
                        >
                          {getLoanTypeCode(
                            item.loan
                              .loanType,
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
                        {money(
                          item.amount,
                        )}
                      </Text>
                    </View>
                  ),
                )}

              {upcomingPayments.length ===
                0 && (
                <EmptyState
                  title="No upcoming commitments"
                  description="There are no future EMI dates available for your active loans."
                />
              )}
            </View>
          </GlassCard>

          {/* PAYMENT HEALTH */}

          <GlassCard
            style={
              styles.healthCard
            }
          >
            <CardHeading
              title="Payment health"
              subtitle="Based on your recorded payment history"
            />

            <View
              style={
                styles.healthLayout
              }
            >
              <View
                style={
                  styles.healthCircle
                }
              >
                <View
                  style={
                    styles.healthCircleInner
                  }
                >
                  <Text
                    style={
                      styles.healthScoreValue
                    }
                  >
                    {paymentHealth.total >
                    0
                      ? paymentHealth.successRate.toFixed(
                          0,
                        )
                      : '—'}
                    {paymentHealth.total >
                      0 &&
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
              </View>

              <View
                style={
                  styles.healthLegend
                }
              >
                <HealthRow
                  label="Paid"
                  value={
                    paymentHealth.paid
                  }
                  dot={
                    COLORS.green
                  }
                />

                <HealthRow
                  label="Prepayment"
                  value={
                    paymentHealth.prepayment
                  }
                  dot={
                    COLORS.purple
                  }
                />

                <HealthRow
                  label="Partial"
                  value={
                    paymentHealth.partial
                  }
                  dot={
                    COLORS.orange
                  }
                />

                <HealthRow
                  label="Missed"
                  value={
                    paymentHealth.missed
                  }
                  dot={
                    COLORS.red
                  }
                />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ==================================================================
            SMART INSIGHTS
        ================================================================== */}

        <SectionHeader
          eyebrow="FINANCIAL INTELLIGENCE"
          title="Smart insights"
          description="Useful observations generated from your actual loan and payment data."
        />

        <View
          style={[
            styles.insightGrid,
            !isDesktop &&
              styles.stack,
          ]}
        >
          {insights.map(
            (
              insight,
              index,
            ) => (
              <InsightCard
                key={`${insight.title}-${index}`}
                {...insight}
              />
            ),
          )}
        </View>

        {/* ==================================================================
            DEBT FREE TARGET
        ================================================================== */}

        <SectionHeader
          eyebrow="YOUR GOAL"
          title="Debt-free journey"
          description="Track how your current repayment path compares with your target."
        />

        <GlassCard
          style={
            styles.targetCard
          }
        >
          {!target?.targetDate ? (
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
                  Choose a target date and turn your dashboard into a debt-free roadmap.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push(
                    '/debt-free-target',
                  )
                }
                style={
                  styles.primaryButton
                }
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
              target={
                target
              }
              performance={
                targetPerformance
              }
              router={
                router
              }
            />
          )}
        </GlassCard>

        {/* ==================================================================
            RECENT PAYMENTS
        ================================================================== */}

        <SectionHeader
          eyebrow="RECENT ACTIVITY"
          title="Recent payments"
          description="Latest payment activity recorded against your loans."
        />

        <GlassCard
          style={
            styles.recentCard
          }
        >
          {recentPayments.length ===
          0 ? (
            <EmptyState
              title="No payment activity"
              description="Your recent payments will appear here."
            />
          ) : (
            recentPayments.map(
              ({
                payment,
                loan,
              }) => (
                <View
                  key={
                    payment.id ||
                    `${payment.loanId}-${payment.paymentDate}`
                  }
                  style={
                    styles.recentPaymentRow
                  }
                >
                  <View
                    style={
                      styles.recentIcon
                    }
                  >
                    <Text
                      style={
                        styles.recentIconText
                      }
                    >
                      {payment.status ===
                      'MISSED'
                        ? '!'
                        : payment.status ===
                            'PREPAYMENT'
                          ? '↗'
                          : '✓'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.recentMain
                    }
                  >
                    <Text
                      style={
                        styles.recentTitle
                      }
                    >
                      {loan?.loanName ||
                        'Loan payment'}
                    </Text>

                    <Text
                      style={
                        styles.recentSub
                      }
                    >
                      {payment.status}
                      {' · '}
                      {shortDate(
                        payment.paymentDate,
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.recentAmountBlock
                    }
                  >
                    <Text
                      style={
                        styles.recentAmount
                      }
                    >
                      {money(
                        Number(
                          payment.amount ||
                            0,
                        ),
                      )}
                    </Text>

                    <Text
                      style={
                        styles.recentPrincipal
                      }
                    >
                      Principal{' '}
                      {money(
                        Number(
                          payment.principal ||
                            0,
                        ),
                      )}
                    </Text>
                  </View>
                </View>
              ),
            )
          )}
        </GlassCard>

        {/* ==================================================================
            FOOTER
        ================================================================== */}

        <View
          style={
            styles.footer
          }
        >
          <Text
            style={
              styles.footerText
            }
          >
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

/* ============================================================================
   METRIC CARD
============================================================================ */

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
  tone:
    | 'purple'
    | 'blue'
    | 'green'
    | 'orange';
}) {
  const toneMap = {
    purple: {
      background:
        COLORS.purpleSoft,
      color:
        COLORS.purple,
    },

    blue: {
      background:
        COLORS.blueSoft,
      color:
        COLORS.blue,
    },

    green: {
      background:
        COLORS.greenSoft,
      color:
        COLORS.green,
    },

    orange: {
      background:
        COLORS.orangeSoft,
      color:
        COLORS.orange,
    },
  };

  const current =
    toneMap[tone];

  return (
    <View
      style={
        styles.metricCard
      }
    >
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
              color:
                current.color,
            },
          ]}
        >
          {icon}
        </Text>
      </View>

      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.metricValue
        }
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      <Text
        style={
          styles.metricDetail
        }
      >
        {detail}
      </Text>
    </View>
  );
}

/* ============================================================================
   LOAN TYPE CARD
============================================================================ */

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
    LOAN_TYPE_META[
      item.type
    ];

  const share =
    totalOutstanding >
    0
      ? (
          item.outstanding /
          totalOutstanding
        ) * 100
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeCard,
        pressed &&
          styles.typeCardPressed,
      ]}
    >
      <View
        style={
          styles.typeCardHeader
        }
      >
        <View
          style={
            styles.typeIdentity
          }
        >
          <View
            style={
              styles.typeCode
            }
          >
            <Text
              style={
                styles.typeCodeText
              }
            >
              {meta.code}
            </Text>
          </View>

          <View
            style={
              styles.typeNameBlock
            }
          >
            <Text
              style={
                styles.typeTitle
              }
            >
              {meta.title}
            </Text>

            <Text
              style={
                styles.typeDescription
              }
            >
              {meta.description}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.typeCountPill
          }
        >
          <Text
            style={
              styles.typeCount
            }
          >
            {item.count}
          </Text>

          <Text
            style={
              styles.typeCountLabel
            }
          >
            {item.count ===
            1
              ? 'loan'
              : 'loans'}
          </Text>
        </View>
      </View>

      <Text
        style={
          styles.typeBalanceLabel
        }
      >
        Outstanding
      </Text>

      <Text
        style={
          styles.typeBalanceValue
        }
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {compactMoney(
          item.outstanding,
        )}
      </Text>

      <View
        style={
          styles.typeProgressTrack
        }
      >
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

      <View
        style={
          styles.typeStats
        }
      >
        <View>
          <Text
            style={
              styles.typeStatLabel
            }
          >
            Active
          </Text>

          <Text
            style={
              styles.typeStatValue
            }
          >
            {item.activeCount}
          </Text>
        </View>

        <View>
          <Text
            style={
              styles.typeStatLabel
            }
          >
            Monthly
          </Text>

          <Text
            style={
              styles.typeStatValue
            }
          >
            {compactMoney(
              item.monthlyCommitment,
            )}
          </Text>
        </View>

        <View>
          <Text
            style={
              styles.typeStatLabel
            }
          >
            Portfolio
          </Text>

          <Text
            style={
              styles.typeStatValue
            }
          >
            {share.toFixed(
              0,
            )}
            %
          </Text>
        </View>
      </View>

      <View
        style={
          styles.typeFooter
        }
      >
        <Text
          style={
            styles.typeFooterText
          }
        >
          {item.repaymentPercent.toFixed(
            1,
          )}
          % principal repaid
        </Text>

        <Text
          style={
            styles.typeArrow
          }
        >
          →
        </Text>
      </View>
    </Pressable>
  );
}

/* ============================================================================
   GLASS / SURFACE CARD
============================================================================ */

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.glassCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ============================================================================
   SECTION HEADER
============================================================================ */

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
    <View
      style={
        styles.sectionHeader
      }
    >
      <Text
        style={
          styles.sectionEyebrow
        }
      >
        {eyebrow}
      </Text>

      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.sectionDescription
        }
      >
        {description}
      </Text>
    </View>
  );
}

/* ============================================================================
   CARD HEADING
============================================================================ */

function CardHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={
        styles.cardHeading
      }
    >
      <Text
        style={
          styles.cardTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.cardSubtitle
        }
      >
        {subtitle}
      </Text>
    </View>
  );
}

/* ============================================================================
   MINI SUMMARY
============================================================================ */

function MiniSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone:
    | 'blue'
    | 'green'
    | 'orange';
}) {
  const color =
    tone === 'blue'
      ? COLORS.blue
      : tone === 'green'
        ? COLORS.green
        : COLORS.orange;

  return (
    <View
      style={
        styles.miniSummary
      }
    >
      <View
        style={[
          styles.miniSummaryDot,
          {
            backgroundColor:
              color,
          },
        ]}
      />

      <View>
        <Text
          style={
            styles.miniSummaryLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.miniSummaryValue
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================================
   HEALTH ROW
============================================================================ */

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
    <View
      style={
        styles.healthRow
      }
    >
      <View
        style={
          styles.healthLabel
        }
      >
        <View
          style={[
            styles.healthDot,
            {
              backgroundColor:
                dot,
            },
          ]}
        />

        <Text
          style={
            styles.healthText
          }
        >
          {label}
        </Text>
      </View>

      <Text
        style={
          styles.healthValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/* ============================================================================
   INSIGHT CARD
============================================================================ */

function InsightCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: string;
  title: string;
  description: string;
  tone: InsightTone;
}) {
  const map = {
    blue: {
      background:
        COLORS.blueSoft,
      color:
        COLORS.blue,
    },

    green: {
      background:
        COLORS.greenSoft,
      color:
        COLORS.green,
    },

    orange: {
      background:
        COLORS.orangeSoft,
      color:
        COLORS.orange,
    },

    red: {
      background:
        COLORS.redSoft,
      color:
        COLORS.red,
    },
  };

  const current =
    map[tone];

  return (
    <View
      style={
        styles.insightCard
      }
    >
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
              color:
                current.color,
            },
          ]}
        >
          {icon}
        </Text>
      </View>

      <View
        style={
          styles.insightContent
        }
      >
        <Text
          style={
            styles.insightTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.insightDescription
          }
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================================
   TARGET CONTENT
============================================================================ */

function TargetContent({
  target,
  performance,
  router,
}: {
  target: any;
  performance: any;
  router: ReturnType<
    typeof useRouter
  >;
}) {
  const status =
    performance?.status ||
    'ON_TRACK';

  const statusConfig =
    status === 'AHEAD'
      ? {
          label:
            'Ahead of target',
          background:
            COLORS.greenSoft,
          color:
            COLORS.green,
          icon: '↗',
        }
      : status === 'BEHIND'
        ? {
            label:
              'Needs attention',
            background:
              COLORS.orangeSoft,
            color:
              COLORS.orange,
            icon: '!',
          }
        : {
            label:
              'On track',
            background:
              COLORS.purpleSoft,
            color:
              COLORS.purple,
            icon: '✓',
          };

  const currentOutstanding =
    Number(
      performance?.currentOutstanding ??
        0,
    );

  const targetDate =
    target?.targetDate;

  const projectedDate =
    performance?.projectedDebtFreeDate;

  return (
    <View>
      <View
        style={
          styles.targetHeader
        }
      >
        <View
          style={
            styles.targetHeaderContent
          }
        >
          <Text
            style={
              styles.targetEyebrow
            }
          >
            DEBT-FREE TARGET
          </Text>

          <Text
            style={
              styles.targetTitle
            }
          >
            Your destination is{' '}
            {formatDate(
              targetDate,
            )}
          </Text>

          <Text
            style={
              styles.targetSubtitle
            }
          >
            Keep reducing principal and stay on the path to becoming debt-free.
          </Text>
        </View>

        <View
          style={[
            styles.targetStatus,
            {
              backgroundColor:
                statusConfig.background,
            },
          ]}
        >
          <Text
            style={[
              styles.targetStatusIcon,
              {
                color:
                  statusConfig.color,
              },
            ]}
          >
            {
              statusConfig.icon
            }
          </Text>

          <Text
            style={[
              styles.targetStatusText,
              {
                color:
                  statusConfig.color,
              },
            ]}
          >
            {
              statusConfig.label
            }
          </Text>
        </View>
      </View>

      <View
        style={
          styles.targetMetrics
        }
      >
        <TargetMetric
          label="Current outstanding"
          value={compactMoney(
            currentOutstanding,
          )}
        />

        <TargetMetric
          label="Target date"
          value={formatDate(
            targetDate,
          )}
        />

        <TargetMetric
          label="Projected date"
          value={formatDate(
            projectedDate,
          )}
        />
      </View>

      <View
        style={
          styles.targetBottom
        }
      >
        <Text
          style={
            styles.targetBottomText
          }
        >
          {performance
            ?.requiredAdditionalPrincipal
            ? `${money(
                Number(
                  performance.requiredAdditionalPrincipal,
                ),
              )} additional principal reduction may be required.`
            : 'Your current repayment path is being tracked against your target.'}
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              '/debt-free-target',
            )
          }
          style={
            styles.secondaryButton
          }
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

/* ============================================================================
   TARGET METRIC
============================================================================ */

function TargetMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.targetMetric
      }
    >
      <Text
        style={
          styles.targetMetricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.targetMetricValue
        }
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

/* ============================================================================
   EMPTY STATE
============================================================================ */

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View
      style={
        styles.emptyState
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
          ◇
        </Text>
      </View>

      <Text
        style={
          styles.emptyTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.emptyDescription
        }
      >
        {description}
      </Text>
    </View>
  );
}

/* ============================================================================
   STYLES
============================================================================ */

const styles =
  StyleSheet.create({

    screen: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    content: {
      paddingHorizontal: 28,
      paddingTop: 28,
      paddingBottom: 70,
    },

    desktopContent: {
      width: '100%',
      maxWidth: 1440,
      alignSelf: 'center',
    },

    stack: {
      flexDirection:
        'column',
    },

    /* ----------------------------------------------------------------------
       HEADER
    ---------------------------------------------------------------------- */

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 28,
    },

    headerLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexShrink: 1,
    },

    brandMark: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor:
        COLORS.dark,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 14,

      shadowColor:
        '#000000',
      shadowOpacity:
        0.12,
      shadowRadius:
        12,
      shadowOffset: {
        width: 0,
        height: 6,
      },

      elevation: 4,
    },

    brandMarkText: {
      color:
        COLORS.white,
      fontFamily:
        FONT.extraBold,
      fontSize: 20,
    },

    headerEyebrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 9,
      letterSpacing: 1.6,
      marginBottom: 2,
    },

    pageTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing:
        -1.1,
    },

    pageSubtitle: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 12,
      marginTop: 2,
    },

    refreshButton: {
      height: 42,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    refreshButtonPressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    refreshIcon: {
      color:
        COLORS.inkSoft,
      fontFamily:
        FONT.medium,
      fontSize: 20,
    },

    refreshText: {
      color:
        COLORS.inkSoft,
      fontFamily:
        FONT.semiBold,
      fontSize: 11,
      marginLeft: 7,
    },

    /* ----------------------------------------------------------------------
       HERO
    ---------------------------------------------------------------------- */

    heroGrid: {
      flexDirection:
        'row',
      gap: 18,
      marginBottom: 18,
    },

    heroCard: {
      flex: 1.5,
      minHeight: 300,
      borderRadius: 28,
      padding: 28,
      backgroundColor:
        COLORS.purple,
      overflow: 'hidden',
      position:
        'relative',

      shadowColor:
        COLORS.purpleDark,
      shadowOpacity:
        0.22,
      shadowRadius:
        25,
      shadowOffset: {
        width: 0,
        height: 11,
      },

      elevation: 8,
    },

    heroGlowOne: {
      position:
        'absolute',
      width: 330,
      height: 330,
      borderRadius: 200,
      backgroundColor:
        'rgba(255,255,255,0.09)',
      top: -180,
      right: -80,
    },

    heroGlowTwo: {
      position:
        'absolute',
      width: 250,
      height: 250,
      borderRadius: 180,
      backgroundColor:
        'rgba(255,255,255,0.055)',
      bottom: -150,
      left: -90,
    },

    heroTop: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },

    heroLabel: {
      color:
        'rgba(255,255,255,0.72)',
      fontFamily:
        FONT.extraBold,
      fontSize: 9,
      letterSpacing: 1.5,
    },

    heroHint: {
      color:
        'rgba(255,255,255,0.48)',
      fontFamily:
        FONT.regular,
      fontSize: 11,
      marginTop: 4,
    },

    livePill: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor:
        'rgba(255,255,255,0.13)',
    },

    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 6,
      backgroundColor:
        '#DFFBEA',
      marginRight: 6,
    },

    liveText: {
      color:
        COLORS.white,
      fontFamily:
        FONT.extraBold,
      fontSize: 8,
      letterSpacing: 1,
    },

    heroAmount: {
      color:
        COLORS.white,
      fontFamily:
        FONT.extraBold,
      fontSize: 54,
      lineHeight: 62,
      letterSpacing:
        -2.2,
      marginTop: 38,
      maxWidth: '92%',
    },

    heroProgressHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginTop: 24,
      marginBottom: 8,
    },

    heroProgressText: {
      color:
        'rgba(255,255,255,0.68)',
      fontFamily:
        FONT.medium,
      fontSize: 10,
    },

    heroProgressTrack: {
      height: 6,
      borderRadius: 99,
      overflow:
        'hidden',
      backgroundColor:
        'rgba(255,255,255,0.18)',
    },

    heroProgressFill: {
      height: '100%',
      borderRadius: 99,
      backgroundColor:
        COLORS.white,
    },

    heroBottom: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      marginTop: 23,
    },

    heroBottomLabel: {
      color:
        'rgba(255,255,255,0.48)',
      fontFamily:
        FONT.regular,
      fontSize: 9,
    },

    heroBottomValue: {
      color:
        COLORS.white,
      fontFamily:
        FONT.bold,
      fontSize: 15,
      marginTop: 3,
    },

    heroArrow: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(255,255,255,0.13)',
    },

    heroArrowText: {
      color:
        COLORS.white,
      fontSize: 20,
      fontFamily:
        FONT.medium,
    },

    /* ----------------------------------------------------------------------
       METRICS
    ---------------------------------------------------------------------- */

    statsGrid: {
      flex: 1,
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 18,
    },

    statsGridMobile: {
      width: '100%',
    },

    metricCard: {
      flexGrow: 1,
      flexBasis: 205,
      minHeight: 141,
      padding: 19,
      borderRadius: 21,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,

      shadowColor:
        '#5B5870',
      shadowOpacity:
        0.055,
      shadowRadius:
        18,
      shadowOffset: {
        width: 0,
        height: 7,
      },

      elevation: 2,
    },

    metricIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 12,
    },

    metricIconText: {
      fontFamily:
        FONT.bold,
      fontSize: 16,
    },

    metricLabel: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.medium,
      fontSize: 10,
    },

    metricValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 24,
      lineHeight: 29,
      letterSpacing:
        -0.7,
      marginTop: 3,
    },

    metricDetail: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      marginTop: 3,
    },

    /* ----------------------------------------------------------------------
       NEXT PAYMENT
    ---------------------------------------------------------------------- */

    nextPaymentCard: {
      minHeight: 82,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 28,

      flexDirection:
        'row',
      alignItems:
        'center',

      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,

      shadowColor:
        '#5B5870',
      shadowOpacity:
        0.045,
      shadowRadius:
        17,
      shadowOffset: {
        width: 0,
        height: 6,
      },

      elevation: 2,
    },

    nextPaymentIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    nextPaymentIconText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.bold,
      fontSize: 18,
    },

    nextPaymentMain: {
      flex: 1,
      minWidth: 0,
    },

    nextPaymentEyebrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 8,
      letterSpacing: 1.2,
    },

    nextPaymentTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 14,
      marginTop: 2,
    },

    nextPaymentSub: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      marginTop: 2,
    },

    nextPaymentRight: {
      alignItems:
        'flex-end',
      marginLeft: 12,
    },

    nextPaymentAmount: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 17,
    },

    nextPaymentDate: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      marginTop: 2,
    },

    /* ----------------------------------------------------------------------
       SECTIONS
    ---------------------------------------------------------------------- */

    sectionHeader: {
      marginTop: 8,
      marginBottom: 15,
    },

    sectionEyebrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 8,
      letterSpacing: 1.5,
      marginBottom: 3,
    },

    sectionTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 21,
      lineHeight: 26,
      letterSpacing:
        -0.5,
    },

    sectionDescription: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    /* ----------------------------------------------------------------------
       CARD
    ---------------------------------------------------------------------- */

    glassCard: {
      borderRadius: 23,
      padding: 22,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,

      shadowColor:
        '#5B5870',
      shadowOpacity:
        0.05,
      shadowRadius:
        20,
      shadowOffset: {
        width: 0,
        height: 7,
      },

      elevation: 2,
    },

    cardHeading: {
      marginBottom: 18,
    },

    cardTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 17,
      lineHeight: 22,
    },

    cardSubtitle: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 10,
      marginTop: 3,
    },

    /* ----------------------------------------------------------------------
       LOAN TYPES
    ---------------------------------------------------------------------- */

    typeGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 16,
      marginBottom: 30,
    },

    typeCard: {
      flexGrow: 1,
      flexBasis: 285,
      minWidth: 270,
      borderRadius: 22,
      padding: 20,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,

      shadowColor:
        '#5B5870',
      shadowOpacity:
        0.045,
      shadowRadius:
        18,
      shadowOffset: {
        width: 0,
        height: 6,
      },

      elevation: 2,
    },

    typeCardPressed: {
      opacity: 0.86,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    typeCardHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    typeIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flex: 1,
      minWidth: 0,
    },

    typeCode: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    typeCodeText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 11,
    },

    typeNameBlock: {
      flex: 1,
    },

    typeTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 13,
    },

    typeDescription: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 8,
      marginTop: 2,
    },

    typeCountPill: {
      minWidth: 45,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 11,
      backgroundColor:
        '#F7F6FA',
      alignItems:
        'center',
    },

    typeCount: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 13,
    },

    typeCountLabel: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 7,
    },

    typeBalanceLabel: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      marginTop: 22,
    },

    typeBalanceValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 27,
      lineHeight: 33,
      letterSpacing:
        -0.8,
      marginTop: 2,
    },

    typeProgressTrack: {
      height: 5,
      borderRadius: 99,
      backgroundColor:
        '#F0EEF4',
      overflow:
        'hidden',
      marginTop: 15,
    },

    typeProgressFill: {
      height: '100%',
      borderRadius: 99,
      backgroundColor:
        COLORS.purple,
    },

    typeStats: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginTop: 16,
    },

    typeStatLabel: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 8,
    },

    typeStatValue: {
      color:
        COLORS.inkSoft,
      fontFamily:
        FONT.bold,
      fontSize: 10,
      marginTop: 3,
    },

    typeFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginTop: 16,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.line,
    },

    typeFooterText: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.medium,
      fontSize: 9,
    },

    typeArrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.medium,
      fontSize: 17,
    },

    /* ----------------------------------------------------------------------
       ANALYTICS
    ---------------------------------------------------------------------- */

    analyticsRow: {
      flexDirection:
        'row',
      gap: 18,
      marginBottom: 18,
    },

    analyticsCard: {
      flex: 1,
      minWidth: 0,
    },

    upcomingCard: {
      flex: 1.65,
      minWidth: 0,
    },

    healthCard: {
      flex: 1,
      minWidth: 0,
    },

    /* Distribution */

    distributionList: {
      gap: 17,
    },

    distributionItem: {
      gap: 6,
    },

    distributionTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    distributionName: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flex: 1,
    },

    distributionDot: {
      width: 7,
      height: 7,
      borderRadius: 7,
      marginRight: 8,
    },

    distributionLabel: {
      color:
        COLORS.inkSoft,
      fontFamily:
        FONT.medium,
      fontSize: 10,
    },

    distributionValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    distributionTrack: {
      height: 6,
      borderRadius: 99,
      backgroundColor:
        '#F1EFF5',
      overflow:
        'hidden',
    },

    distributionFill: {
      height: '100%',
      borderRadius: 99,
    },

    distributionShare: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 8,
    },

    /* Chart */

    chartSummary: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      marginBottom: 5,
    },

    chartSummaryLabel: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.extraBold,
      fontSize: 7,
      letterSpacing: 1,
    },

    chartSummaryValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 23,
      marginTop: 3,
    },

    chartLegend: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    chartLegendDot: {
      width: 7,
      height: 7,
      borderRadius: 7,
      backgroundColor:
        COLORS.purple,
      marginRight: 6,
    },

    chartLegendText: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 8,
    },

    chart: {
      height: 180,
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      gap: 9,
      marginTop: 4,
    },

    chartColumn: {
      flex: 1,
      height: '100%',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
    },

    chartValue: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 7,
      height: 17,
      textAlign:
        'center',
    },

    chartTrack: {
      height: 128,
      width: '65%',
      minWidth: 15,
      maxWidth: 30,
      borderRadius: 99,
      backgroundColor:
        '#F1EFF6',
      overflow:
        'hidden',
      justifyContent:
        'flex-end',
    },

    chartBar: {
      width: '100%',
      borderRadius: 99,
      backgroundColor:
        COLORS.purple,
    },

    chartLabel: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.medium,
      fontSize: 8,
      marginTop: 7,
    },

    chartFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderTopWidth: 1,
      borderTopColor:
        COLORS.line,
      marginTop: 16,
      paddingTop: 13,
    },

    chartFooterLabel: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
    },

    chartFooterValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    /* ----------------------------------------------------------------------
       COMMITMENTS
    ---------------------------------------------------------------------- */

    commitmentSummary: {
      flexDirection:
        'row',
      gap: 9,
      marginBottom: 17,
    },

    miniSummary: {
      flex: 1,
      minWidth: 100,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 13,
      backgroundColor:
        '#FAF9FC',
    },

    miniSummaryDot: {
      width: 6,
      height: 6,
      borderRadius: 6,
      marginRight: 7,
    },

    miniSummaryLabel: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 7,
    },

    miniSummaryValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 10,
      marginTop: 2,
    },

    upcomingList: {
      gap: 7,
    },

    upcomingRow: {
      minHeight: 58,
      borderRadius: 14,
      backgroundColor:
        '#FAF9FC',
      paddingHorizontal: 9,
      paddingVertical: 7,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    upcomingDateBox: {
      width: 43,
      height: 43,
      borderRadius: 12,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    upcomingDate: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 14,
    },

    upcomingMonth: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.bold,
      fontSize: 7,
      marginTop: 1,
    },

    upcomingInfo: {
      flex: 1,
      minWidth: 0,
    },

    upcomingLoan: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    upcomingMeta: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 8,
      marginTop: 3,
    },

    upcomingAmount: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
      marginLeft: 8,
    },

    /* ----------------------------------------------------------------------
       HEALTH
    ---------------------------------------------------------------------- */

    healthLayout: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 24,
      minHeight: 150,
    },

    healthCircle: {
      width: 126,
      height: 126,
      borderRadius: 70,
      backgroundColor:
        COLORS.greenSoft,
      borderWidth: 9,
      borderColor:
        '#D8F2E6',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    healthCircleInner: {
      alignItems:
        'center',
    },

    healthScoreValue: {
      color:
        COLORS.green,
      fontFamily:
        FONT.extraBold,
      fontSize: 26,
    },

    healthScoreLabel: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 8,
      marginTop: 1,
    },

    healthLegend: {
      flex: 1,
      gap: 12,
    },

    healthRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    healthLabel: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    healthDot: {
      width: 7,
      height: 7,
      borderRadius: 7,
      marginRight: 8,
    },

    healthText: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
    },

    healthValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    /* ----------------------------------------------------------------------
       INSIGHTS
    ---------------------------------------------------------------------- */

    insightGrid: {
      flexDirection:
        'row',
      gap: 13,
      marginBottom: 28,
    },

    insightCard: {
      flex: 1,
      minWidth: 230,
      padding: 16,
      borderRadius: 19,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,
      flexDirection:
        'row',
    },

    insightIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    insightIconText: {
      fontFamily:
        FONT.extraBold,
      fontSize: 16,
    },

    insightContent: {
      flex: 1,
    },

    insightTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    insightDescription: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },

    /* ----------------------------------------------------------------------
       TARGET
    ---------------------------------------------------------------------- */

    targetCard: {
      marginBottom: 28,
    },

    targetHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
      gap: 18,
    },

    targetHeaderContent: {
      flex: 1,
    },

    targetEyebrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 8,
      letterSpacing: 1.4,
    },

    targetTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.extraBold,
      fontSize: 21,
      lineHeight: 27,
      marginTop: 4,
    },

    targetSubtitle: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },

    targetStatus: {
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 99,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },

    targetStatusIcon: {
      fontFamily:
        FONT.extraBold,
      fontSize: 12,
    },

    targetStatusText: {
      fontFamily:
        FONT.bold,
      fontSize: 9,
    },

    targetMetrics: {
      flexDirection:
        'row',
      gap: 11,
      marginTop: 24,
    },

    targetMetric: {
      flex: 1,
      minWidth: 150,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        '#FAF9FC',
    },

    targetMetricLabel: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 8,
    },

    targetMetricValue: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 15,
      marginTop: 4,
    },

    targetBottom: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 15,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.line,
      marginTop: 16,
      paddingTop: 14,
    },

    targetBottomText: {
      flex: 1,
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      lineHeight: 14,
    },

    targetEmpty: {
      minHeight: 120,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 15,
    },

    targetEmptyIcon: {
      width: 55,
      height: 55,
      borderRadius: 18,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    targetEmptyIconText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.bold,
      fontSize: 22,
    },

    targetEmptyContent: {
      flex: 1,
    },

    targetEmptyTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 15,
    },

    targetEmptyText: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    /* ----------------------------------------------------------------------
       BUTTONS
    ---------------------------------------------------------------------- */

    primaryButton: {
      minHeight: 41,
      paddingHorizontal: 17,
      borderRadius: 13,
      backgroundColor:
        COLORS.purple,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    primaryButtonText: {
      color:
        COLORS.white,
      fontFamily:
        FONT.bold,
      fontSize: 10,
    },

    secondaryButton: {
      minHeight: 39,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor:
        COLORS.purpleSoft,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    secondaryButtonText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.bold,
      fontSize: 9,
    },

    secondaryButtonArrow: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.medium,
      fontSize: 14,
    },

    /* ----------------------------------------------------------------------
       RECENT PAYMENTS
    ---------------------------------------------------------------------- */

    recentCard: {
      marginBottom: 20,
    },

    recentPaymentRow: {
      minHeight: 63,
      borderRadius: 14,
      backgroundColor:
        '#FAF9FC',
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 7,
    },

    recentIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    recentIconText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.extraBold,
      fontSize: 14,
    },

    recentMain: {
      flex: 1,
      minWidth: 0,
    },

    recentTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    recentSub: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 8,
      marginTop: 3,
    },

    recentAmountBlock: {
      alignItems:
        'flex-end',
      marginLeft: 10,
    },

    recentAmount: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 11,
    },

    recentPrincipal: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 7,
      marginTop: 2,
    },

    /* ----------------------------------------------------------------------
       EMPTY
    ---------------------------------------------------------------------- */

    emptyState: {
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingVertical: 34,
    },

    emptyIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 10,
    },

    emptyIconText: {
      color:
        COLORS.purple,
      fontFamily:
        FONT.bold,
      fontSize: 19,
    },

    emptyTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 13,
    },

    emptyDescription: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 9,
      lineHeight: 14,
      textAlign:
        'center',
      maxWidth: 360,
      marginTop: 4,
    },

    /* ----------------------------------------------------------------------
       LOADING
    ---------------------------------------------------------------------- */

    loadingContainer: {
      flex: 1,
      backgroundColor:
        COLORS.background,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 30,
    },

    loadingOrb: {
      width: 68,
      height: 68,
      borderRadius: 23,
      backgroundColor:
        COLORS.purpleSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 18,
    },

    loadingTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 17,
    },

    loadingSubtitle: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 11,
      textAlign:
        'center',
      lineHeight: 16,
      marginTop: 6,
      maxWidth: 360,
    },

    /* ----------------------------------------------------------------------
       ERROR
    ---------------------------------------------------------------------- */

    errorCard: {
      width: '100%',
      maxWidth: 430,
      padding: 27,
      borderRadius: 23,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.line,
      alignItems:
        'center',
    },

    errorIconBox: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        COLORS.redSoft,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 13,
    },

    errorIcon: {
      color:
        COLORS.red,
      fontFamily:
        FONT.extraBold,
      fontSize: 21,
    },

    errorTitle: {
      color:
        COLORS.ink,
      fontFamily:
        FONT.bold,
      fontSize: 16,
    },

    errorText: {
      color:
        COLORS.muted,
      fontFamily:
        FONT.regular,
      fontSize: 10,
      lineHeight: 15,
      textAlign:
        'center',
      marginTop: 5,
      marginBottom: 18,
    },

    /* ----------------------------------------------------------------------
       FOOTER
    ---------------------------------------------------------------------- */

    footer: {
      alignItems:
        'center',
      paddingTop: 8,
    },

    footerText: {
      color:
        COLORS.subtle,
      fontFamily:
        FONT.regular,
      fontSize: 8,
    },
  });