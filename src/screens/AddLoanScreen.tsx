import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addLoan,
  updateLoan,
} from '../services/loanService';

import {
  calculateLoanPosition,
} from '../engine/loanPosition';

import {
  calculateEMI,
} from '../engine/emiCalculator';

import {
  Loan,
  LoanType,
  InterestType,
  LoanStatus,
  RepaymentType,
} from '../models/loan';

interface Props {
  loan?: Loan | null;

  onSaved?: () => void;

  onCancel?: () => void;
}

export default function AddLoanScreen({
  loan,
  onSaved,
  onCancel,
}: Props) {
  const isEditing =
    Boolean(
      loan?.id
    );

  /*
   * =====================================================
   * USER INPUT
   * =====================================================
   */

  const [
    lender,
    setLender,
  ] = useState('');

  const [
    loanName,
    setLoanName,
  ] = useState('');

  const [
    loanType,
    setLoanType,
  ] =
    useState<LoanType>(
      'OTHER'
    );

  const [
    repaymentType,
    setRepaymentType,
  ] =
    useState<RepaymentType>(
      'EMI'
    );

  const [
    principal,
    setPrincipal,
  ] = useState('');

  const [
    interestRate,
    setInterestRate,
  ] = useState('');

  const [
    interestType,
    setInterestType,
  ] =
    useState<InterestType>(
      'FIXED'
    );

  const [
    tenure,
    setTenure,
  ] = useState('');

  const [
    loanStartDate,
    setLoanStartDate,
  ] = useState('');

  const [
    firstEmiDate,
    setFirstEmiDate,
  ] = useState('');

  const [
    status,
    setStatus,
  ] =
    useState<LoanStatus>(
      'ACTIVE'
    );

  /*
   * =====================================================
   * STATE
   * =====================================================
   */

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    calculated,
    setCalculated,
  ] = useState(false);

  /*
   * =====================================================
   * LOAD EDIT DATA
   * =====================================================
   */

  useEffect(() => {
    if (loan) {
      setLender(
        loan.lender || ''
      );

      setLoanName(
        loan.loanName || ''
      );

      setLoanType(
        loan.loanType ||
          'OTHER'
      );

      setRepaymentType(
        loan.repaymentType ||
          'EMI'
      );

      setPrincipal(
        String(
          loan.originalPrincipal ??
            ''
        )
      );

      setInterestRate(
        String(
          loan.annualInterestRate ??
            ''
        )
      );

      setInterestType(
        loan.interestType ||
          'FIXED'
      );

      setTenure(
        String(
          loan.tenureMonths ??
            ''
        )
      );

      setLoanStartDate(
        normalizeDate(
          loan.loanStartDate
        )
      );

      setFirstEmiDate(
        normalizeDate(
          loan.firstEmiDate
        )
      );

      setStatus(
        loan.status ||
          'ACTIVE'
      );

      setCalculated(
        true
      );

      return;
    }

    /*
     * New loan defaults.
     */
    const today =
      getToday();

    setRepaymentType(
      'EMI'
    );

    setLoanStartDate(
      today
    );

    setFirstEmiDate(
      today
    );

    setStatus(
      'ACTIVE'
    );

    setCalculated(
      false
    );
  }, [
    loan,
  ]);

  /*
   * =====================================================
   * LIVE CALCULATION
   * =====================================================
   *
   * EMI:
   *   Uses the normal amortization calculator.
   *
   * INTEREST_ONLY:
   *   Principal is not amortized by the monthly payment.
   *   Monthly interest = outstanding × annual rate / 12.
   */
  const calculation =
    useMemo(() => {
      const principalValue =
        Number(principal);

      const rate =
        Number(interestRate);

      const enteredTenure =
        Number(tenure);

      /*
       * Interest-only loans do not need an EMI tenure
       * or first EMI date just to calculate/save the loan.
       *
       * If the user leaves these fields empty, use:
       *   - 12 months
       *   - loan start date (or today) as first interest date
       */
      const tenureValue =
        Number.isFinite(enteredTenure) &&
        enteredTenure > 0
          ? enteredTenure
          : repaymentType ===
            'INTEREST_ONLY'
            ? 12
            : 0;

      const effectiveFirstEmiDate =
        isValidDateString(firstEmiDate)
          ? firstEmiDate
          : repaymentType ===
            'INTEREST_ONLY'
            ? (
                isValidDateString(
                  loanStartDate
                )
                  ? loanStartDate
                  : getToday()
              )
            : '';

      if (
        !Number.isFinite(principalValue) ||
        principalValue <= 0
      ) {
        return null;
      }

      if (
        !Number.isFinite(rate) ||
        rate < 0
      ) {
        return null;
      }

      if (
        !Number.isFinite(tenureValue) ||
        tenureValue <= 0
      ) {
        return null;
      }

      if (
        !isValidDateString(
          effectiveFirstEmiDate
        )
      ) {
        return null;
      }

      try {
        /*
         * -------------------------------------------------
         * INTEREST ONLY
         * -------------------------------------------------
         */
        if (
          repaymentType ===
          'INTEREST_ONLY'
        ) {
          const monthlyInterest =
            roundMoney(
              principalValue *
                rate /
                12 /
                100
            );

          const calculatedLoan:
            Loan = {
            lender:
              lender.trim(),

            loanName:
              loanName.trim(),

            loanType,

            repaymentType:
              'INTEREST_ONLY',

            originalPrincipal:
              principalValue,

            currentOutstanding:
              principalValue,

            annualInterestRate:
              rate,

            interestType,

            emi: 0,

            monthlyInterest,

            tenureMonths:
              tenureValue,

            remainingMonths:
              tenureValue,

            loanStartDate,

            firstEmiDate:
              effectiveFirstEmiDate,

            maturityDate:
              addMonthsToDate(
                firstEmiDate,
                tenureValue - 1
              ),

            status,
          };

          const position =
            calculateLoanPosition(
              calculatedLoan,
              new Date()
            );

          return {
            emi: 0,

            monthlyInterest,

            position,
          };
        }

        /*
         * -------------------------------------------------
         * NORMAL EMI
         * -------------------------------------------------
         */
        const emiResult =
          calculateEMI({
            principal:
              principalValue,

            annualInterestRate:
              rate,

            tenureMonths:
              tenureValue,

            firstEmiDate:
              new Date(
                `${effectiveFirstEmiDate}T00:00:00`
              ),
          });

        const calculatedLoan:
          Loan = {
          lender:
            lender.trim(),

          loanName:
            loanName.trim(),

          loanType,

          repaymentType:
            'EMI',

          originalPrincipal:
            principalValue,

          currentOutstanding:
            principalValue,

          annualInterestRate:
            rate,

          interestType,

          emi:
            emiResult.emi,

          tenureMonths:
            tenureValue,

          remainingMonths:
            tenureValue,

          loanStartDate,

          firstEmiDate,

          status,
        };

        const position =
          calculateLoanPosition(
            calculatedLoan,
            new Date()
          );

        return {
          emi:
            emiResult.emi,

          monthlyInterest:
            0,

          position,
        };
      } catch {
        return null;
      }
    }, [
      principal,
      interestRate,
      tenure,
      firstEmiDate,
      lender,
      loanName,
      loanType,
      repaymentType,
      interestType,
      loanStartDate,
      status,
    ]);

  /*
   * =====================================================
   * CALCULATE BUTTON
   * =====================================================
   */

  function calculateLoan() {
    if (!calculation) {
      Alert.alert(
        'Incomplete Information',
        repaymentType ===
          'INTEREST_ONLY'
          ? 'Please enter a valid original loan amount and interest rate.'
          : 'Please enter valid loan amount, interest rate, tenure and first EMI date.'
      );

      return;
    }

    setCalculated(
      true
    );
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function saveLoan() {
  if (saving) {
    return;
  }

  try {
    /*
     * -------------------------------------------------------
     * BASIC VALIDATION
     * -------------------------------------------------------
     */

    const lenderValue = lender.trim();
    const loanNameValue = loanName.trim();

    if (!lenderValue) {
      Alert.alert(
        'Validation',
        'Please enter lender name.'
      );
      return;
    }

    if (!loanNameValue) {
      Alert.alert(
        'Validation',
        'Please enter loan name.'
      );
      return;
    }

    const principalValue =
      Number(principal);

    const rateValue =
      Number(interestRate);

    const enteredTenure =
      Number(tenure);

    /*
     * Interest-only loans can be created with only
     * principal + rate (apart from lender/name).
     *
     * We use a 12-month period and the loan start date
     * as the first interest date when those fields are
     * not supplied.
     */
    const tenureValue =
      Number.isFinite(enteredTenure) &&
      enteredTenure > 0
        ? enteredTenure
        : repaymentType ===
          'INTEREST_ONLY'
          ? 12
          : 0;

    const effectiveFirstEmiDate =
      isValidDateString(firstEmiDate)
        ? firstEmiDate
        : repaymentType ===
          'INTEREST_ONLY'
          ? (
              isValidDateString(
                loanStartDate
              )
                ? loanStartDate
                : getToday()
            )
          : '';

    if (
      !Number.isFinite(principalValue) ||
      principalValue <= 0
    ) {
      Alert.alert(
        'Validation',
        'Please enter a valid original loan amount.'
      );
      return;
    }

    if (
      !Number.isFinite(rateValue) ||
      rateValue < 0
    ) {
      Alert.alert(
        'Validation',
        'Please enter a valid interest rate.'
      );
      return;
    }

    if (
      repaymentType !==
      'INTEREST_ONLY' &&
      (
        !Number.isFinite(
          tenureValue
        ) ||
        tenureValue <= 0
      )
    ) {
      Alert.alert(
        'Validation',
        'Please enter a valid loan tenure.'
      );
      return;
    }

    if (!isValidDateString(loanStartDate)) {
      Alert.alert(
        'Validation',
        'Please enter a valid loan start date.'
      );
      return;
    }

    if (
      repaymentType !==
      'INTEREST_ONLY' &&
      !isValidDateString(
        effectiveFirstEmiDate
      )
    ) {
      Alert.alert(
        'Validation',
        'Please enter a valid first EMI date.'
      );
      return;
    }

    /*
     * -------------------------------------------------------
     * CALCULATE REPAYMENT VALUES
     * -------------------------------------------------------
     */

    let emi = 0;
    let monthlyInterest = 0;

    if (
      repaymentType ===
      'INTEREST_ONLY'
    ) {
      monthlyInterest =
        roundMoney(
          principalValue *
            rateValue /
            12 /
            100
        );

      console.log(
        '[LOAN SAVE] Interest-only monthly interest:',
        monthlyInterest
      );
    } else {
      const emiResult =
        calculateEMI({
          principal:
            principalValue,

          annualInterestRate:
            rateValue,

          tenureMonths:
            tenureValue,

          firstEmiDate:
            new Date(
              `${effectiveFirstEmiDate}T00:00:00`
            ),
        });

      emi =
        emiResult.emi;

      console.log(
        '[LOAN SAVE] EMI calculated:',
        emi
      );
    }

    /*
     * -------------------------------------------------------
     * NEW / UPDATED LOAN OBJECT
     * -------------------------------------------------------
     *
     * A newly created loan has NOT had any payment recorded.
     * Therefore outstanding initially equals original principal.
     *
     * For INTEREST_ONLY:
     *   - EMI is zero.
     *   - monthlyInterest stores the expected monthly interest.
     *   - Principal is not reduced by scheduled interest payments.
     */

    const loanData: Loan = {
      lender: lenderValue,
      loanName: loanNameValue,

      loanType,

      repaymentType,

      originalPrincipal:
        principalValue,

      currentOutstanding:
        principalValue,

      annualInterestRate:
        rateValue,

      interestType,

      emi,

      monthlyInterest:
        repaymentType ===
        'INTEREST_ONLY'
          ? monthlyInterest
          : undefined,

      tenureMonths:
        tenureValue,

      remainingMonths:
        tenureValue,

      loanStartDate,

      firstEmiDate:
        effectiveFirstEmiDate,

      maturityDate:
        repaymentType ===
        'INTEREST_ONLY'
          ? addMonthsToDate(
              firstEmiDate,
              tenureValue - 1
            )
          : undefined,

      status,
    };

    console.log(
      '[LOAN SAVE] Prepared loan:',
      loanData
    );

    /*
     * -------------------------------------------------------
     * SAVE
     * -------------------------------------------------------
     */

    setSaving(true);

    if (!isEditing) {
      console.log(
        '[LOAN SAVE] Calling addLoan()...'
      );

      const loanId =
        await addLoan(loanData);

      console.log(
        '[LOAN SAVE] Firestore loan created:',
        loanId
      );

      Alert.alert(
        'Loan Added',
        'Your loan has been added successfully.'
      );
    }

    /*
     * -------------------------------------------------------
     * UPDATE EXISTING LOAN
     * -------------------------------------------------------
     */

    else if (loan?.id) {
      console.log(
        '[LOAN SAVE] Updating loan:',
        loan.id
      );

      await updateLoan(
        loan.id,
        {
          lender: lenderValue,
          loanName: loanNameValue,

          loanType,

          repaymentType,

          originalPrincipal:
            principalValue,

          annualInterestRate:
            rateValue,

          interestType,

          emi,

          monthlyInterest:
            repaymentType ===
            'INTEREST_ONLY'
              ? monthlyInterest
              : undefined,

          maturityDate:
            repaymentType ===
            'INTEREST_ONLY'
              ? addMonthsToDate(
                  firstEmiDate,
                  tenureValue - 1
                )
              : undefined,

          tenureMonths:
            tenureValue,

          loanStartDate,

          firstEmiDate,

          status,
        }
      );

      Alert.alert(
        'Loan Updated',
        'Your loan has been updated successfully.'
      );
    }

    /*
     * -------------------------------------------------------
     * RETURN TO LOANS SCREEN
     * -------------------------------------------------------
     */

    onSaved?.();

  } catch (error) {
    console.error(
      '[LOAN SAVE] FAILED:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      '[LOAN SAVE] ERROR MESSAGE:',
      message
    );

    Alert.alert(
      'Unable to Save Loan',
      message
    );

  } finally {
    setSaving(false);
  }
}

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      {/* HEADER */}

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
            {isEditing
              ? 'Edit Loan'
              : 'Add New Loan'}
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            {isEditing
              ? 'Update your original loan information'
              : 'Enter your loan details and we will calculate the rest'}
          </Text>
        </View>

        {onCancel && (
          <Pressable
            onPress={
              onCancel
            }
            style={
              styles.cancelButton
            }
          >
            <Text
              style={
                styles.cancelText
              }
            >
              Cancel
            </Text>
          </Pressable>
        )}
      </View>

      {/* FORM */}

      <View
        style={
          styles.formCard
        }
      >
        <Text style={styles.formEyebrow}>
          LOAN PROFILE
        </Text>
        <Text
          style={
            styles.sectionTitle
          }
        >
          Loan Information
        </Text>

        <Field
          label="Lender"
          value={
            lender
          }
          onChangeText={
            setLender
          }
          placeholder="HDFC Bank"
        />

        <Field
          label="Loan Name"
          value={
            loanName
          }
          onChangeText={
            setLoanName
          }
          placeholder="Home Loan"
        />

        {/* LOAN TYPE */}

        <Text
          style={
            styles.label
          }
        >
          Loan Type
        </Text>

        <View
          style={
            styles.optionGrid
          }
        >
          {[
            [
              'HOME_LOAN',
              'Home Loan',
            ],
            [
              'VEHICLE_LOAN',
              'Vehicle Loan',
            ],
            [
              'PERSONAL_LOAN',
              'Personal Loan',
            ],
            [
              'BUSINESS_LOAN',
              'Business Loan',
            ],
            [
              'GOLD_LOAN',
              'Gold Loan',
            ],
            [
              'OTHER',
              'Other',
            ],
          ].map(
            ([
              value,
              label,
            ]) => (
              <OptionButton
                key={
                  value
                }
                label={
                  label
                }
                selected={
                  loanType ===
                  value
                }
                onPress={() =>
                  setLoanType(
                    value as LoanType
                  )
                }
              />
            )
          )}
        </View>

        {/* =====================================================
            REPAYMENT TYPE
           ===================================================== */}

        <Text
          style={
            styles.label
          }
        >
          Repayment Type
        </Text>

        <View
          style={
            styles.inlineOptions
          }
        >
          <OptionButton
            label="EMI"
            selected={
              repaymentType ===
              'EMI'
            }
            onPress={() =>
              setRepaymentType(
                'EMI'
              )
            }
          />

          <OptionButton
            label="Interest Only"
            selected={
              repaymentType ===
              'INTEREST_ONLY'
            }
            onPress={() =>
              setRepaymentType(
                'INTEREST_ONLY'
              )
            }
          />
        </View>

        <Text
          style={
            styles.helper
          }
        >
          {repaymentType ===
          'INTEREST_ONLY'
            ? 'Monthly payment is interest only. Principal reduces only when a principal payment is recorded.'
            : 'Each EMI contains both principal and interest.'}
        </Text>

        {/* FINANCIAL INPUTS */}

        <View
          style={
            styles.twoColumn
          }
        >
          <View
            style={
              styles.column
            }
          >
            <Field
              label="Original Loan Amount"
              value={
                principal
              }
              onChangeText={
                setPrincipal
              }
              placeholder="2000000"
              keyboardType="numeric"
            />

            <Text
              style={
                styles.helper
              }
            >
              Amount originally borrowed.
            </Text>
          </View>

          <View
            style={
              styles.column
            }
          >
            <Field
              label="Annual Interest Rate"
              value={
                interestRate
              }
              onChangeText={
                setInterestRate
              }
              placeholder="8.50"
              keyboardType="decimal-pad"
            />

            <Text
              style={
                styles.helper
              }
            >
              Enter the current applicable rate.
            </Text>
          </View>
        </View>

        {/* INTEREST TYPE */}

        <Text
          style={
            styles.label
          }
        >
          Interest Type
        </Text>

        <View
          style={
            styles.inlineOptions
          }
        >
          <OptionButton
            label="Fixed"
            selected={
              interestType ===
              'FIXED'
            }
            onPress={() =>
              setInterestType(
                'FIXED'
              )
            }
          />

          <OptionButton
            label="Floating"
            selected={
              interestType ===
              'FLOATING'
            }
            onPress={() =>
              setInterestType(
                'FLOATING'
              )
            }
          />
        </View>

        {/* TENURE */}

        <Field
          label="Total Loan Tenure"
          value={
            tenure
          }
          onChangeText={
            setTenure
          }
          placeholder="240"
          keyboardType="numeric"
        />

        <Text
          style={
            styles.helper
          }
        >
          {repaymentType ===
          'INTEREST_ONLY'
            ? 'Optional for Interest Only. Defaults to 12 months if left blank.'
            : 'Enter the original tenure in months.'}
        </Text>

        {/* DATES */}

        <View
          style={
            styles.twoColumn
          }
        >
          <View
            style={
              styles.column
            }
          >
            <Field
              label="Loan Start Date"
              value={
                loanStartDate
              }
              onChangeText={
                setLoanStartDate
              }
              placeholder="2024-04-10"
            />
          </View>

          <View
            style={
              styles.column
            }
          >
            <Field
              label={
                repaymentType ===
                'INTEREST_ONLY'
                  ? 'First Interest Date'
                  : 'First EMI Date'
              }
              value={
                firstEmiDate
              }
              onChangeText={
                setFirstEmiDate
              }
              placeholder="2024-05-05"
            />
          </View>
        </View>

        <Text
          style={
            styles.helper
          }
        >
          {repaymentType ===
          'INTEREST_ONLY'
            ? 'For Interest Only, this is the first monthly interest date. If left blank, loan start date is used.'
            : 'Use YYYY-MM-DD format.'}
        </Text>
      </View>

      {/* AUTOMATIC CALCULATION */}

      <View
        style={
          styles.calculatedCard
        }
      >
        <View>
          <Text
            style={
              styles.calculatedTitle
            }
          >
            Automatically Calculated
          </Text>

          <Text
            style={
              styles.calculatedSubtitle
            }
          >
            Based on today's date and scheduled EMI payments
          </Text>
        </View>

        {calculation ? (
          <>
            <View
              style={
                styles.calculatedGrid
              }
            >
              <CalculatedItem
                label={
                  repaymentType ===
                  'INTEREST_ONLY'
                    ? 'Monthly Interest'
                    : 'Monthly EMI'
                }
                value={
                  formatCurrency(
                    repaymentType ===
                    'INTEREST_ONLY'
                      ? calculation.monthlyInterest
                      : calculation.emi
                  )
                }
              />

              <CalculatedItem
                label="Current Outstanding"
                value={
                  formatCurrency(
                    calculation
                      .position
                      .currentOutstanding
                  )
                }
                accent
              />

              <CalculatedItem
                label="Principal Paid"
                value={
                  formatCurrency(
                    calculation
                      .position
                      .principalPaid
                  )
                }
              />

              <CalculatedItem
                label="Interest Paid"
                value={
                  formatCurrency(
                    calculation
                      .position
                      .interestPaid
                  )
                }
              />

              <CalculatedItem
                label="Installments Due"
                value={`${calculation.position.installmentsDue}`}
              />

              <CalculatedItem
                label="Remaining Tenure"
                value={`${calculation.position.remainingMonths} months`}
              />

              <CalculatedItem
                label="Next EMI"
                value={
                  calculation
                    .position
                    .nextEmiDate
                    ? formatDate(
                        calculation
                          .position
                          .nextEmiDate!
                      )
                    : 'Completed'
                }
              />

              <CalculatedItem
                label="Maturity Date"
                value={
                  calculation
                    .position
                    .maturityDate
                    ? formatDate(
                        calculation
                          .position
                          .maturityDate!
                      )
                    : '—'
                }
              />
            </View>

            <View
              style={
                styles.assumption
              }
            >
              <Text
                style={
                  styles.assumptionIcon
                }
              >
                ✓
              </Text>

              <Text
                style={
                  styles.assumptionText
                }
              >
                {repaymentType ===
                'INTEREST_ONLY'
                  ? 'Interest-only loans keep principal unchanged unless a principal payment is recorded.'
                  : 'The system assumes all scheduled EMIs up to today have already been paid.'}
              </Text>
            </View>
          </>
        ) : (
          <View
            style={
              styles.calculationEmpty
            }
          >
            <Text
              style={
                styles.calculationEmptyText
              }
            >
              Enter the loan amount, interest rate, tenure and first EMI date to see the calculation.
            </Text>
          </View>
        )}
      </View>

      {/* RECALCULATE */}

      <Pressable
        style={
          styles.calculateButton
        }
        onPress={
          calculateLoan
        }
      >
        <Text
          style={
            styles.calculateButtonText
          }
        >
          Recalculate
        </Text>
      </Pressable>

      {/* STATUS */}

      {isEditing && (
        <View
          style={
            styles.statusCard
          }
        >
          <Text
            style={
              styles.label
            }
          >
            Loan Status
          </Text>

          <View
            style={
              styles.inlineOptions
            }
          >
            <OptionButton
              label="Active"
              selected={
                status ===
                'ACTIVE'
              }
              onPress={() =>
                setStatus(
                  'ACTIVE'
                )
              }
            />

            <OptionButton
              label="Paused"
              selected={
                status ===
                'PAUSED'
              }
              onPress={() =>
                setStatus(
                  'PAUSED'
                )
              }
            />

            <OptionButton
              label="Closed"
              selected={
                status ===
                'CLOSED'
              }
              onPress={() =>
                setStatus(
                  'CLOSED'
                )
              }
            />
          </View>
        </View>
      )}

      {/* SAVE */}

      <Pressable
        style={[
          styles.saveButton,
          saving &&
            styles.saveButtonDisabled,
        ]}
        onPress={
          saveLoan
        }
        disabled={
          saving
        }
      >
        {saving ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text
            style={
              styles.saveButtonText
            }
          >
            {isEditing
              ? 'Save Changes'
              : 'Add Loan'}
          </Text>
        )}
      </Pressable>

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
 * FIELD
 * =========================================================
 */

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (
    value: string
  ) => void;
  placeholder?: string;
  keyboardType?:
    | 'default'
    | 'numeric'
    | 'decimal-pad';
}) {
  return (
    <View
      style={
        styles.fieldContainer
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <TextInput
        style={
          styles.input
        }
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor="#94A39A"
        keyboardType={
          keyboardType ||
          'default'
        }
      />
    </View>
  );
}

/*
 * =========================================================
 * OPTION BUTTON
 * =========================================================
 */

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.optionButton,
        selected &&
          styles.optionButtonSelected,
      ]}
      onPress={
        onPress
      }
    >
      <Text
        style={[
          styles.optionText,
          selected &&
            styles.optionTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/*
 * =========================================================
 * CALCULATED ITEM
 * =========================================================
 */

function CalculatedItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View
      style={
        styles.calculatedItem
      }
    >
      <Text
        style={
          styles.calculatedLabel
        }
      >
        {label}
      </Text>

      <Text
        style={[
          styles.calculatedValue,
          accent &&
            styles.calculatedValueAccent,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getToday(): string {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeDate(
  value?: string
): string {
  if (!value) {
    return '';
  }

  return value.substring(
    0,
    10
  );
}

function isValidDateString(
  value: string
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return (
    date.getFullYear() ===
      year &&
    date.getMonth() ===
      month - 1 &&
    date.getDate() ===
      day
  );
}

function roundMoney(
  value: number
): number {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function addMonthsToDate(
  value: string,
  months: number
): string {
  const parts =
    value.substring(0, 10)
      .split('-')
      .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      part => !Number.isFinite(part)
    )
  ) {
    return value.substring(0, 10);
  }

  const date =
    new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );

  date.setDate(1);
  date.setMonth(
    date.getMonth() + months
  );

  const lastDay =
    new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate();

  /*
   * For the maturity date we preserve the
   * original day of the first EMI date.
   */
  const originalDay =
    parts[2];

  date.setDate(
    Math.min(
      originalDay,
      lastDay
    )
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatCurrency(
  value: number
): string {
  return `₹${Number(
    value
  ).toLocaleString(
    'en-IN',
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

function formatDate(
  value: string
): string {
  const [
    year,
    month,
    day,
  ] =
    value
      .substring(
        0,
        10
      )
      .split('-')
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
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

    content: {
      width: '100%',
      maxWidth: 1180,
      alignSelf: 'center',
      paddingHorizontal: 28,
      paddingTop: 24,
      paddingBottom: 56,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },

    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 35,
      color: '#172033',
      letterSpacing: -0.6,
    },

    subtitle: {
      marginTop: 6,
      maxWidth: 650,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 19,
      color: '#6B7890',
    },

    cancelButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E0E6F0',
    },

    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#4F5D73',
    },

    formCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E3E8F1',
      borderRadius: 18,
      padding: 24,
      shadowColor: '#1D2A44',
      shadowOpacity: 0.05,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },

    formEyebrow: {
      marginBottom: 6,
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 1.1,
      color: '#356DFF',
    },

    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#172033',
      marginBottom: 4,
      letterSpacing: -0.2,
    },

    fieldContainer: {
      marginTop: 16,
      flex: 1,
    },

    label: {
      marginBottom: 7,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#46546B',
    },

    input: {
      height: 46,
      borderWidth: 1,
      borderColor: '#DCE3EE',
      borderRadius: 11,
      paddingHorizontal: 14,
      backgroundColor: '#FBFCFE',
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: '#172033',
    },

    helper: {
      marginTop: 6,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 15,
      color: '#8793A6',
    },

    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
      marginBottom: 4,
    },

    inlineOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },

    optionButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: '#DCE3EE',
      backgroundColor: '#FAFBFD',
    },

    optionButtonSelected: {
      backgroundColor: '#EAF0FF',
      borderColor: '#AFC3FF',
    },

    optionText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#68758A',
    },

    optionTextSelected: {
      color: '#356DFF',
    },

    twoColumn: {
      flexDirection: 'row',
      gap: 18,
    },

    column: {
      flex: 1,
    },

    calculatedCard: {
      marginTop: 18,
      backgroundColor: '#F3F6FF',
      borderWidth: 1,
      borderColor: '#CFDAFF',
      borderRadius: 18,
      padding: 22,
    },

    calculatedTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#274DBB',
      letterSpacing: -0.2,
    },

    calculatedSubtitle: {
      marginTop: 4,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 16,
      color: '#6F7D96',
    },

    calculatedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 18,
      gap: 1,
    },

    calculatedItem: {
      width: '25%',
      minWidth: 170,
      paddingVertical: 13,
      paddingRight: 15,
    },

    calculatedLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: '#7A879C',
    },

    calculatedValue: {
      marginTop: 5,
      fontFamily: 'Inter_700Bold',
      fontSize: 20,
      color: '#1D2940',
    },

    calculatedValueAccent: {
      color: '#356DFF',
    },

    assumption: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      padding: 11,
      borderRadius: 11,
      backgroundColor: '#EAF0FF',
    },

    assumptionIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#356DFF',
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 22,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      marginRight: 9,
    },

    assumptionText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 15,
      color: '#536585',
    },

    calculationEmpty: {
      marginTop: 18,
      padding: 16,
      borderRadius: 11,
      backgroundColor: '#F5F7FB',
      borderWidth: 1,
      borderColor: '#E6EAF1',
    },

    calculationEmptyText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 17,
      color: '#748198',
    },

    calculateButton: {
      marginTop: 16,
      paddingVertical: 13,
      borderRadius: 11,
      alignItems: 'center',
      backgroundColor: '#EAF0FF',
      borderWidth: 1,
      borderColor: '#C9D7FF',
    },

    calculateButtonText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: '#356DFF',
    },

    statusCard: {
      marginTop: 16,
      padding: 20,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E3E8F1',
    },

    saveButton: {
      marginTop: 18,
      minHeight: 52,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#356DFF',
      shadowColor: '#356DFF',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },

    saveButtonDisabled: {
      opacity: 0.62,
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
    },

    bottomSpace: {
      height: 30,
    },
  });

