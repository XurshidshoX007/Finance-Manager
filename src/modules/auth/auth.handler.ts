import type { Bot } from "grammy";
import type { CustomContext } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import type { SettingsService } from "../settings/settings.service.js";
import { Role, ROLE_PERMISSIONS } from "../../shared/types/index.js";
import { buildMainKeyboard, MAIN_MENU_BUTTONS } from "../../shared/utils/reply-keyboard.js";
import { flowStore } from "../../shared/utils/flow-store.js";

export class AuthHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly authService: AuthService;
  private readonly settingsService: SettingsService;

  constructor(bot: Bot<CustomContext>, authService: AuthService, settingsService: SettingsService) {
    this.bot = bot;
    this.authService = authService;
    this.settingsService = settingsService;
  }

  register(): void {
    this.bot.command("start", this.handleStart.bind(this));
    this.bot.command("help", this.handleHelp.bind(this));
    this.bot.command("menu", this.handleMenu.bind(this));
    this.bot.command("profile", this.handleProfile.bind(this));
    this.bot.command("role", this.handleRoleInfo.bind(this));
    this.bot.command("cancel", this.handleCancelCommand.bind(this));

    // Pastki klaviatura tugmalari
    this.bot.hears(MAIN_MENU_BUTTONS.menu, this.handleMenuNav.bind(this));
    this.bot.hears(MAIN_MENU_BUTTONS.help, this.handleHelpNav.bind(this));
    this.bot.hears(MAIN_MENU_BUTTONS.settings, this.handleSettings.bind(this));
  }

  private async handleMenuNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleMenu(ctx);
  }

  private async handleHelpNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleHelp(ctx);
  }

  private async handleCancelCommand(ctx: CustomContext): Promise<void> {
    const hadFlow = flowStore.has(ctx.appState.userId);
    flowStore.delete(ctx.appState.userId);
    await ctx.reply(
      hadFlow ? "❌ Jarayon bekor qilindi." : "Bekor qilish uchun faol jarayon yo'q.",
    );
  }

  private async handleStart(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    const firstName = ctx.from?.first_name ?? "Foydalanuvchi";
    await ctx.reply(
      `👋 Salom, ${firstName}!\n\n` +
        `Finance Manager — moliyaviy boshqaruv tizimi.\n\n` +
        `Pastdagi tugmalar orqali boshqaring:\n` +
        `💵 Kirim / 🔴 Chiqim — pul yozish\n` +
        `📊 Balans — holatni ko'rish\n\n` +
        `📊 /menu - Bosh menyu\n` +
        `❓ /help - Yordam`,
      buildMainKeyboard(ctx.appState.userRole),
    );
  }

  private async handleHelp(ctx: CustomContext): Promise<void> {
    const role = ctx.appState.userRole;

    const baseCommands = [
      "💵 Kirim / 🔴 Chiqim - pul yozish",
      "🔄 O'tkazma - manbalar orasida o'tkazish",
      "📊 Balans - balansni ko'rish",
      "💰 Manbalar - mablag' manbalari",
      "📂 Kategoriyalar - kirim/chiqim turlari",
      "💵 Tranzaksiyalar - barcha operatsiyalar",
      "🏦 Kreditlar - kredit boshqaruvi",
      "📈 Hisobotlar - moliyaviy hisobotlar",
    ];

    const adminCommands =
      role === Role.ADMIN
        ? "\n\n🔧 Admin bo'limlari:\n👥 Foydalanuvchilar - foydalanuvchilar ro'yxati\n⚙️ Sozlamalar - tizim sozlamalari"
        : "";

    const helpText = "📖 Finance Manager - Yordam\n\n" + baseCommands.join("\n") + adminCommands;

    await ctx.reply(helpText, buildMainKeyboard(role));
  }

  private async handleMenu(ctx: CustomContext): Promise<void> {
    const role = ctx.appState.userRole;

    const menuText =
      "📊 Finance Manager - Bosh menyu\n\n" +
      "Quyidagi bo'limlardan birini tanlang:\n\n" +
      "💰 Manbalar - Mablag' manbalari\n" +
      "📂 Kategoriyalar - Kirim/Chiqim turlari\n" +
      "💵 Tranzaksiyalar - Moliyaviy operatsiyalar\n" +
      "🏦 Kreditlar - Kredit boshqaruvi\n" +
      "📈 Hisobotlar - Moliyaviy hisobotlar\n" +
      (role === Role.ADMIN ? "⚙️ Sozlamalar - Tizim sozlamalari\n" : "");

    await ctx.reply(menuText, buildMainKeyboard(role));
  }

  private async handleProfile(ctx: CustomContext): Promise<void> {
    const user = await this.authService.getUserById(ctx.appState.userId);

    const profileText =
      `👤 Profil ma'lumotlari\n\n` +
      `🆔 ID: ${user.id}\n` +
      `📱 Telegram: @${user.username ?? "N/A"}\n` +
      `👤 Ism: ${user.firstName} ${user.lastName ?? ""}\n` +
      `🔑 Rol: ${user.role}\n` +
      `📅 Ro'yxatdan o'tgan: ${user.createdAt.toLocaleDateString("uz-UZ")}\n` +
      `🕐 Oxirgi kirish: ${user.lastLoginAt?.toLocaleDateString("uz-UZ") ?? "N/A"}`;

    await ctx.reply(profileText, buildMainKeyboard(ctx.appState.userRole));
  }

  private async handleRoleInfo(ctx: CustomContext): Promise<void> {
    const role = ctx.appState.userRole;

    const permissions = ROLE_PERMISSIONS[role];
    const permissionList = permissions.map((p) => `  ✅ ${p}`).join("\n");

    const roleText =
      `🔑 Rol ma'lumotlari\n\n` + `Sizning rolingiz: ${role}\n\n` + `Ruxsatlar:\n${permissionList}`;

    await ctx.reply(roleText, buildMainKeyboard(ctx.appState.userRole));
  }

  private async handleSettings(ctx: CustomContext): Promise<void> {
    if (ctx.appState.userRole !== Role.ADMIN) {
      await ctx.reply(
        "❌ Bu bo'lim faqat adminlar uchun.",
        buildMainKeyboard(ctx.appState.userRole),
      );
      return;
    }

    const settings = await this.settingsService.getAll(ctx.appState.userId);

    const text =
      settings.length === 0
        ? "⚙️ Sozlamalar bo'sh."
        : "⚙️ Sozlamalar:\n\n" + settings.map((s) => `• ${s.key}: ${s.value}`).join("\n");

    await ctx.reply(text, buildMainKeyboard(ctx.appState.userRole));
  }
}
