import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { TransactionsService } from "./transactions.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";

const userSessions = new Map<string, { type: string; step: string }>();

export class TransactionsHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly transactionsService: TransactionsService;

  constructor(bot: Bot<CustomContext>, transactionsService: TransactionsService) {
    this.bot = bot;
    this.transactionsService = transactionsService;
  }

  register(): void {
    this.bot.command("transactions", this.handleList.bind(this));
    this.bot.callbackQuery("transactions:list", this.handleListCallback.bind(this));
    this.bot.callbackQuery(/^tx:view:/, this.handleView.bind(this));
    this.bot.callbackQuery(/^tx:cancel:/, this.handleCancel.bind(this));
    this.bot.callbackQuery("tx:income:start", this.handleIncomeStart.bind(this));
    this.bot.callbackQuery("tx:expense:start", this.handleExpenseStart.bind(this));
    this.bot.callbackQuery("tx:transfer:start", this.handleTransferStart.bind(this));
    this.bot.callbackQuery("tx:balance", this.handleBalance.bind(this));
  }

  async showList(ctx: CustomContext): Promise<void> {
    await this.sendTransactionsList(ctx);
  }

  async startIncome(ctx: CustomContext): Promise<void> {
    await this.handleIncomeStart(ctx);
  }

  async startExpense(ctx: CustomContext): Promise<void> {
    await this.handleExpenseStart(ctx);
  }

  async startTransfer(ctx: CustomContext): Promise<void> {
    await this.handleTransferStart(ctx);
  }

  async showBalance(ctx: CustomContext): Promise<void> {
    await this.handleBalance(ctx);
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.showList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendTransactionsList(ctx);
    await ctx.answerCallbackQuery();
  }

  private async sendTransactionsList(ctx: CustomContext): Promise<void> {
    const pagination = createPaginationInput(1, 10);
    const result = await this.transactionsService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      pagination,
      { isCancelled: false },
    );

    if (result.data.length === 0) {
      await ctx.reply(
        "💵 Tranzaksiyalar ro'yxati bo'sh.\n\n" +
        "Yangi tranzaksiya qo'shish uchun quyidagi tugmalardan foydalaning:",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🟢 Kirim", callback_data: "tx:income:start" },
                { text: "🔴 Chiqim", callback_data: "tx:expense:start" },
              ],
              [
                { text: "🔄 O'tkazma", callback_data: "tx:transfer:start" },
                { text: "📊 Balans", callback_data: "tx:balance" },
              ],
              [{ text: "🔙 Ortga", callback_data: "menu" }],
            ],
          },
        },
      );
      return;
    }

    const transactionsText = result.data
      .slice(0, 10)
      .map((tx) => {
        const typeIcon = tx.type === "INCOME" ? "🟢" : tx.type === "EXPENSE" ? "🔴" : "🔄";
        const cancelled = tx.isCancelled ? " ❌" : "";
        return `${typeIcon} ${formatMoney(Number(tx.amount), tx.currency)} - ${tx.description ?? "Tavsifsiz"}${cancelled}`;
      })
      .join("\n");

    await ctx.reply(`💵 Tranzaksiyalar:\n\n${transactionsText}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🟢 Kirim", callback_data: "tx:income:start" },
            { text: "🔴 Chiqim", callback_data: "tx:expense:start" },
          ],
          [
            { text: "🔄 O'tkazma", callback_data: "tx:transfer:start" },
            { text: "📊 Balans", callback_data: "tx:balance" },
          ],
          [{ text: "🔙 Ortga", callback_data: "menu" }],
        ],
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

    const tx = await this.transactionsService.getById(id, ctx.appState.userId, ctx.appState.userRole);

    const typeLabel = tx.type === "INCOME" ? "🟢 Kirim" : tx.type === "EXPENSE" ? "🔴 Chiqim" : "🔄 O'tkazma";
    const cancelledLabel = tx.isCancelled ? "\n❌ BEKOR QILINGAN" : "";

    const text =
      `${typeLabel}\n\n` +
      `💰 Miqdor: ${formatMoney(Number(tx.amount), tx.currency)}\n` +
      `📅 Sana: ${tx.transactionDate.toLocaleDateString("uz-UZ")}\n` +
      (tx.description ? `📝 ${tx.description}\n` : "") +
      (tx.category ? `📂 ${tx.category.emoji} ${tx.category.name}\n` : "") +
      (tx.source ? `💰 ${tx.source.emoji} ${tx.source.name}\n` : "") +
      (tx.transferSource ? `📤 ${tx.transferSource.emoji} ${tx.transferSource.name}\n` : "") +
      (tx.transferTarget ? `📥 ${tx.transferTarget.emoji} ${tx.transferTarget.name}\n` : "") +
      cancelledLabel;

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    if (!tx.isCancelled) {
      buttons.push([{ text: "❌ Bekor qilish", callback_data: `tx:cancel:${tx.id}` }]);
    }
    buttons.push([{ text: "🔙 Ortga", callback_data: "transactions:list" }]);

    await ctx.editMessageText(text, {
      reply_markup: { inline_keyboard: buttons },
    });
    await ctx.answerCallbackQuery();
  }

  private async handleCancel(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const id = data.split(":")[2];
    if (!id) {
      await ctx.answerCallbackQuery("❌ Noto'g'ri ma'lumot");
      return;
    }

    try {
      await this.transactionsService.cancel(ctx.appState.userId, ctx.appState.userRole, id, {
        cancelReason: "Cancelled by user",
      });
      await ctx.answerCallbackQuery("✅ Tranzaksiya bekor qilindi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.answerCallbackQuery(`❌ ${message}`);
    }
  }

  private async handleIncomeStart(ctx: CustomContext): Promise<void> {
    await ctx.reply(
      "🟢 Yangi kirim qo'shish\n\n" +
      "Miqdorni yuboring:\n" +
      "Masalan: 500000\n\n" +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    userSessions.set(ctx.appState.userId, { type: "INCOME", step: "amount" });
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
  }

  private async handleExpenseStart(ctx: CustomContext): Promise<void> {
    await ctx.reply(
      "🔴 Yangi chiqim qo'shish\n\n" +
      "Miqdorni yuboring:\n" +
      "Masalan: 50000\n\n" +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    userSessions.set(ctx.appState.userId, { type: "EXPENSE", step: "amount" });
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
  }

  private async handleTransferStart(ctx: CustomContext): Promise<void> {
    await ctx.reply(
      "🔄 Yangi o'tkazma qo'shish\n\n" +
      "Miqdorni yuboring:\n" +
      "Masalan: 100000\n\n" +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    userSessions.set(ctx.appState.userId, { type: "TRANSFER", step: "amount" });
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
  }

  private async handleBalance(ctx: CustomContext): Promise<void> {
    const balance = await this.transactionsService.getBalance(
      ctx.appState.userId,
      ctx.appState.userRole,
      "UZS",
    ) as { income: number; expense: number; net: number };

    const text =
      "📊 Balans:\n\n" +
      `🟢 Kirim: ${formatMoney(balance.income, "UZS")}\n` +
      `🔴 Chiqim: ${formatMoney(balance.expense, "UZS")}\n` +
      `📊 Net: ${formatMoney(balance.net, "UZS")}`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔙 Ortga", callback_data: "transactions:list" }],
        ],
      },
    });
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
  }
}
