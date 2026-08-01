import type { Bot, NextFunction } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { TransactionsService } from "./transactions.service.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { SourcesService } from "../sources/sources.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";
import { flowStore, type TransactionFlowState } from "../../shared/utils/flow-store.js";
import { MAIN_MENU_BUTTONS, isMainMenuButton } from "../../shared/utils/reply-keyboard.js";

type InlineButton = { text: string; callback_data: string };

function parseAmount(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return cleaned;
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

    // Pastki klaviatura tugmalari (asosiy navigatsiya)
    this.bot.hears(MAIN_MENU_BUTTONS.income, this.startIncomeNav.bind(this));
    this.bot.hears(MAIN_MENU_BUTTONS.expense, this.startExpenseNav.bind(this));
    this.bot.hears(MAIN_MENU_BUTTONS.transfer, this.startTransferNav.bind(this));
    this.bot.hears(MAIN_MENU_BUTTONS.balance, this.handleBalanceNav.bind(this));

    // Ro'yxat / ko'rish / bekor qilish
    this.bot.callbackQuery("transactions:list", this.handleListCallback.bind(this));
    this.bot.callbackQuery(/^tx:view:/, this.handleView.bind(this));
    this.bot.callbackQuery(/^tx:cancel:/, this.handleCancel.bind(this));
    this.bot.callbackQuery("tx:income:start", this.handleIncomeStart.bind(this));
    this.bot.callbackQuery("tx:expense:start", this.handleExpenseStart.bind(this));
    this.bot.callbackQuery("tx:transfer:start", this.handleTransferStart.bind(this));
    this.bot.callbackQuery("tx:balance", this.handleBalance.bind(this));

    // Tranzaksiya yaratish oqimi
    this.bot.callbackQuery(/^tx:flow:category:/, this.handleFlowCategory.bind(this));
    this.bot.callbackQuery(/^tx:flow:source:/, this.handleFlowSource.bind(this));
    this.bot.callbackQuery(/^tx:flow:target:/, this.handleFlowTarget.bind(this));
    this.bot.callbackQuery("tx:flow:skip", this.handleFlowSkip.bind(this));
    this.bot.callbackQuery("tx:flow:cancel", this.handleFlowCancel.bind(this));

    // Matn kiritish (oqim) — eng oxirida, shunda tugmalar birinchi ishlaydi
    this.bot.on("message", this.handleFlowInput.bind(this));
  }

  // ============================================
  // NAVIGATSIYA TUGMALARI
  // ============================================

  private async startIncomeNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleIncomeStart(ctx);
  }

  private async startExpenseNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleExpenseStart(ctx);
  }

  private async startTransferNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleTransferStart(ctx);
  }

  private async handleBalanceNav(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await this.handleBalance(ctx);
  }

  // ============================================
  // RO'YXAT / KO'RISH / BEKOR QILISH
  // ============================================

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.sendTransactionsList(ctx);
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

    const actionButtons: InlineButton[][] = [
      [
        { text: "🟢 Kirim", callback_data: "tx:income:start" },
        { text: "🔴 Chiqim", callback_data: "tx:expense:start" },
      ],
      [
        { text: "🔄 O'tkazma", callback_data: "tx:transfer:start" },
        { text: "📊 Balans", callback_data: "tx:balance" },
      ],
      [{ text: "🔙 Ortga", callback_data: "menu" }],
    ];

    if (result.data.length === 0) {
      await ctx.reply(
        "💵 Tranzaksiyalar ro'yxati bo'sh.\n\n" +
          "Yangi tranzaksiya qo'shish uchun quyidagi tugmalardan foydalaning:",
        { reply_markup: { inline_keyboard: actionButtons } },
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
      reply_markup: { inline_keyboard: actionButtons },
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

    const buttons: InlineButton[][] = [];
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

  // ============================================
  // TRANZAKSIYA YARATISH OQIMI
  // ============================================

  private async handleIncomeStart(ctx: CustomContext): Promise<void> {
    await this.beginFlow(ctx, "INCOME");
  }

  private async handleExpenseStart(ctx: CustomContext): Promise<void> {
    await this.beginFlow(ctx, "EXPENSE");
  }

  private async handleTransferStart(ctx: CustomContext): Promise<void> {
    await this.beginFlow(ctx, "TRANSFER");
  }

  private async beginFlow(
    ctx: CustomContext,
    type: "INCOME" | "EXPENSE" | "TRANSFER",
  ): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    flowStore.set(ctx.appState.userId, { kind: "transaction", type, step: "amount" });

    const labels: Record<string, string> = {
      INCOME: "🟢 Yangi kirim qo'shish",
      EXPENSE: "🔴 Yangi chiqim qo'shish",
      TRANSFER: "🔄 Yangi o'tkazma qo'shish",
    };

    await ctx.reply(
      `${labels[type]}\n\n` +
        "Miqdorni yuboring:\n" +
        "Masalan: 500000\n\n" +
        "Bekor qilish uchun /cancel",
    );
  }

  private async handleFlowInput(ctx: CustomContext, next: NextFunction): Promise<void> {
    const flow = flowStore.get(ctx.appState.userId);
    if (!flow || flow.kind !== "transaction") {
      await next();
      return;
    }

    const text = ctx.message?.text;
    if (!text) {
      await next();
      return;
    }

    // Asosiy tugma bosilgan bo'lsa — joriy jarayonni bekor qilib, keyingi handlerlarga o'tkazamiz
    if (isMainMenuButton(text)) {
      flowStore.delete(ctx.appState.userId);
      await ctx.reply("❌ Joriy jarayon bekor qilindi.");
      await next();
      return;
    }

    if (flow.step === "amount") {
      const amount = parseAmount(text);
      if (amount === null) {
        await ctx.reply(
          "❌ Noto'g'ri miqdor. Faqat son kiriting, masalan: 500000\n\nBekor qilish uchun /cancel",
        );
        return;
      }
      flow.amount = amount;
      if (flow.type === "TRANSFER") {
        flow.step = "source";
        flowStore.set(ctx.appState.userId, flow);
        await this.askSource(ctx, flow);
      } else {
        flow.step = "category";
        flowStore.set(ctx.appState.userId, flow);
        await this.askCategory(ctx, flow);
      }
      return;
    }

    if (flow.step === "description") {
      flowStore.delete(ctx.appState.userId);
      await this.createTransaction(ctx, flow, text.trim());
      return;
    }

    await ctx.reply("⚠️ Iltimos, yuqoridagi tugmalardan birini tanlang yoki /cancel yuboring.");
  }

  private async askCategory(ctx: CustomContext, flow: TransactionFlowState): Promise<void> {
    const type = flow.type === "INCOME" ? "INCOME" : "EXPENSE";
    const categories = await this.categoriesService.listActive(
      ctx.appState.userId,
      ctx.appState.userRole,
      type,
    );

    const buttons: InlineButton[][] = [];
    for (const cat of categories) {
      buttons.push([
        { text: `${cat.emoji} ${cat.name}`, callback_data: `tx:flow:category:${cat.id}` },
      ]);
    }
    buttons.push([{ text: "➖ Kategoriyasiz", callback_data: "tx:flow:category:none" }]);
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:flow:cancel" }]);

    const header =
      categories.length === 0
        ? "📂 Kategoriyalar topilmadi.\n\nKategoriya qo'shish: /categories\nYoki kategoriyasiz davom eting:"
        : "📂 Kategoriya tanlang:";

    await ctx.reply(header, { reply_markup: { inline_keyboard: buttons } });
  }

  private async handleFlowCategory(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    const flow = flowStore.get(ctx.appState.userId);
    if (!data || !flow || flow.kind !== "transaction") {
      await ctx.answerCallbackQuery("❌ Jarayon topilmadi");
      return;
    }

    const id = data.split(":")[3];
    flow.categoryId = id === "none" ? undefined : id;
    flow.step = "source";
    flowStore.set(ctx.appState.userId, flow);

    await ctx.answerCallbackQuery();
    await this.askSource(ctx, flow);
  }

  private async askSource(ctx: CustomContext, flow: TransactionFlowState): Promise<void> {
    const result = await this.sourcesService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      createPaginationInput(1, 10),
    );
    const sources = result.data;

    const buttons: InlineButton[][] = [];
    for (const s of sources) {
      buttons.push([{ text: `${s.emoji} ${s.name}`, callback_data: `tx:flow:source:${s.id}` }]);
    }
    if (flow.type !== "TRANSFER") {
      buttons.push([{ text: "➖ Manbasiz", callback_data: "tx:flow:source:none" }]);
    }
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:flow:cancel" }]);

    const header =
      sources.length === 0
        ? "💰 Manbalar topilmadi.\n\nManba qo'shish: /sources\nYoki manbasiz davom eting:"
        : flow.type === "TRANSFER"
          ? "📤 Qaysi manbadan o'tkaziladi?"
          : "💰 Manba tanlang:";

    await ctx.reply(header, { reply_markup: { inline_keyboard: buttons } });
  }

  private async handleFlowSource(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    const flow = flowStore.get(ctx.appState.userId);
    if (!data || !flow || flow.kind !== "transaction") {
      await ctx.answerCallbackQuery("❌ Jarayon topilmadi");
      return;
    }

    const id = data.split(":")[3];

    if (flow.type === "TRANSFER") {
      if (!id || id === "none") {
        await ctx.answerCallbackQuery("❌ Manba tanlanishi shart");
        return;
      }
      flow.transferSourceId = id;
      flow.step = "target";
      flowStore.set(ctx.appState.userId, flow);
      await ctx.answerCallbackQuery();
      await this.askTarget(ctx, flow);
      return;
    }

    flow.sourceId = id === "none" ? undefined : id;
    flow.step = "description";
    flowStore.set(ctx.appState.userId, flow);

    await ctx.answerCallbackQuery();
    await this.askDescription(ctx);
  }

  private async askTarget(ctx: CustomContext, flow: TransactionFlowState): Promise<void> {
    const result = await this.sourcesService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      createPaginationInput(1, 10),
    );
    const sources = result.data.filter((s) => s.id !== flow.transferSourceId);

    if (sources.length === 0) {
      flowStore.delete(ctx.appState.userId);
      await ctx.reply(
        "❌ O'tkazma uchun kamida 2 ta manba kerak. Avval /sources orqali manba qo'shing.",
      );
      return;
    }

    const buttons: InlineButton[][] = [];
    for (const s of sources) {
      buttons.push([{ text: `${s.emoji} ${s.name}`, callback_data: `tx:flow:target:${s.id}` }]);
    }
    buttons.push([{ text: "❌ Bekor qilish", callback_data: "tx:flow:cancel" }]);

    await ctx.reply("📥 Qaysi manbaga o'tkaziladi?", {
      reply_markup: { inline_keyboard: buttons },
    });
  }

  private async handleFlowTarget(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data;
    const flow = flowStore.get(ctx.appState.userId);
    if (!data || !flow || flow.kind !== "transaction") {
      await ctx.answerCallbackQuery("❌ Jarayon topilmadi");
      return;
    }

    const id = data.split(":")[3];
    if (!id) {
      await ctx.answerCallbackQuery("❌ Noto'g'ri ma'lumot");
      return;
    }

    flow.transferTargetId = id;
    flow.step = "description";
    flowStore.set(ctx.appState.userId, flow);

    await ctx.answerCallbackQuery();
    await this.askDescription(ctx);
  }

  private async askDescription(ctx: CustomContext): Promise<void> {
    await ctx.reply("📝 Izoh yuboring (ixtiyoriy) yoki tugmani bosing:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➡️ O'tkazib yuborish", callback_data: "tx:flow:skip" }],
          [{ text: "❌ Bekor qilish", callback_data: "tx:flow:cancel" }],
        ],
      },
    });
  }

  private async handleFlowSkip(ctx: CustomContext): Promise<void> {
    const flow = flowStore.get(ctx.appState.userId);
    if (!flow || flow.kind !== "transaction") {
      await ctx.answerCallbackQuery("❌ Jarayon topilmadi");
      return;
    }
    flowStore.delete(ctx.appState.userId);
    await ctx.answerCallbackQuery();
    await this.createTransaction(ctx, flow);
  }

  private async handleFlowCancel(ctx: CustomContext): Promise<void> {
    flowStore.delete(ctx.appState.userId);
    await ctx.answerCallbackQuery("❌ Bekor qilindi");
    await ctx.reply("❌ Jarayon bekor qilindi.");
  }

  private async createTransaction(
    ctx: CustomContext,
    flow: TransactionFlowState,
    description?: string,
  ): Promise<void> {
    if (!flow.amount) {
      await ctx.reply("❌ Miqdor topilmadi. Qaytadan boshlang: /transactions");
      return;
    }

    try {
      if (flow.type === "TRANSFER") {
        if (!flow.transferSourceId || !flow.transferTargetId) {
          await ctx.reply("❌ O'tkazma ma'lumotlari to'liq emas. Qaytadan boshlang: /transactions");
          return;
        }
        const result = await this.transactionsService.createTransfer(
          ctx.appState.userId,
          ctx.appState.userRole,
          {
            amount: flow.amount,
            currency: "UZS",
            description,
            transferSourceId: flow.transferSourceId,
            transferTargetId: flow.transferTargetId,
          },
        );
        await ctx.reply(
          "✅ O'tkazma muvaffaqiyatli yaratildi!\n\n" +
            `💵 Miqdor: ${formatMoney(Number(result.amount), "UZS")}\n` +
            `📤 ${result.transferSource?.emoji ?? ""} ${result.transferSource?.name ?? "?"}\n` +
            `📥 ${result.transferTarget?.emoji ?? ""} ${result.transferTarget?.name ?? "?"}\n` +
            (result.description ? `📝 ${result.description}\n` : ""),
        );
      } else {
        const result = await this.transactionsService.create(
          ctx.appState.userId,
          ctx.appState.userRole,
          {
            type: flow.type,
            amount: flow.amount,
            currency: "UZS",
            description,
            categoryId: flow.categoryId,
            sourceId: flow.sourceId,
          },
        );
        const typeLabel = flow.type === "INCOME" ? "🟢 Kirim" : "🔴 Chiqim";
        await ctx.reply(
          `✅ ${typeLabel} muvaffaqiyatli qo'shildi!\n\n` +
            `💵 Miqdor: ${formatMoney(Number(result.amount), "UZS")}\n` +
            (result.category ? `📂 ${result.category.emoji} ${result.category.name}\n` : "") +
            (result.source ? `💰 ${result.source.emoji} ${result.source.name}\n` : "") +
            (result.description ? `📝 ${result.description}\n` : ""),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }

  // ============================================
  // BALANS
  // ============================================

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
  }
}
