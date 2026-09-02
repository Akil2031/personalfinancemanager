export interface EMICalculatorInput {
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  firstEmiDate: Date;
}

export interface EMIScheduleRow {
  installmentNo: number;
  dueDate: Date;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

export interface EMICalculatorResult {
  emi: number;
  totalPrincipal: number;
  totalInterest: number;
  totalPayment: number;
  maturityDate: Date;
  schedule: EMIScheduleRow[];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);

  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDayOfMonth));

  return result;
}

export function calculateEMI(
  input: EMICalculatorInput
): EMICalculatorResult {
  const {
    principal,
    annualInterestRate,
    tenureMonths,
    firstEmiDate,
  } = input;

  if (principal <= 0) {
    throw new Error('Principal must be greater than zero.');
  }

  if (tenureMonths <= 0) {
    throw new Error('Tenure must be greater than zero.');
  }

  if (annualInterestRate < 0) {
    throw new Error('Interest rate cannot be negative.');
  }

  const monthlyRate =
    annualInterestRate / 12 / 100;

  let emi: number;

  if (monthlyRate === 0) {
    emi = principal / tenureMonths;
  } else {
    emi =
      (principal *
        monthlyRate *
        Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  }

  emi = roundMoney(emi);

  const schedule: EMIScheduleRow[] = [];

  let openingBalance =
    roundMoney(principal);

  for (let i = 1; i <= tenureMonths; i++) {
    const dueDate =
      addMonths(firstEmiDate, i - 1);

    const interest =
      roundMoney(
        openingBalance * monthlyRate
      );

    let principalComponent =
      roundMoney(
        emi - interest
      );

    let actualEmi =
      emi;

    /*
     * Adjust the final installment so that the
     * outstanding balance becomes exactly zero.
     */
    if (i === tenureMonths) {
      principalComponent =
        openingBalance;

      actualEmi =
        roundMoney(
          principalComponent +
            interest
        );
    }

    /*
     * Protect against floating point rounding.
     */
    if (
      principalComponent >
      openingBalance
    ) {
      principalComponent =
        openingBalance;

      actualEmi =
        roundMoney(
          principalComponent +
            interest
        );
    }

    const closingBalance =
      roundMoney(
        Math.max(
          0,
          openingBalance -
            principalComponent
        )
      );

    schedule.push({
      installmentNo: i,
      dueDate,
      openingBalance,
      emi: actualEmi,
      principal:
        roundMoney(
          principalComponent
        ),
      interest,
      closingBalance,
    });

    openingBalance =
      closingBalance;
  }

  const totalPrincipal =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum + row.principal,
        0
      )
    );

  const totalInterest =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum + row.interest,
        0
      )
    );

  const totalPayment =
    roundMoney(
      totalPrincipal +
        totalInterest
    );

  const maturityDate =
    schedule[
      schedule.length - 1
    ].dueDate;

  return {
    emi,
    totalPrincipal,
    totalInterest,
    totalPayment,
    maturityDate,
    schedule,
  };
}

/*
 * =========================================================
 * REMAINING / ADJUSTED LOAN SCHEDULE
 * =========================================================
 *
 * Used after automatic EMI payments and additional
 * principal-only PARTIAL / PREPAYMENT payments.
 */
export interface RemainingEMICalculatorInput {
  principal: number;
  annualInterestRate: number;
  emi: number;
  firstEmiDate: Date;
  startingInstallmentNo: number;
  maxMonths?: number;
}

export function calculateRemainingEMI(
  input: RemainingEMICalculatorInput
): EMICalculatorResult {
  const {
    principal,
    annualInterestRate,
    emi: requestedEmi,
    firstEmiDate,
    startingInstallmentNo,
    maxMonths = 600,
  } = input;

  if (principal <= 0) {
    throw new Error(
      'Principal must be greater than zero.'
    );
  }

  if (annualInterestRate < 0) {
    throw new Error(
      'Interest rate cannot be negative.'
    );
  }

  const monthlyRate =
    annualInterestRate / 12 / 100;

  let emi =
    Number(requestedEmi) || 0;

  /*
   * Normally the stored EMI is used so that a part
   * payment reduces the tenure while keeping EMI same.
   *
   * If EMI is missing, calculate an EMI over a sensible
   * 12-month starting period. In normal app usage the
   * stored EMI will always be present.
   */
  if (
    !Number.isFinite(emi) ||
    emi <= 0
  ) {
    const fallbackMonths = 12;

    if (monthlyRate === 0) {
      emi =
        principal /
        fallbackMonths;
    } else {
      emi =
        (principal *
          monthlyRate *
          Math.pow(
            1 + monthlyRate,
            fallbackMonths
          )) /
        (
          Math.pow(
            1 + monthlyRate,
            fallbackMonths
          ) - 1
        );
    }
  }

  emi =
    roundMoney(emi);

  const schedule: EMIScheduleRow[] = [];

  let openingBalance =
    roundMoney(principal);

  let installmentNo =
    startingInstallmentNo;

  for (
    let i = 0;
    i < maxMonths &&
    openingBalance > 0;
    i++
  ) {
    const dueDate =
      addMonths(
        firstEmiDate,
        i
      );

    const interest =
      roundMoney(
        openingBalance *
          monthlyRate
      );

    /*
     * If EMI is not enough to cover interest,
     * the schedule cannot amortize.
     */
    if (
      monthlyRate > 0 &&
      emi <= interest
    ) {
      throw new Error(
        'EMI is too low to reduce the outstanding principal.'
      );
    }

    let principalComponent =
      roundMoney(
        emi - interest
      );

    let actualEmi =
      emi;

    /*
     * Final installment.
     */
    if (
      principalComponent >=
      openingBalance
    ) {
      principalComponent =
        openingBalance;

      actualEmi =
        roundMoney(
          principalComponent +
            interest
        );
    }

    const closingBalance =
      roundMoney(
        Math.max(
          0,
          openingBalance -
            principalComponent
        )
      );

    schedule.push({
      installmentNo,

      dueDate,

      openingBalance,

      emi:
        actualEmi,

      principal:
        roundMoney(
          principalComponent
        ),

      interest,

      closingBalance,
    });

    openingBalance =
      closingBalance;

    installmentNo++;
  }

  const totalPrincipal =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum + row.principal,
        0
      )
    );

  const totalInterest =
    roundMoney(
      schedule.reduce(
        (sum, row) =>
          sum + row.interest,
        0
      )
    );

  const totalPayment =
    roundMoney(
      totalPrincipal +
        totalInterest
    );

  const maturityDate =
    schedule.length > 0
      ? schedule[
          schedule.length - 1
        ].dueDate
      : firstEmiDate;

  return {
    emi,

    totalPrincipal,

    totalInterest,

    totalPayment,

    maturityDate,

    schedule,
  };
}
