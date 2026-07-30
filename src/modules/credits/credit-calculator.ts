import { Decimal } from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ScheduleEntry {
  monthNumber: number;
  paymentDate: Date;
  principalAmount: string;
  interestAmount: string;
  totalPayment: string;
  remainingDebt: string;
}

export interface CreditCalculation {
  monthlyPayment: string;
  totalInterest: string;
  totalPayment: string;
  schedule: ScheduleEntry[];
}

export function calculateAnnuitySchedule(
  totalAmount: string,
  interestRate: string,
  termMonths: number,
  startDate: Date,
): CreditCalculation {
  const principal = new Decimal(totalAmount);
  const annualRate = new Decimal(interestRate).div(100);
  const monthlyRate = annualRate.div(12);

  let monthlyPayment: Decimal;

  if (monthlyRate.isZero()) {
    monthlyPayment = principal.div(termMonths);
  } else {
    const factor = monthlyRate
      .plus(1)
      .pow(termMonths);
    monthlyPayment = principal
      .times(monthlyRate)
      .times(factor)
      .div(factor.minus(1));
  }

  monthlyPayment = monthlyPayment.toDecimalPlaces(2);

  let remainingDebt = principal;
  const schedule: ScheduleEntry[] = [];
  let totalInterest = new Decimal(0);

  for (let month = 1; month <= termMonths; month++) {
    const interestPayment = remainingDebt.times(monthlyRate).toDecimalPlaces(2);
    let principalPayment = monthlyPayment.minus(interestPayment).toDecimalPlaces(2);

    if (month === termMonths) {
      principalPayment = remainingDebt.toDecimalPlaces(2);
    }

    remainingDebt = remainingDebt.minus(principalPayment).toDecimalPlaces(2);
    if (remainingDebt.isNegative()) {
      remainingDebt = new Decimal(0);
    }

    totalInterest = totalInterest.plus(interestPayment);

    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + month);

    schedule.push({
      monthNumber: month,
      paymentDate,
      principalAmount: principalPayment.toFixed(2),
      interestAmount: interestPayment.toFixed(2),
      totalPayment: monthlyPayment.toFixed(2),
      remainingDebt: remainingDebt.toFixed(2),
    });
  }

  return {
    monthlyPayment: monthlyPayment.toFixed(2),
    totalInterest: totalInterest.toFixed(2),
    totalPayment: principal.plus(totalInterest).toFixed(2),
    schedule,
  };
}

export function calculateDifferentialSchedule(
  totalAmount: string,
  interestRate: string,
  termMonths: number,
  startDate: Date,
): CreditCalculation {
  const principal = new Decimal(totalAmount);
  const annualRate = new Decimal(interestRate).div(100);
  const monthlyRate = annualRate.div(12);
  const monthlyPrincipal = principal.div(termMonths).toDecimalPlaces(2);

  let remainingDebt = principal;
  const schedule: ScheduleEntry[] = [];
  let totalInterest = new Decimal(0);
  let totalPayment = new Decimal(0);

  for (let month = 1; month <= termMonths; month++) {
    const interestPayment = remainingDebt.times(monthlyRate).toDecimalPlaces(2);
    let principalPayment = monthlyPrincipal;

    if (month === termMonths) {
      principalPayment = remainingDebt.toDecimalPlaces(2);
    }

    remainingDebt = remainingDebt.minus(principalPayment).toDecimalPlaces(2);
    if (remainingDebt.isNegative()) {
      remainingDebt = new Decimal(0);
    }

    const monthlyTotal = principalPayment.plus(interestPayment).toDecimalPlaces(2);

    totalInterest = totalInterest.plus(interestPayment);
    totalPayment = totalPayment.plus(monthlyTotal);

    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + month);

    schedule.push({
      monthNumber: month,
      paymentDate,
      principalAmount: principalPayment.toFixed(2),
      interestAmount: interestPayment.toFixed(2),
      totalPayment: monthlyTotal.toFixed(2),
      remainingDebt: remainingDebt.toFixed(2),
    });
  }

  return {
    monthlyPayment: schedule[0]?.totalPayment ?? "0.00",
    totalInterest: totalInterest.toFixed(2),
    totalPayment: totalPayment.toFixed(2),
    schedule,
  };
}
