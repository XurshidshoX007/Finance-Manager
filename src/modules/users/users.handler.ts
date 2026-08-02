import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { UsersService } from "./users.service.js";
import { Role } from "../../shared/types/index.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { safeAnswerCallback } from "../../shared/telegram/index.js";

export class UsersHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly usersService: UsersService;

  constructor(bot: Bot<CustomContext>, usersService: UsersService) {
    this.bot = bot;
    this.usersService = usersService;
  }

  register(): void {
    this.bot.command("users", this.handleUsersList.bind(this));
    this.bot.callbackQuery(/^user:/, this.handleUserAction.bind(this));
  }

  private async handleUsersList(ctx: CustomContext): Promise<void> {
    if (ctx.appState.userRole !== Role.ADMIN) {
      await ctx.reply("❌ Bu buyruq faqat adminlar uchun.");
      return;
    }

    const pagination = createPaginationInput(1, 10);
    const result = await this.usersService.listUsers(pagination, undefined, ctx.appState.userRole);

    if (result.data.length === 0) {
      await ctx.reply("👥 Foydalanuvchilar ro'yxati bo'sh.");
      return;
    }

    const usersList = result.data
      .map((user, index) => {
        const status = user.isActive ? "🟢" : "🔴";
        const blocked = user.isBlocked ? "🚫" : "";
        return `${index + 1}. ${status}${blocked} ${user.firstName} ${user.lastName ?? ""} - @${user.username ?? "N/A"} [${user.role}]`;
      })
      .join("\n");

    const paginationInfo = `\n\n📄 Sahifa ${result.pagination.page}/${result.pagination.totalPages} | Jami: ${result.pagination.total}`;

    await ctx.reply(`👥 Foydalanuvchilar:\n\n${usersList}${paginationInfo}`);
  }

  private async handleUserAction(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const parts = data.split(":");
    const action = parts[1];
    const userId = parts[2];

    if (!action || !userId) {
      await safeAnswerCallback(ctx, "❌ Noto'g'ri ma'lumot");
      return;
    }

    if (ctx.appState.userRole !== Role.ADMIN) {
      await safeAnswerCallback(ctx, "❌ Faqat adminlar uchun");
      return;
    }

    try {
      switch (action) {
        case "role-admin":
          await this.usersService.changeRole(ctx.appState.userId, userId, Role.ADMIN);
          await safeAnswerCallback(ctx, "✅ Rol ADMIN ga o'zgartirildi");
          break;
        case "role-manager":
          await this.usersService.changeRole(ctx.appState.userId, userId, Role.MANAGER);
          await safeAnswerCallback(ctx, "✅ Rol MANAGER ga o'zgartirildi");
          break;
        case "role-employee":
          await this.usersService.changeRole(ctx.appState.userId, userId, Role.EMPLOYEE);
          await safeAnswerCallback(ctx, "✅ Rol EMPLOYEE ga o'zgartirildi");
          break;
        case "toggle-active":
          await this.usersService.toggleActive(ctx.appState.userId, userId, true);
          await safeAnswerCallback(ctx, "✅ Foydalanuvchi faollashtirildi");
          break;
        case "toggle-block":
          await this.usersService.toggleBlocked(ctx.appState.userId, userId, true);
          await safeAnswerCallback(ctx, "✅ Foydalanuvchi bloklandi");
          break;
        default:
          await safeAnswerCallback(ctx, "❌ Noma'lum amal");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await safeAnswerCallback(ctx, `❌ ${message}`);
    }
  }
}
