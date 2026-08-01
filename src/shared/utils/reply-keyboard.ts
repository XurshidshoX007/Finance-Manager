// ============================================
// PASTKI DOIMIY KLAVIATURA (Reply Keyboard)
// Asosiy navigatsiya tugmalari — suhbatda doim ko'rinib turadi.
// ============================================
import { Role } from "../types/index.js";

export const MAIN_MENU_BUTTONS = {
  income: "💵 Kirim",
  expense: "🔴 Chiqim",
  transfer: "🔄 O'tkazma",
  balance: "📊 Balans",
  credits: "💼 Kreditlar",
  reports: "📈 Hisobotlar",
  sources: "💰 Manbalar",
  categories: "📂 Kategoriyalar",
  users: "👥 Foydalanuvchilar",
  settings: "⚙️ Sozlamalar",
  menu: "📋 Bosh menyu",
  help: "❓ Yordam",
} as const;

export type MainMenuButton = (typeof MAIN_MENU_BUTTONS)[keyof typeof MAIN_MENU_BUTTONS];

export const ALL_MAIN_MENU_BUTTONS: readonly MainMenuButton[] = Object.values(MAIN_MENU_BUTTONS);

export function isMainMenuButton(text: string): boolean {
  return ALL_MAIN_MENU_BUTTONS.includes(text as MainMenuButton);
}

export interface MainKeyboardOptions {
  reply_markup: {
    keyboard: Array<Array<{ text: string }>>;
    resize_keyboard: boolean;
    is_persistent: boolean;
    input_field_placeholder: string;
  };
}

export function buildMainKeyboard(role: Role): MainKeyboardOptions {
  const rows: Array<Array<{ text: string }>> = [
    [{ text: MAIN_MENU_BUTTONS.income }, { text: MAIN_MENU_BUTTONS.expense }],
    [{ text: MAIN_MENU_BUTTONS.transfer }, { text: MAIN_MENU_BUTTONS.balance }],
    [{ text: MAIN_MENU_BUTTONS.credits }, { text: MAIN_MENU_BUTTONS.reports }],
    [{ text: MAIN_MENU_BUTTONS.sources }, { text: MAIN_MENU_BUTTONS.categories }],
  ];

  if (role === Role.ADMIN) {
    rows.push([{ text: MAIN_MENU_BUTTONS.users }, { text: MAIN_MENU_BUTTONS.settings }]);
  }

  rows.push([{ text: MAIN_MENU_BUTTONS.menu }, { text: MAIN_MENU_BUTTONS.help }]);

  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: "Bo'limni tanlang...",
    },
  };
}
