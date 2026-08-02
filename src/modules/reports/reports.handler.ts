import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { ReportsService } from "./reports.service.js";
import { formatMoney } from "../../shared/utils/index.js";
import { safeAnswerCallback } from "../../shared/telegram/index.js";

export class ReportsHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly reportsService: ReportsService;

  constructor(bot: Bot<CustomContext>, reportsService: ReportsService) {
    this.bot = bot;
    this.reportsService = reportsService;
  }

  register(): void {
    this.bot.command("reports", this.handleDashboard.bind(this));
    this.bot.callbackQuery("reports:dashboard", this.handleDashboardCallback.bind(this));
    this.bot.callbackQuery(/^report:period:/, this.handlePeriodReport.bind(this));
    this.bot.callbackQuery("reports:kpi", this.handleKpi.bind(this));
  }

  private async handleDashboard(ctx: CustomContext): Promise<void> {
    await this.sendDashboard(ctx);
  }

  private async handleDashboardCallback(ctx: CustomContext): Promise<void> {
    await this.sendDashboard(ctx);
    await safeAnswerCallback(ctx);
  }

  private async sendDashboard(ctx: CustomContext): Promise<void> {
    const dashboard = await this.reportsService.getDashboard(
      ctx.appState.userId,
      ctx.appState.userRole,
    );

    const text =
      "📊 Dashboard\n\n" +
      `💰 Bugungi kirim: ${formatMoney(dashboard.todayIncome, "UZS")}\n` +
      `💸 Bugungi chiqim: ${formatMoney(dashboard.todayExpense, "UZS")}\n\n` +
      `📈 Oylik kirim: ${formatMoney(dashboard.monthlyIncome, "UZS")}\n` +
      `📉 Oylik chiqim: ${formatMoney(dashboard.monthlyExpense, "UZS")}\n` +
      `📊 Oylik net: ${formatMoney(dashboard.monthlyIncome - dashboard.monthlyExpense, "UZS")}\n\n` +
      `🏦 Faol kreditlar: ${dashboard.activeCredits}\n` +
      `💰 Qolgan qarz: ${formatMoney(Number(dashboard.totalRemainingDebt), "UZS")}`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📅 Bugun", callback_data: "report:period:today" },
            { text: "📅 Haftalik", callback_data: "report:period:weekly" },
          ],
          [
            { text: "📅 Oylik", callback_data: "report:period:monthly" },
            { text: "📅 Yillik", callback_data: "report:period:yearly" },
          ],
          [{ text: "📈 KPI", callback_data: "reports:kpi" }],
          [{ text: "🔙 Ortga", callback_data: "menu" }],
        ],
      },
    });
  }

  private async handlePeriodReport(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const period = data.split(":")[2];
    if (!period) {
      await safeAnswerCallback(ctx, "❌ Noto'g'ri ma'lumot");
      return;
    }

    const report = await this.reportsService.getReport(ctx.appState.userId, ctx.appState.userRole, {
      period: period as "today" | "weekly" | "monthly" | "yearly",
      currency: "UZS",
    });

    const periodLabels: Record<string, string> = {
      today: "Bugungi",
      weekly: "Haftalik",
      monthly: "Oylik",
      yearly: "Yillik",
    };

    const periodLabel = periodLabels[period] ?? period;

    let text =
      `📊 ${periodLabel} hisobot\n\n` +
      `🟢 Kirim: ${formatMoney(report.income, report.currency)}\n` +
      `🔴 Chiqim: ${formatMoney(report.expense, report.currency)}\n` +
      `📊 Net: ${formatMoney(report.net, report.currency)}\n`;

    if (report.topCategories.length > 0) {
      text += "\n📂 Top kategoriyalar:\n";
      for (const cat of report.topCategories.slice(0, 5)) {
        text += `  ${cat.emoji} ${cat.name}: ${formatMoney(cat.total, report.currency)} (${cat.percentage.toFixed(1)}%)\n`;
      }
    }

    if (report.topSources.length > 0) {
      text += "\n💰 Top manbalar:\n";
      for (const src of report.topSources.slice(0, 5)) {
        text += `  ${src.emoji} ${src.name}: ${formatMoney(src.total, report.currency)} (${src.percentage.toFixed(1)}%)\n`;
      }
    }

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Dashboard", callback_data: "reports:dashboard" }]],
      },
    });
    await safeAnswerCallback(ctx);
  }

  private async handleKpi(ctx: CustomContext): Promise<void> {
    const kpi = await this.reportsService.getKpi(ctx.appState.userId, ctx.appState.userRole);

    const text =
      "📈 KPI ko'rsatkichlari\n\n" +
      `💰 Tejash darajasi: ${kpi.savingsRate}%\n` +
      `📈 Kirim o'sishi: ${kpi.incomeGrowth > 0 ? "+" : ""}${kpi.incomeGrowth}%\n` +
      `📉 Chiqim o'sishi: ${kpi.expenseGrowth > 0 ? "+" : ""}${kpi.expenseGrowth}%\n` +
      `📊 Net qiymat: ${formatMoney(kpi.netWorth, "UZS")}\n` +
      `🏦 Qarz/Kirim nisbati: ${kpi.debtToIncomeRatio}`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Dashboard", callback_data: "reports:dashboard" }]],
      },
    });
    await safeAnswerCallback(ctx);
  }
}
