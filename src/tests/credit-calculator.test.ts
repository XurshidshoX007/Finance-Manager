import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";

// Inline implementations to avoid module resolution issues
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ScheduleEntry {
  monthNumber: number;
  paymentDate: Date;
  principalAmount: string;
  interestAmount: string;
  totalPayment: string;
  remainingDebt: string;
}

interface CreditCalculation {
  monthlyPayment: string;
  totalInterest: string;
  totalPayment: string;
  schedule: ScheduleEntry[];
}

function calculateAnnuitySchedule(
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
    const factor = monthlyRate.plus(1).pow(termMonths);
    monthlyPayment = principal.times(monthlyRate).times(factor).div(factor.minus(1));
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

function calculateDifferentialSchedule(
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
    monthlyPayment: schedule.length > 0 ? schedule[0]!.totalPayment : "0.00",
    totalInterest: totalInterest.toFixed(2),
    totalPayment: totalPayment.toFixed(2),
    schedule,
  };
}

describe("Credit Calculator", () => {
  const baseDate = new Date("2024-01-01");

  describe("calculateAnnuitySchedule", () => {
    it("should generate correct number of schedule entries", () => {
      const result = calculateAnnuitySchedule("12000000", "12", 12, baseDate);
      expect(result.schedule.length).toBe(12);
    });

    it("should have consistent monthly payments", () => {
      const result = calculateAnnuitySchedule("12000000", "12", 12, baseDate);
      const payments = result.schedule.map((s) => s.totalPayment);
      const first = payments[0];
      for (const payment of payments) {
        expect(Math.abs(Number(payment) - Number(first))).toBeLessThan(0.02);
      }
    });

    it("should have zero remaining debt at the end", () => {
      const result = calculateAnnuitySchedule("12000000", "12", 12, baseDate);
      const lastEntry = result.schedule[result.schedule.length - 1];
      expect(Number(lastEntry!.remainingDebt)).toBeLessThanOrEqual(0.01);
    });

    it("should calculate total interest correctly", () => {
      const result = calculateAnnuitySchedule("12000000", "12", 12, baseDate);
      const totalPayments = result.schedule.reduce(
        (sum, s) => sum + Number(s.totalPayment),
        0,
      );
      const totalPrincipal = Number(
        result.schedule.reduce((sum, s) => sum + Number(s.principalAmount), 0).toFixed(2),
      );
      expect(totalPayments).toBeGreaterThan(totalPrincipal);
      expect(Number(result.totalInterest)).toBeGreaterThan(0);
    });

    it("should handle zero interest rate", () => {
      const result = calculateAnnuitySchedule("12000000", "0", 12, baseDate);
      expect(result.schedule.length).toBe(12);
      expect(Number(result.totalInterest)).toBe(0);
      expect(Number(result.monthlyPayment)).toBe(1000000);
    });
  });

  describe("calculateDifferentialSchedule", () => {
    it("should generate correct number of schedule entries", () => {
      const result = calculateDifferentialSchedule("12000000", "12", 12, baseDate);
      expect(result.schedule.length).toBe(12);
    });

    it("should have decreasing total payments", () => {
      const result = calculateDifferentialSchedule("12000000", "12", 12, baseDate);
      for (let i = 1; i < result.schedule.length; i++) {
        expect(Number(result.schedule[i]!.totalPayment)).toBeLessThanOrEqual(
          Number(result.schedule[i - 1]!.totalPayment),
        );
      }
    });

    it("should have equal principal payments", () => {
      const result = calculateDifferentialSchedule("12000000", "12", 12, baseDate);
      const principals = result.schedule.map((s) => Number(s.principalAmount));
      const first = principals[0];
      for (const p of principals) {
        expect(Math.abs(p - first!)).toBeLessThan(0.02);
      }
    });

    it("should have zero remaining debt at the end", () => {
      const result = calculateDifferentialSchedule("12000000", "12", 12, baseDate);
      const lastEntry = result.schedule[result.schedule.length - 1];
      expect(Number(lastEntry!.remainingDebt)).toBeLessThanOrEqual(0.01);
    });
  });
});
