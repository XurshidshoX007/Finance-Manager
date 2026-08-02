/**
 * Telegram WebApp SDK ustidan yupqa qatlam.
 *
 * Ilgari `telegram-web-app.js` index.html'da ulangan bo'lsa-da,
 * `ready()` hech qachon chaqirilmasdi: Telegram mijozi yuklanish
 * skeletonini olib tashlamas va ilova "qotib qolgan" ko'rinardi.
 */

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
  setHeaderColor?: (color: string) => void;
}

function getWebApp(): TelegramWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return w.Telegram?.WebApp ?? null;
}

/** Telegram ichida ochilganini bildiradi. */
export function isTelegramEnvironment(): boolean {
  const webApp = getWebApp();
  return Boolean(webApp?.initData);
}

/** Mini App'ni ishga tayyor deb belgilaydi va ekranni kengaytiradi. */
export function initTelegram(): void {
  const webApp = getWebApp();
  if (!webApp) return;

  webApp.ready();

  if (!webApp.isExpanded) {
    webApp.expand();
  }

  applyTheme();
  webApp.onEvent("themeChanged", applyTheme);
}

/**
 * Telegram mavzu ranglarini CSS o'zgaruvchilariga ko'chiradi.
 * Ilgari CSS'da `--tg-theme-*` ishlatilardi, lekin ular faqat
 * Telegram o'zi o'rnatgan holatda mavjud edi — brauzerda ochilganda
 * sahifa oq-oq bo'lib ko'rinmay qolardi.
 */
export function applyTheme(): void {
  const webApp = getWebApp();
  const root = document.documentElement;

  const fallback: Record<string, string> = {
    "--tg-theme-bg-color": "#ffffff",
    "--tg-theme-text-color": "#000000",
    "--tg-theme-hint-color": "#707579",
    "--tg-theme-link-color": "#3390ec",
    "--tg-theme-button-color": "#3390ec",
    "--tg-theme-button-text-color": "#ffffff",
    "--tg-theme-secondary-bg-color": "#f4f4f5",
  };

  for (const [key, value] of Object.entries(fallback)) {
    root.style.setProperty(key, value);
  }

  if (!webApp?.themeParams) return;

  for (const [key, value] of Object.entries(webApp.themeParams)) {
    if (typeof value === "string") {
      root.style.setProperty(`--tg-theme-${key.replace(/_/g, "-")}`, value);
    }
  }

  if (webApp.colorScheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/** Muvaffaqiyat/xatolik uchun yengil tebranish. */
export function haptic(type: "success" | "error" | "warning"): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}

/** Telegram'ning tizim "orqaga" tugmasini boshqaradi. */
export function setBackButton(handler: (() => void) | null): () => void {
  const backButton = getWebApp()?.BackButton;
  if (!backButton) return () => undefined;

  if (!handler) {
    backButton.hide();
    return () => undefined;
  }

  backButton.onClick(handler);
  backButton.show();

  return () => {
    backButton.offClick(handler);
    backButton.hide();
  };
}
