import type { Bot, NextFunction } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { TransactionsService } from "./transactions.service.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { SourcesService } from "../sources/sources.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";
import { editOrReply, safeAnswerCallback } from "../../shared/telegram/index.js";
import { SessionStore } from "../../shared/session/index.js";

type TxKind = "INCOME" | "EXPENSE" | "TRANSFER";

interface TxSession {
  type: TxKind;
  step: "amount" | "category" | "source" | "target" | "description";
  amount?: string;
  categoryId?: string;
  sourceId?: string;
  targetId?: string;
}

const userSessions = new SessionStore<TxSession>();

/** "1 500 000", "1,5mln", "250k" kabi kiritishlarni normalizatsiya qiladi. */
export function parseAmountInput(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\s|_/g, "");
  if (!cleaned) return null;

  const match = cleaned.match(/^([0-9]+(?:[.,][0-9]+)?)(k|ming|m|mln|million)?$/);
  if (!match?.[1]) return null;

  const base = Number(match[1].replace(",", "."));
  if (!Number.isFinite(base) || base <= 0) return null;

  const suffix = match[2];
  const multiplier =
    suffix === "k" || suffix === "ming"
      ? 1_000
      : suffix === "m" || suffix === "mln" || suffix === "million"
        ? 1_000_000
        : 1;

  const value = base * multiplier;
  if (!Number.isFinite(value) || value <= 0 || value > 1e15) return null;

  return value.toFixed(2);
}

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
    this.bot.callbackQuery(/^tx:pick:category:/, this.handlePickCategory.bind(this));
    this.bot.callbackQuery(/^tx:pick:source:/, this.handlePickSource.bind(this));
    this.bot.callbackQuery(/^tx:pick:target:/, this.handlePickTarget.bind(this));
    this.bot.callbackQuery("tx:skip:category", this.handleSkipCategory.bind(this));
    this.bot.callbackQuery("tx:abort", this.handleAbort.bind(this));
    this.bot.command("cancel", this.handleCancelCommand.bind(this));
    this.bot.on("message:text", this.handleAmountInput.bind(this));
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.sendTransactionsList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendTransactionsList(ctx);
    await safeAnswerCallback(ctx);
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
      await safeAnswerCallback(ctx, "❌ Noto'g'ri ma'lumot");
      return;
    }

    const tx = await this.transactionsService.getById(
      id,
      ctx.appState.userId,
      ctx.appState.userRole,
    );

    const typeLabel =
      tx.type === "INCOME" ? "🟢 Kirim" : tx.type === "EXPENSE" ? "🔴 Chiqim" : "🔄 O'tkazma";
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

    await editOrReply(ctx, text, {
      reply_markup: { inline_keyboard: buttons },
    });
    await safeAnswerCallback(ctx);
  }

  private async handleCancel(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    const id = data.split(":")[2];
    if (!id) {
      await safeAnswerCallback(ctx, "❌ Noto'g'ri ma'lumot");
      return;
    }

    try {
      await this.transactionsService.cancel(ctx.appState.userId, ctx.appState.userRole, id, {
        cancelReason: "Cancelled by user",
      });
      await safeAnswerCallback(ctx, "✅ Tranzaksiya bekor qilindi");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await safeAnswerCallback(ctx, `❌ ${message}`);
    }
  }

  private async handleIncomeStart(ctx: CustomContext): Promise<void> {
    await this.startFlow(ctx, "INCOME", "🟢 Yangi kirim", "500000");
  }

  private async handleExpenseStart(ctx: CustomContext): Promise<void> {
    await this.startFlow(ctx, "EXPENSE", "🔴 Yangi chiqim", "50000");
  }

  private async handleTransferStart(ctx: CustomContext): Promise<void> {
    await this.startFlow(ctx, "TRANSFER", "🔄 Yangi o'tkazma", "100000");
  }

  private async startFlow(
    ctx: CustomContext,
    type: TxKind,
    title: string,
    example: string,
  ): Promise<void> {
    userSessions.set(ctx.appState.userId, { type, step: "amount" });
    await safeAnswerCallback(ctx);
    await ctx.reply(
      `${title}\n\n` +
        "Miqdorni yuboring:\n" +
        `Masalan: ${example}, 250k yoki 1.5mln\n\n` +
        "Bekor qilish uchun /cancel",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "tx:abort" }]],
        },
      },
    );
  }

  private async handleAbort(ctx: CustomContext): Promise<void> {
    userSessions.delete(ctx.appState.userId);
    await safeAnswerCallback(ctx, "❌ Bekor qilindi");
    await ctx.reply("❌ Tranzaksiya yaratish bekor qilindi.");
  }

  private async handleCancelCommand(ctx: CustomContext): Promise<void> {
    if (userSessions.delete(ctx.appState.userId)) {
      await ctx.reply("❌ Tranzaksiya yaratish bekor qilindi.");
    }
  }

  private async handleAmountInput(ctx: CustomContext, next: NextFunction): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session || session.step !== "amount") {
      await next();
      return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) {
      await next();
      return;
    }

    if (text.startsWith("/")) {
      userSessions.delete(ctx.appState.userId);
      await next();
      return;
    }

    const amount = parseAmountInput(text);
    if (!amount) {
      await ctx.reply(
        "❌ Miqdorni tushunmadim.\n\n" +
          "Musbat son yuboring. Masalan: 50000, 250k, 1.5mln\n" +
          "Bekor qilish uchun /cancel",
      );
      return;
    }

    session.amount = amount;

    if (session.type === "TRANSFER") {
      session.step = "source";
      userSessions.set(ctx.appState.userId, session);
      await this.askSource(ctx, "📤 Qaysi manbadan yechiladi?", "tx:pick:source");
      return;
    }

    session.step = "category";
    userSessions.set(ctx.appState.userId, session);
    await this.askCategory(ctx, session.type);
  }

  private async askCategory(ctx: CustomContext, type: TxKind): Promise<void> {
    const categories = await this.categoriesService.listActive(
      ctx.appState.userId,
      ctx.appState.userRole,
      type,
    );

    const buttons = categories
      .slice(0, 30)
      .map((cat) => [
        { text: `${cat.emoji} ${cat.name}`, callback_data: `tx:pick:category:${cat.id}` },
      ]);

    buttons.push([{ text: "⏭ Kategoriyasiz", callback_data: "tx:skip:category" }]);
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:abort" }]);

    await ctx.reply("📂 Kategoriyani tanlang:", { reply_markup: { inline_keyboard: buttons } });
  }

  private async askSource(ctx: CustomContext, title: string, prefix: string): Promise<void> {
    const sources = await this.sourcesService.listActive(
      ctx.appState.userId,
      ctx.appState.userRole,
    );

    if (sources.length === 0) {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply("❌ Sizda mablag' manbasi yo'q.\n\nAvval manba qo'shing:", {
        reply_markup: {
          inline_keyboard: [[{ text: "➕ Manba qo'shish", callback_data: "source:create:start" }]],
        },
      });
      return;
    }

    const buttons = sources
      .slice(0, 30)
      .map((src) => [{ text: `${src.emoji} ${src.name}`, callback_data: `${prefix}:${src.id}` }]);

    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:abort" }]);

    await ctx.reply(title, { reply_markup: { inline_keyboard: buttons } });
  }

  private async handlePickCategory(ctx: CustomContext): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session) {
      await safeAnswerCallback(ctx, "⏳ Sessiya muddati tugagan, qaytadan boshlang");
      return;
    }

    session.categoryId = ctx.callbackQuery?.data?.split(":")[3];
    session.step = "source";
    userSessions.set(ctx.appState.userId, session);

    await safeAnswerCallback(ctx);
    await this.askSource(ctx, "💰 Qaysi manbadan?", "tx:pick:source");
  }

  private async handleSkipCategory(ctx: CustomContext): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session) {
      await safeAnswerCallback(ctx, "⏳ Sessiya muddati tugagan, qaytadan boshlang");
      return;
    }

    session.step = "source";
    userSessions.set(ctx.appState.userId, session);

    await safeAnswerCallback(ctx);
    await this.askSource(ctx, "💰 Qaysi manbadan?", "tx:pick:source");
  }

  private async handlePickSource(ctx: CustomContext): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session) {
      await safeAnswerCallback(ctx, "⏳ Sessiya muddati tugagan, qaytadan boshlang");
      return;
    }

    session.sourceId = ctx.callbackQuery?.data?.split(":")[3];

    if (session.type === "TRANSFER") {
      session.step = "target";
      userSessions.set(ctx.appState.userId, session);
      await safeAnswerCallback(ctx);
      await this.askSource(ctx, "📥 Qaysi manbaga tushadi?", "tx:pick:target");
      return;
    }

    await safeAnswerCallback(ctx);
    await this.finalize(ctx, session);
  }

  private async handlePickTarget(ctx: CustomContext): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session) {
      await safeAnswerCallback(ctx, "⏳ Sessiya muddati tugagan, qaytadan boshlang");
      return;
    }

    const targetId = ctx.callbackQuery?.data?.split(":")[3];

    if (targetId && targetId === session.sourceId) {
      await safeAnswerCallback(ctx, "❌ Manba va qabul qiluvchi bir xil bo'lishi mumkin emas");
      return;
    }

    session.targetId = targetId;
    await safeAnswerCallback(ctx);
    await this.finalize(ctx, session);
  }

  private async finalize(ctx: CustomContext, session: TxSession): Promise<void> {
    if (!session.amount) {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply("❌ Miqdor topilmadi, qaytadan boshlang.");
      return;
    }

    try {
      if (session.type === "TRANSFER") {
        if (!session.sourceId || !session.targetId) {
          await ctx.reply("❌ Manbalar to'liq tanlanmadi, qaytadan boshlang.");
          userSessions.delete(ctx.appState.userId);
          return;
        }

        const tx = await this.transactionsService.createTransfer(
          ctx.appState.userId,
          ctx.appState.userRole,
          {
            amount: session.amount,
            currency: "UZS",
            transferSourceId: session.sourceId,
            transferTargetId: session.targetId,
          },
        );

        userSessions.delete(ctx.appState.userId);
        await ctx.reply(
          `✅ O'tkazma saqlandi!\n\n` +
            `🔄 ${formatMoney(Number(tx.amount), tx.currency)}\n` +
            `📤 ${tx.transferSource?.emoji ?? ""} ${tx.transferSource?.name ?? "-"}\n` +
            `📥 ${tx.transferTarget?.emoji ?? ""} ${tx.transferTarget?.name ?? "-"}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "💵 Tranzaksiyalar", callback_data: "transactions:list" }],
              ],
            },
          },
        );
        return;
      }

      const tx = await this.transactionsService.create(ctx.appState.userId, ctx.appState.userRole, {
        type: session.type,
        amount: session.amount,
        currency: "UZS",
        categoryId: session.categoryId,
        sourceId: session.sourceId,
      });

      userSessions.delete(ctx.appState.userId);
      await ctx.reply(
        `✅ ${session.type === "INCOME" ? "Kirim" : "Chiqim"} saqlandi!\n\n` +
          `💰 ${formatMoney(Number(tx.amount), tx.currency)}\n` +
          (tx.category ? `📂 ${tx.category.emoji} ${tx.category.name}\n` : "") +
          (tx.source ? `💳 ${tx.source.emoji} ${tx.source.name}` : ""),
        {
          reply_markup: {
            inline_keyboard: [[{ text: "💵 Tranzaksiyalar", callback_data: "transactions:list" }]],
          },
        },
      );
    } catch (error) {
      userSessions.delete(ctx.appState.userId);
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.reply(`❌ ${message}`);
    }
  }

  private async handleBalance(ctx: CustomContext): Promise<void> {
    const balance = (await this.transactionsService.getBalance(
      ctx.appState.userId,
      ctx.appState.userRole,
      "UZS",
    )) as { income: number; expense: number; net: number };

    const text =
      "📊 Balans:\n\n" +
      `🟢 Kirim: ${formatMoney(balance.income, "UZS")}\n` +
      `🔴 Chiqim: ${formatMoney(balance.expense, "UZS")}\n` +
      `📊 Net: ${formatMoney(balance.net, "UZS")}`;

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 Ortga", callback_data: "transactions:list" }]],
      },
    });
    await safeAnswerCallback(ctx);
  }
}
