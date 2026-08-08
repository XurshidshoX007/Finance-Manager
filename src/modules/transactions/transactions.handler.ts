import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { SourcesService } from "../sources/sources.service.js";
import type { TransactionsService } from "./transactions.service.js";
import { createPaginationInput, formatMoney, isMainActionText, parseMoneyText } from "../../shared/utils/index.js";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionStep = "amount" | "category" | "transferSource" | "transferTarget";
type TransactionSession = {
  type: TransactionType;
  step: TransactionStep;
  amount?: string;
  transferSourceId?: string;
};
type NextFunction = () => Promise<void>;

type SelectableItem = {
  id: string;
  name: string;
  emoji: string;
  isSystem?: boolean;
};

const userSessions = new Map<string, TransactionSession>();

export class TransactionsHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly transactionsService: TransactionsService;
  private readonly categoriesService: CategoriesService;
  private readonly sourcesService: SourcesService;

  constructor(
    bot: Bot<CustomContext>,
    transactionsService: TransactionsService,
    categoriesService: CategoriesService,
    sourcesService: SourcesService,
  ) {
    this.bot = bot;
    this.transactionsService = transactionsService;
    this.categoriesService = categoriesService;
    this.sourcesService = sourcesService;
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
    this.bot.callbackQuery(/^tx:create:category:/, this.handleCategorySelected.bind(this));
    this.bot.callbackQuery("tx:create:nocategory", this.handleNoCategorySelected.bind(this));
    this.bot.callbackQuery(/^tx:create:source:/, this.handleTransferSourceSelected.bind(this));
    this.bot.callbackQuery(/^tx:create:target:/, this.handleTransferTargetSelected.bind(this));
    this.bot.callbackQuery("tx:create:cancel", this.handleCreateCancel.bind(this));
    this.bot.on("message", this.handleCreateInput.bind(this));
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
    await this.startAmountInput(ctx, "INCOME");
  }

  private async handleExpenseStart(ctx: CustomContext): Promise<void> {
    await this.startAmountInput(ctx, "EXPENSE");
  }

  private async handleTransferStart(ctx: CustomContext): Promise<void> {
    await this.startAmountInput(ctx, "TRANSFER");
  }

  private async startAmountInput(ctx: CustomContext, type: TransactionType): Promise<void> {
    const title = type === "INCOME" ? "🟢 Yangi kirim qo'shish" : type === "EXPENSE" ? "🔴 Yangi chiqim qo'shish" : "🔄 Yangi o'tkazma qo'shish";
    const example = type === "EXPENSE" ? "50000" : "500000";

    await ctx.reply(
      `${title}\n\n` +
      "Miqdorni yuboring:\n" +
      `Masalan: ${example}\n\n` +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    userSessions.set(ctx.appState.userId, { type, step: "amount" });
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }
  }

  private async handleCreateInput(ctx: CustomContext, next: NextFunction): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session) {
      await next();
      return;
    }

    const text = ctx.message?.text;
    if (!text) return;

    if (text === "/cancel") {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply("❌ Tranzaksiya yaratish bekor qilindi.");
      return;
    }

    if (isMainActionText(text)) {
      userSessions.delete(ctx.appState.userId);
      await next();
      return;
    }

    if (text.startsWith("/")) {
      await ctx.reply("Miqdorni yuboring yoki bekor qilish uchun /cancel buyrug'ini yozing.");
      return;
    }

    if (session.step !== "amount") {
      await ctx.reply("Iltimos, pastdagi tugmalardan tanlang yoki /cancel yuboring.");
      return;
    }

    const amount = parseMoneyText(text);
    if (!amount) {
      await ctx.reply("❌ Miqdor noto'g'ri. Masalan: 50000 yoki 50 000\n\nQaytadan kiriting yoki /cancel");
      return;
    }

    if (session.type === "TRANSFER") {
      userSessions.set(ctx.appState.userId, { ...session, step: "transferSource", amount });
      await this.sendTransferSourceSelection(ctx);
      return;
    }

    userSessions.set(ctx.appState.userId, { ...session, step: "category", amount });
    await this.sendCategorySelection(ctx, session.type);
  }

  private async sendCategorySelection(ctx: CustomContext, type: "INCOME" | "EXPENSE"): Promise<void> {
    const categories = await this.categoriesService.listActive(ctx.appState.userId, ctx.appState.userRole, type);
    const buttons = this.toButtonRows(
      categories,
      (category) => `${category.emoji} ${category.name}${category.isSystem ? " 🌐" : ""}`,
      (category) => `tx:create:category:${category.id}`,
    );

    buttons.push([{ text: "➖ Kategoriyasiz", callback_data: "tx:create:nocategory" }]);
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:create:cancel" }]);

    await ctx.reply(
      "📂 Kategoriyani tanlang:\n\n" +
      "Agar mos kategoriya bo'lmasa, 'Kategoriyasiz' tugmasini bosing.",
      { reply_markup: { inline_keyboard: buttons } },
    );
  }

  private async sendTransferSourceSelection(ctx: CustomContext): Promise<void> {
    const sources = await this.sourcesService.listActive(ctx.appState.userId, ctx.appState.userRole);
    if (sources.length < 2) {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply(
        "❌ O'tkazma uchun kamida 2 ta manba kerak.\n\n" +
        "Avval /sources orqali manbalar qo'shing.",
      );
      return;
    }

    const buttons = this.toButtonRows(
      sources,
      (source) => `${source.emoji} ${source.name}`,
      (source) => `tx:create:source:${source.id}`,
    );
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:create:cancel" }]);

    await ctx.reply("📤 Qaysi manbadan o'tkazilsin?", {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  private async sendTransferTargetSelection(ctx: CustomContext, transferSourceId: string): Promise<void> {
    const sources = await this.sourcesService.listActive(ctx.appState.userId, ctx.appState.userRole);
    const targets = sources.filter((source) => source.id !== transferSourceId);

    if (targets.length === 0) {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply("❌ Qabul qiluvchi manba topilmadi. Avval boshqa manba qo'shing.");
      return;
    }

    const buttons = this.toButtonRows(
      targets,
      (source) => `${source.emoji} ${source.name}`,
      (source) => `tx:create:target:${source.id}`,
    );
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:create:cancel" }]);

    await ctx.reply("📥 Qaysi manbaga o'tkazilsin?", {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  private async handleCategorySelected(ctx: CustomContext): Promise<void> {
    const categoryId = ctx.callbackQuery?.data?.split(":")[3];
    if (!categoryId) {
      await ctx.answerCallbackQuery("❌ Noto'g'ri kategoriya");
      return;
    }

    await this.createTransactionFromSession(ctx, categoryId);
  }

  private async handleNoCategorySelected(ctx: CustomContext): Promise<void> {
    await this.createTransactionFromSession(ctx);
  }

  private async handleTransferSourceSelected(ctx: CustomContext): Promise<void> {
    const sourceId = ctx.callbackQuery?.data?.split(":")[3];
    const session = userSessions.get(ctx.appState.userId);

    if (!sourceId || !session?.amount || session.step !== "transferSource" || session.type !== "TRANSFER") {
      await ctx.answerCallbackQuery("❌ Sessiya topilmadi. Qaytadan boshlang.");
      return;
    }

    userSessions.set(ctx.appState.userId, { ...session, step: "transferTarget", transferSourceId: sourceId });
    await ctx.answerCallbackQuery();
    await this.sendTransferTargetSelection(ctx, sourceId);
  }

  private async handleTransferTargetSelected(ctx: CustomContext): Promise<void> {
    const targetId = ctx.callbackQuery?.data?.split(":")[3];
    const session = userSessions.get(ctx.appState.userId);

    if (!targetId || !session?.amount || !session.transferSourceId || session.step !== "transferTarget" || session.type !== "TRANSFER") {
      await ctx.answerCallbackQuery("❌ Sessiya topilmadi. Qaytadan boshlang.");
      return;
    }

    try {
      const transaction = await this.transactionsService.createTransfer(ctx.appState.userId, ctx.appState.userRole, {
        amount: session.amount,
        currency: "UZS",
        transferSourceId: session.transferSourceId,
        transferTargetId: targetId,
      });

      userSessions.delete(ctx.appState.userId);
      await ctx.answerCallbackQuery("✅ Saqlandi");
      await ctx.reply(
        "✅ O'tkazma saqlandi!\n\n" +
        `🔄 ${formatMoney(Number(transaction.amount), transaction.currency)}\n` +
        (transaction.transferSource ? `📤 ${transaction.transferSource.emoji} ${transaction.transferSource.name}\n` : "") +
        (transaction.transferTarget ? `📥 ${transaction.transferTarget.emoji} ${transaction.transferTarget.name}` : ""),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.answerCallbackQuery("❌ Xatolik");
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }

  private async handleCreateCancel(ctx: CustomContext): Promise<void> {
    userSessions.delete(ctx.appState.userId);
    await ctx.answerCallbackQuery("❌ Bekor qilindi");
    await ctx.reply("❌ Tranzaksiya yaratish bekor qilindi.");
  }

  private async createTransactionFromSession(ctx: CustomContext, categoryId?: string): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session?.amount || session.step !== "category" || session.type === "TRANSFER") {
      await ctx.answerCallbackQuery("❌ Sessiya topilmadi. Qaytadan boshlang.");
      return;
    }

    try {
      const transaction = await this.transactionsService.create(ctx.appState.userId, ctx.appState.userRole, {
        type: session.type,
        amount: session.amount,
        currency: "UZS",
        categoryId,
      });

      userSessions.delete(ctx.appState.userId);
      await ctx.answerCallbackQuery("✅ Saqlandi");
      await ctx.reply(
        "✅ Tranzaksiya saqlandi!\n\n" +
        `${transaction.type === "INCOME" ? "🟢 Kirim" : "🔴 Chiqim"}: ${formatMoney(Number(transaction.amount), transaction.currency)}\n` +
        (transaction.category ? `📂 ${transaction.category.emoji} ${transaction.category.name}` : "📂 Kategoriyasiz"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.answerCallbackQuery("❌ Xatolik");
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }

  private toButtonRows<T extends SelectableItem>(
    items: T[],
    getText: (item: T) => string,
    getCallbackData: (item: T) => string,
  ): Array<Array<{ text: string; callback_data: string }>> {
    return items.slice(0, 50).map((item) => [{ text: getText(item), callback_data: getCallbackData(item) }]);
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
