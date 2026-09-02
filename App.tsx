import React from 'react';

import RecordPaymentScreen from './src/screens/RecordPaymentScreen';

import { Loan } from './src/models/loan';
const testLoan: Loan = {
  id: 'ZNvoDX9Qih8yb1lDFeWq',

  lender: 'HDFC Bank',
  loanName: 'Home Loan',
  loanType: 'HOME_LOAN',

  originalPrincipal: 1000000,
  currentOutstanding: 1000000,

  annualInterestRate: 8.5,
  interestType: 'FIXED',

  emi: 12398,

  tenureMonths: 120,
  remainingMonths: 120,

  loanStartDate: '2026-08-30',
  firstEmiDate: '2026-09-05',

  status: 'ACTIVE',
};

export default function App() {
  return (
    <RecordPaymentScreen
      loan={testLoan}
    />
  );
}