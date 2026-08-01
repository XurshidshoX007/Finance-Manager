export interface DefaultCategory {
  name: string;
  emoji: string;
  color: string;
  type: "INCOME" | "EXPENSE";
}

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: "Maosh", emoji: "💰", color: "#4CAF50", type: "INCOME" },
  { name: "Bonus", emoji: "🎁", color: "#8BC34A", type: "INCOME" },
  { name: "Investitsiya", emoji: "📈", color: "#CDDC39", type: "INCOME" },
  { name: "Sotuv", emoji: "🛒", color: "#009688", type: "INCOME" },
  { name: "Qarz qaytishi", emoji: "🤝", color: "#03A9F4", type: "INCOME" },
  { name: "Boshqa kirim", emoji: "💵", color: "#00BCD4", type: "INCOME" },
];

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  { name: "Oziq-ovqat", emoji: "🍔", color: "#F44336", type: "EXPENSE" },
  { name: "Transport", emoji: "🚗", color: "#FF9800", type: "EXPENSE" },
  { name: "Ijara", emoji: "🏠", color: "#E91E63", type: "EXPENSE" },
  { name: "Kommunal", emoji: "💡", color: "#9C27B0", type: "EXPENSE" },
  { name: "Aloqa / Internet", emoji: "📱", color: "#607D8B", type: "EXPENSE" },
  { name: "Kiyim", emoji: "👕", color: "#673AB7", type: "EXPENSE" },
  { name: "Sog'liq", emoji: "🏥", color: "#3F51B5", type: "EXPENSE" },
  { name: "Ta'lim", emoji: "📚", color: "#2196F3", type: "EXPENSE" },
  { name: "Ko'ngil ochar", emoji: "🎬", color: "#009688", type: "EXPENSE" },
  { name: "Kredit to'lovi", emoji: "🏦", color: "#795548", type: "EXPENSE" },
  { name: "Boshqa chiqim", emoji: "💸", color: "#9E9E9E", type: "EXPENSE" },
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  ...DEFAULT_INCOME_CATEGORIES,
  ...DEFAULT_EXPENSE_CATEGORIES,
];
