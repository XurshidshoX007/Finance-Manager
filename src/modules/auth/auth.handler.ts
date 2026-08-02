import type { Bot } from "grammy";
import type { CustomContext } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import { Role, ROLE_PERMISSIONS } from "../../shared/types/index.js";

export class AuthHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly authService: AuthService;

  constructor(bot: Bot<CustomContext>, authService: AuthService) {
    this.bot = bot;
    this.authService = authService;
  }

  register(): void {
    this.bot.command("start", this.handleStart.bind(this));
    this.bot.command("help", this.handleHelp.bind(this));
    this.bot.command("menu", this.handleMenu.bind(this));
    this.bot.command("profile", this.handleProfile.bind(this));
    this.bot.command("role", this.handleRoleInfo.bind(this));
  }

  private async handleStart(ctx: CustomContext): Promise<void> {
    const firstName = ctx.from?.first_name ?? "Foydalanuvchi";
    await ctx.reply(
      `👋 Salom, ${firstName}!\n\n` +
        `Finance Manager — moliyaviy boshqaruv tizimi.\n\n` +
        `📊 /menu - Bosh menyu\n` +
        `❓ /help - Yordam\n` +
        `👤 /profile - Profil\n` +
        `🔑 /role - Rol ma'lumotlari`,
    );
  }

  private async handleHelp(ctx: CustomContext): Promise<void> {
    const role = ctx.appState.userRole;

    const baseCommands = [
      "📊 /menu - Bosh menyu",
      "👤 /profile - Profil ma'lumotlari",
      "🔑 /role - Rol ma'lumotlari",
      "💰 /sources - Mablag' manbalari",
      "📂 /categories - Kategoriyalar",
      "💵 /transactions - Tranzaksiyalar",
      "🏦 /credits - Kreditlar",
      "📈 /reports - Hisobotlar",
    ];

    const adminCommands =
      role === Role.ADMIN
        ? "\n\n🔧 Admin buyruqlari:\n👥 /users - Foydalanuvchilar\n⚙️ /settings - Sozlamalar"
        : "";

    const helpText = "📖 Finance Manager - Yordam\n\n" + baseCommands.join("\n") + adminCommands;

    await ctx.reply(helpText);
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

    await ctx.reply(menuText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💰 Manbalar", callback_data: "sources:list" },
            { text: "📂 Kategoriyalar", callback_data: "categories:list" },
          ],
          [
            { text: "💵 Tranzaksiyalar", callback_data: "transactions:list" },
            { text: "🏦 Kreditlar", callback_data: "credits:list" },
          ],
          [{ text: "📈 Hisobotlar", callback_data: "reports:dashboard" }],
        ],
      },
    });
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

    await ctx.reply(profileText);
  }

  private async handleRoleInfo(ctx: CustomContext): Promise<void> {
    const role = ctx.appState.userRole;

    const permissions = ROLE_PERMISSIONS[role];
    const permissionList = permissions.map((p) => `  ✅ ${p}`).join("\n");

    const roleText =
      `🔑 Rol ma'lumotlari\n\n` + `Sizning rolingiz: ${role}\n\n` + `Ruxsatlar:\n${permissionList}`;

    await ctx.reply(roleText);
  }
}
