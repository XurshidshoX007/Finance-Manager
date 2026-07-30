import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export function toDecimal(value: string | number): Decimal {
  return new Decimal(value);
}

export function decimalToString(value: Decimal): string {
  return value.toFixed(2);
}

export function decimalToNumber(value: Decimal): number {
  return value.toNumber();
}

export function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, val) => acc.plus(val), new Decimal(0));
}

export function subtractDecimals(a: Decimal, b: Decimal): Decimal {
  return a.minus(b);
}

export function isPositiveDecimal(value: Decimal): boolean {
  return value.greaterThan(0);
}

export function isNonNegativeDecimal(value: Decimal): boolean {
  return value.greaterThanOrEqualTo(0);
}

export function formatMoney(amount: string | number, currency: string = "UZS"): string {
  const decimal = toDecimal(amount);
  const formatted = decimal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}
