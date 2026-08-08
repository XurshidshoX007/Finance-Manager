const MAIN_ACTION_KEYWORDS = [
  "kirim",
  "chiqim",
  "o'tkazma",
  "otkazma",
  "balans",
  "manba",
  "kategoriya",
  "kredit",
  "hisobot",
  "ortga",
  "menu",
];

export function normalizeTelegramText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMainActionText(text: string): boolean {
  const normalized = normalizeTelegramText(text);
  if (normalized.startsWith("/")) {
    return false;
  }

  return MAIN_ACTION_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function parseMoneyText(text: string): string | null {
  const normalized = text.trim().replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return normalized;
}
