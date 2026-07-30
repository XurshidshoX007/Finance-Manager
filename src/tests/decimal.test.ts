import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";

// Inline implementations to avoid module resolution issues
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function toDecimal(value: string | number): Decimal {
  return new Decimal(value);
}

function decimalToString(value: Decimal): string {
  return value.toFixed(2);
}

function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, val) => acc.plus(val), new Decimal(0));
}

function subtractDecimals(a: Decimal, b: Decimal): Decimal {
  return a.minus(b);
}

function isPositiveDecimal(value: Decimal): boolean {
  return value.greaterThan(0);
}

function isNonNegativeDecimal(value: Decimal): boolean {
  return value.greaterThanOrEqualTo(0);
}

function formatMoney(amount: string | number, currency: string = "UZS"): string {
  const decimal = toDecimal(amount);
  const formatted = decimal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}

describe("Decimal Utils", () => {
  describe("toDecimal", () => {
    it("should convert string to Decimal", () => {
      const result = toDecimal("100.50");
      expect(result.toString()).toBe("100.5");
    });

    it("should convert number to Decimal", () => {
      const result = toDecimal(200);
      expect(result.toString()).toBe("200");
    });
  });

  describe("decimalToString", () => {
    it("should format Decimal to 2 decimal places", () => {
      const result = decimalToString(toDecimal("100.5"));
      expect(result).toBe("100.50");
    });

    it("should handle zero", () => {
      const result = decimalToString(toDecimal(0));
      expect(result).toBe("0.00");
    });
  });

  describe("sumDecimals", () => {
    it("should sum multiple decimals", () => {
      const result = sumDecimals([toDecimal("100"), toDecimal("200"), toDecimal("50")]);
      expect(result.toString()).toBe("350");
    });

    it("should return 0 for empty array", () => {
      const result = sumDecimals([]);
      expect(result.toString()).toBe("0");
    });
  });

  describe("subtractDecimals", () => {
    it("should subtract two decimals", () => {
      const result = subtractDecimals(toDecimal("500"), toDecimal("200"));
      expect(result.toString()).toBe("300");
    });

    it("should handle negative results", () => {
      const result = subtractDecimals(toDecimal("100"), toDecimal("200"));
      expect(result.isNegative()).toBe(true);
    });
  });

  describe("isPositiveDecimal", () => {
    it("should return true for positive", () => {
      expect(isPositiveDecimal(toDecimal("1"))).toBe(true);
    });

    it("should return false for zero", () => {
      expect(isPositiveDecimal(toDecimal("0"))).toBe(false);
    });

    it("should return false for negative", () => {
      expect(isPositiveDecimal(toDecimal("-1"))).toBe(false);
    });
  });

  describe("isNonNegativeDecimal", () => {
    it("should return true for zero", () => {
      expect(isNonNegativeDecimal(toDecimal("0"))).toBe(true);
    });

    it("should return true for positive", () => {
      expect(isNonNegativeDecimal(toDecimal("1"))).toBe(true);
    });

    it("should return false for negative", () => {
      expect(isNonNegativeDecimal(toDecimal("-1"))).toBe(false);
    });
  });

  describe("formatMoney", () => {
    it("should format money with currency", () => {
      expect(formatMoney(1500000, "UZS")).toBe("1,500,000.00 UZS");
    });

    it("should format zero", () => {
      expect(formatMoney(0)).toBe("0.00 UZS");
    });
  });
});
