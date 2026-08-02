/**
 * Pul va sanani formatlash uchun yagona joy.
 *
 * Ilgari har bir sahifa o'zining `formatMoney` nusxasini yozardi va
 * `Intl.NumberFormat` standart sozlamasi tiyinlarni tashlab yuborardi
 * (1234.56 → "1 235").
 */

const moneyFormatter = new Intl.NumberFormat("uz-UZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("uz-UZ", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(amount: number | string, currency = "UZS"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) {
    return `0.00 ${currency}`;
  }

  return `${moneyFormatter.format(value)} ${currency}`;
}

/** Katta summalar uchun qisqartirilgan ko'rinish: 1,2 mln. */
export function formatMoneyCompact(amount: number | string, currency = "UZS"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) {
    return `0 ${currency}`;
  }

  if (Math.abs(value) < 1_000_000) {
    return formatMoney(value, currency);
  }

  return `${compactFormatter.format(value)} ${currency}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}
