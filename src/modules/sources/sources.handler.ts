import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { SourcesService } from "./sources.service.js";
import { createSourceSchema } from "./sources.types.js";
import { createPaginationInput, formatMoney, isMainActionText } from "../../shared/utils/index.js";

type NextFunction = () => Promise<void>;

const userSessions = new Map<string, { creatingSource: boolean }>();

export class SourcesHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly sourcesService: SourcesService;

  constructor(bot: Bot<CustomContext>, sourcesService: SourcesService) {
    this.bot = bot;
    this.sourcesService = sourcesService;
  }

  register(): void {
    this.bot.command("sources", this.handleList.bind(this));
    this.bot.callbackQuery("sources:list", this.handleListCallback.bind(this));
    this.bot.callbackQuery(/^source:view:/, this.handleView.bind(this));
    this.bot.callbackQuery(/^source:archive:/, this.handleArchive.bind(this));
    this.bot.callbackQuery("source:create:start", this.handleCreateStart.bind(this));
    this.bot.on("message", this.handleCreateInput.bind(this));
  }

  async showList(ctx: CustomContext): Promise<void> {
    await this.sendSourcesList(ctx);
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.showList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendSourcesList(ctx);
    await ctx.answerCallbackQuery();
  }

  private async sendSourcesList(ctx: CustomContext): Promise<void> {
    const pagination = createPaginationInput(1, 10);
    const result = await this.sourcesService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      pagination,
    );

    if (result.data.length === 0) {
      await ctx.reply(
        "💰 Mablag' manbalari ro'yxati bo'sh.\n\n" +
        "Yangi manba qo'shish uchun quyidagi tugmani bosing:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Manba qo'shish", callback_data: "source:create:start" }],
              [{ text: "🔙 Ortga", callback_data: "menu" }],
            ],
          },
        },
      );
      return;
    }

    const sourcesText = result.data
      .map((source) => {
        const balanceText = formatMoney(source.balance.net, source.currency);
        return `${source.emoji} ${source.name}: ${balanceText}`;
      })
      .join("\n");

    const buttons = result.data.map((source) => [
      {
        text: `${source.emoji} ${source.name} (${formatMoney(source.balance.net, source.currency)})`,
        callback_data: `source:view:${source.id}`,
      },
    ]);

    buttons.push([{ text: "➕ Manba qo'shish", callback_data: "source:create:start" }]);
    buttons.push([{ text: "🔙 Ortga", callback_data: "menu" }]);

    await ctx.reply(`💰 Mablag' manbalari:\n\n${sourcesText}`, {
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

    const source = await this.sourcesService.getById(id, ctx.appState.userId, ctx.appState.userRole);

    const text =
      `${source.emoji} ${source.name}\n\n` +
      `💰 Valyuta: ${source.currency}\n` +
      `📊 Kirim: ${formatMoney(source.balance.income, source.currency)}\n` +
      `📊 Chiqim: ${formatMoney(source.balance.expense, source.currency)}\n` +
      `📊 Balans: ${formatMoney(source.balance.net, source.currency)}\n` +
      (source.description ? `📝 ${source.description}\n` : "");

    await ctx.editMessageText(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑 Arxivlash", callback_data: `source:archive:${source.id}` }],
          [{ text: "🔙 Ortga", callback_data: "sources:list" }],
        ],
      },
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

    await this.sourcesService.archive(ctx.appState.userId, ctx.appState.userRole, id);
    await ctx.answerCallbackQuery("✅ Manba arxivlandi");
    await this.sendSourcesList(ctx);
  }

  private async handleCreateStart(ctx: CustomContext): Promise<void> {
    await ctx.reply(
      "➕ Yangi manba qo'shish\n\n" +
      "Manba nomini yuboring:\n" +
      "Masalan: Naqd pul\n\n" +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    userSessions.set(ctx.appState.userId, { creatingSource: true });
    await ctx.answerCallbackQuery();
  }

  private async handleCreateInput(ctx: CustomContext, next: NextFunction): Promise<void> {
    const session = userSessions.get(ctx.appState.userId);
    if (!session?.creatingSource) {
      await next();
      return;
    }

    const text = ctx.message?.text;
    if (!text) return;

    if (text === "/cancel") {
      userSessions.delete(ctx.appState.userId);
      await ctx.reply("❌ Manba yaratish bekor qilindi.");
      return;
    }

    if (isMainActionText(text)) {
      userSessions.delete(ctx.appState.userId);
      await next();
      return;
    }

    if (text.startsWith("/")) {
      await ctx.reply("Manba nomini yuboring yoki bekor qilish uchun /cancel buyrug'ini yozing.");
      return;
    }

    const input = {
      name: text.trim(),
      emoji: "💰",
      color: "#4CAF50",
      currency: "UZS" as const,
    };

    const validation = createSourceSchema.safeParse(input);
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `• ${i.message}`).join("\n");
      await ctx.reply(`❌ Noto'g'ri ma'lumot:\n${errors}\n\nQaytadan kiriting yoki /cancel`);
      return;
    }

    try {
      const source = await this.sourcesService.create(
        ctx.appState.userId,
        ctx.appState.userRole,
        validation.data,
      );
      userSessions.delete(ctx.appState.userId);
      await ctx.reply(
        `✅ Manba muvaffaqiyatli yaratildi!\n\n` +
        `${source.emoji} ${source.name}\n` +
        `Valyuta: ${source.currency}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }
}
