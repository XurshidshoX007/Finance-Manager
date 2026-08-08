import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { CreditsService } from "./credits.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";

export class CreditsHandler {
  private readonly creditsService: CreditsService;

  constructor(_bot: Bot<CustomContext>, creditsService: CreditsService) {
    this.creditsService = creditsService;
  }

  register(bot: Bot<CustomContext>): void {
    bot.command("credits", this.handleList.bind(this));
    bot.callbackQuery("credits:list", this.handleListCallback.bind(this));
    bot.callbackQuery(/^credit:view:/, this.handleView.bind(this));
    bot.callbackQuery(/^credit:archive:/, this.handleArchive.bind(this));
    bot.callbackQuery("credits:stats", this.handleStats.bind(this));
  }

  async showList(ctx: CustomContext): Promise<void> {
    await this.sendCreditsList(ctx);
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.showList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendCreditsList(ctx);
    await ctx.answerCallbackQuery();
  }

  private async sendCreditsList(ctx: CustomContext): Promise<void> {
    const pagination = createPaginationInput(1, 10);
    const result = await this.creditsService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      pagination,
    );

    if (result.data.length === 0) {
      await ctx.reply(
        "🏦 Kreditlar ro'yxati bo'sh.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Ortga", callback_data: "menu" }],
            ],
          },
        },
      );
      return;
    }

    const creditsText = result.data
      .map((credit) => {
        const statusIcon = credit.status === "ACTIVE" ? "🟢" : credit.status === "COMPLETED" ? "✅" : "🔴";
        return `${statusIcon} ${credit.name}: ${formatMoney(Number(credit.remainingDebt), credit.currency)} / ${formatMoney(Number(credit.totalAmount), credit.currency)}`;
      })
      .join("\n");

    const buttons = result.data.map((credit) => [
      {
        text: `${credit.status === "ACTIVE" ? "🟢" : "✅"} ${credit.name} - ${formatMoney(Number(credit.remainingDebt), credit.currency)}`,
        callback_data: `credit:view:${credit.id}`,
      },
    ]);

    buttons.push([{ text: "📊 Statistika", callback_data: "credits:stats" }]);
    buttons.push([{ text: "🔙 Ortga", callback_data: "menu" }]);

    await ctx.reply(`🏦 Kreditlar:\n\n${creditsText}`, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  private async handleView(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const id = data.split(":")[2];
    if (!id) {
      await ctx.answerCallbackQuery("❌ Noto'g'ri ma'lumot");
      return;
    }

    const credit = await this.creditsService.getById(id, ctx.appState.userId, ctx.appState.userRole);

    const typeLabel = credit.type === "ANNUITY" ? "📋 Annuitet" : "📊 Differensial";
    const statusLabel = credit.status === "ACTIVE" ? "🟢 Faol" : credit.status === "COMPLETED" ? "✅ Yakunlangan" : "🔴 Bekor qilingan";

    const text =
      `🏦 ${credit.name}\n\n` +
      `💰 Umumiy miqdor: ${formatMoney(Number(credit.totalAmount), credit.currency)}\n` +
      `📊 Qolgan qarz: ${formatMoney(Number(credit.remainingDebt), credit.currency)}\n` +
      `📅 Oylik to'lov: ${formatMoney(Number(credit.monthlyPayment), credit.currency)}\n` +
      `📈 Foiz stavkasi: ${credit.interestRate}%\n` +
      `📅 Muddat: ${credit.termMonths} oy\n` +
      `📅 To'langan: ${credit.paidMonths} oy\n` +
      `📋 Turi: ${typeLabel}\n` +
      `📊 Status: ${statusLabel}\n` +
      `📅 Boshlanish: ${credit.startDate.toLocaleDateString("uz-UZ")}\n` +
      `📅 Tugash: ${credit.endDate.toLocaleDateString("uz-UZ")}\n` +
      `📊 Jadval: ${credit.paidScheduleCount}/${credit.scheduleCount} to'langan`;

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    if (credit.status === "ACTIVE") {
      buttons.push([{ text: "🗑 Arxivlash", callback_data: `credit:archive:${credit.id}` }]);
    }
    buttons.push([{ text: "🔙 Ortga", callback_data: "credits:list" }]);

    await ctx.editMessageText(text, {
      reply_markup: { inline_keyboard: buttons },
    });
    await ctx.answerCallbackQuery();
  }

  private async handleArchive(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const id = data.split(":")[2];
    if (!id) {
      await ctx.answerCallbackQuery("❌ Noto'g'ri ma'lumot");
      return;
    }

    await this.creditsService.archive(ctx.appState.userId, ctx.appState.userRole, id);
    await ctx.answerCallbackQuery("✅ Kredit arxivlandi");
    await this.sendCreditsList(ctx);
  }

  private async handleStats(ctx: CustomContext): Promise<void> {
    const stats = await this.creditsService.getCreditStats(ctx.appState.userId, ctx.appState.userRole);

    const text =
      "📊 Kredit statistikasi:\n\n" +
      `🏦 Jami kreditlar: ${stats.total}\n` +
      `🟢 Faol: ${stats.active}\n` +
      `✅ Yakunlangan: ${stats.completed}\n` +
      `💰 Qolgan qarz: ${stats.totalRemainingDebt}`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Ortga", callback_data: "credits:list" }],
        ],
      },
    });
    await ctx.answerCallbackQuery();
  }
}
