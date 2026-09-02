import { Loan } from '../models/loan';
import {
  TargetAnalysis,
} from './debtForecast';

export type InsightSeverity =
  | 'HIGH'
  | 'MEDIUM'
  | 'POSITIVE';

export interface FinancialInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendation: string;
}

export function generateFinancialInsights(
  loans: Loan[],
  targetAnalysis: TargetAnalysis | null
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];

  const activeLoans = loans.filter(
    (loan) =>
      loan.status === 'ACTIVE'
  );

  /*
   * 1. Highest interest loan
   */
  if (activeLoans.length > 0) {
    const highestInterestLoan =
      [...activeLoans].sort(
        (a, b) =>
          Number(
            b.annualInterestRate
          ) -
          Number(
            a.annualInterestRate
          )
      )[0];

    const interestRate =
      Number(
        highestInterestLoan.annualInterestRate
      );

    if (interestRate >= 10) {
      insights.push({
        id: 'high-interest-loan',
        severity: 'HIGH',

        title:
          'High-interest loan needs attention',

        message:
          `${highestInterestLoan.loanName} is currently at ${interestRate}% interest.`,

        recommendation:
          'Consider directing additional principal payments toward this loan first, subject to your loan terms.',
      });
    } else if (interestRate >= 8) {
      insights.push({
        id: 'moderate-interest-loan',
        severity: 'MEDIUM',

        title:
          'Review your highest-interest loan',

        message:
          `${highestInterestLoan.loanName} has the highest interest rate among your active loans.`,

        recommendation:
          'When you have surplus cash available, compare the benefit of making additional principal payments on this loan.',
      });
    }
  }

  /*
   * 2. Target performance
   */
  if (targetAnalysis) {
    if (
      targetAnalysis.status ===
      'BEHIND'
    ) {
      insights.push({
        id: 'target-behind',
        severity: 'HIGH',

        title:
          'Debt-free target is at risk',

        message:
          `Your current trajectory is behind the selected debt-free target.`,

        recommendation:
          `You need approximately ₹${Math.round(
            targetAnalysis.requiredExtraMonthlyPayment
          ).toLocaleString(
            'en-IN'
          )} additional principal reduction per month to reach the target.`,
      });
    }

    if (
      targetAnalysis.status ===
      'ON_TRACK'
    ) {
      insights.push({
        id: 'target-on-track',
        severity: 'POSITIVE',

        title:
          'You are on track',

        message:
          'Your projected debt-free date is aligned with your target.',

        recommendation:
          'Maintain your current repayment discipline and continue monitoring your progress.',
      });
    }

    if (
      targetAnalysis.status ===
      'AHEAD'
    ) {
      insights.push({
        id: 'target-ahead',
        severity: 'POSITIVE',

        title:
          'You are ahead of target',

        message:
          'Your current repayment trajectory reaches debt freedom before your target date.',

        recommendation:
          'Keep the current repayment pace. You may also evaluate whether accelerating high-interest debt makes sense.',
      });
    }
  }

  /*
   * 3. Large monthly EMI burden
   */
  const totalEMI =
    activeLoans.reduce(
      (sum, loan) =>
        sum +
        Number(
          loan.emi || 0
        ),
      0
    );

  if (
    activeLoans.length >= 3
  ) {
    insights.push({
      id: 'multiple-loans',
      severity: 'MEDIUM',

      title:
        'Multiple active loans',

      message:
        `You currently have ${activeLoans.length} active loans.`,

      recommendation:
        'Review whether consolidating or prioritizing specific loans could reduce total interest and simplify repayment.',
    });
  }

  /*
   * 4. No loans
   */
  if (
    activeLoans.length === 0
  ) {
    insights.push({
      id: 'no-active-loans',
      severity: 'POSITIVE',

      title:
        'No active debt',

      message:
        'You currently have no active loans.',

      recommendation:
        'Continue maintaining your financial position and review your savings and investment goals.',
    });
  }

  /*
   * Prevent unused-variable issues while
   * retaining total EMI for future rules.
   */
  void totalEMI;

  return insights;
}