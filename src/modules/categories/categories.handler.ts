import type { Bot, NextFunction } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { CategoriesService } from "./categories.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";
import { createCategorySchema } from "./categories.types.js";
import { SessionStore } from "../../shared/session/index.js";

interface CreateSession {
  type: "INCOME" | "EXPENSE";
  step: "name";
}

const createSessions = new SessionStore<CreateSession>();

export class CategoriesHandler {
  private readonly bot: Bot<CustomContext>;
  private readonly categoriesService: CategoriesService;

  constructor(bot: Bot<CustomContext>, categoriesService: CategoriesService) {
    this.bot = bot;
    this.categoriesService = categoriesService;
  }

  register(): void {
    this.bot.command("categories", this.handleList.bind(this));
    this.bot.callbackQuery("categories:list", this.handleListCallback.bind(this));
    this.bot.callbackQuery(/^category:view:/, this.handleView.bind(this));
    this.bot.callbackQuery(/^category:archive:/, this.handleArchive.bind(this));
    this.bot.callbackQuery("category:create:start", this.handleCreateStart.bind(this));
    this.bot.callbackQuery(/^category:create:(income|expense)$/, this.handleCreateType.bind(this));
    this.bot.callbackQuery("category:defaults", this.handleCreateDefaults.bind(this));
    this.bot.command("cancel", this.handleCancel.bind(this));
    this.bot.on("message:text", this.handleCreateInput.bind(this));
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.sendCategoriesList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendCategoriesList(ctx);
    await ctx.answerCallbackQuery();
  }

  private async sendCategoriesList(ctx: CustomContext): Promise<void> {
    const pagination = createPaginationInput(1, 10);
    const result = await this.categoriesService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      pagination,
    );

    if (result.data.length === 0) {
      await ctx.reply(
        "📂 Kategoriyalar ro'yxati bo'sh.\n\n" +
        "Standart kategoriyalarni bir bosishda qo'shishingiz yoki o'zingiznikini yaratishingiz mumkin:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "⚡️ Standart kategoriyalarni qo'shish", callback_data: "category:defaults" }],
              [{ text: "➕ Kategoriya qo'shish", callback_data: "category:create:start" }],
              [{ text: "🔙 Ortga", callback_data: "menu" }],
            ],
          },
        },
      );
      return;
    }

    const incomeCategories = result.data.filter((c) => c.type === "INCOME");
    const expenseCategories = result.data.filter((c) => c.type === "EXPENSE");

    let text = "📂 Kategoriyalar:\n\n";

    if (incomeCategories.length > 0) {
      text += "🟢 Kirim kategoriyalari:\n";
      for (const cat of incomeCategories) {
        text += `  ${cat.emoji} ${cat.name} - ${formatMoney(cat.stats.total)}\n`;
      }
      text += "\n";
    }

    if (expenseCategories.length > 0) {
      text += "🔴 Chiqim kategoriyalari:\n";
      for (const cat of expenseCategories) {
        text += `  ${cat.emoji} ${cat.name} - ${formatMoney(cat.stats.total)}\n`;
      }
    }

    const buttons = result.data.map((cat) => [
      {
        text: `${cat.type === "INCOME" ? "🟢" : "🔴"} ${cat.emoji} ${cat.name}`,
        callback_data: `category:view:${cat.id}`,
      },
    ]);

    buttons.push([{ text: "➕ Kategoriya qo'shish", callback_data: "category:create:start" }]);
    buttons.push([{ text: "🔙 Ortga", callback_data: "menu" }]);

    await ctx.reply(text, {
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

    const category = await this.categoriesService.getById(id, ctx.appState.userId, ctx.appState.userRole);

    const typeLabel = category.type === "INCOME" ? "🟢 Kirim" : "🔴 Chiqim";
    const text =
      `${category.emoji} ${category.name}\n\n` +
      `Turi: ${typeLabel}\n` +
      `Jami: ${formatMoney(category.stats.total)}\n` +
      `Tranzaksiyalar: ${category.stats.count}\n` +
      (category.groupName ? `Guruh: ${category.groupName}\n` : "") +
      (category.description ? `📝 ${category.description}\n` : "");

    await ctx.editMessageText(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗑 Arxivlash", callback_data: `category:archive:${category.id}` }],
          [{ text: "🔙 Ortga", callback_data: "categories:list" }],
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

    await this.categoriesService.archive(ctx.appState.userId, ctx.appState.userRole, id);
    await ctx.answerCallbackQuery("✅ Kategoriya arxivlandi");
    await this.sendCategoriesList(ctx);
  }

  private async handleCreateStart(ctx: CustomContext): Promise<void> {
    await ctx.reply(
      "➕ Yangi kategoriya qo'shish\n\n" +
      "Kategoriya turi tanlang:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🟢 Kirim", callback_data: "category:create:income" },
              { text: "🔴 Chiqim", callback_data: "category:create:expense" },
            ],
            [{ text: "🔙 Ortga", callback_data: "categories:list" }],
          ],
        },
      },
    );
  }

  private async handleCreateType(ctx: CustomContext): Promise<void> {
    const data = ctx.callbackQuery?.data ?? "";
    const type = data.endsWith("income") ? "INCOME" : "EXPENSE";

    createSessions.set(ctx.appState.userId, { type, step: "name" });

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `➕ Yangi ${type === "INCOME" ? "🟢 kirim" : "🔴 chiqim"} kategoriyasi\n\n` +
      "Kategoriya nomini yuboring.\n" +
      "Ixtiyoriy: nom oldidan emoji qo'shsangiz, u kategoriya emojisi bo'ladi.\n" +
      "Masalan: 🍔 Oziq-ovqat\n\n" +
      "Bekor qilish uchun /cancel",
    );
  }

  private async handleCreateDefaults(ctx: CustomContext): Promise<void> {
    const created = await this.categoriesService.ensureDefaults(ctx.appState.userId);

    if (created === 0) {
      await ctx.answerCallbackQuery("ℹ️ Kategoriyalar allaqachon mavjud");
    } else {
      await ctx.answerCallbackQuery(`✅ ${created} ta kategoriya qo'shildi`);
    }

    await this.sendCategoriesList(ctx);
  }

  private async handleCancel(ctx: CustomContext): Promise<void> {
    if (createSessions.delete(ctx.appState.userId)) {
      await ctx.reply("❌ Kategoriya yaratish bekor qilindi.");
    }
  }

  private async handleCreateInput(ctx: CustomContext, next: NextFunction): Promise<void> {
    const session = createSessions.get(ctx.appState.userId);
    if (!session) {
      await next();
      return;
    }

    const text = ctx.message?.text?.trim();
    if (!text) {
      await next();
      return;
    }

    if (text.startsWith("/")) {
      createSessions.delete(ctx.appState.userId);
      await next();
      return;
    }

    const { emoji, name } = this.parseNameInput(text);

    const validation = createCategorySchema.safeParse({
      name,
      emoji,
      color: session.type === "INCOME" ? "#4CAF50" : "#F44336",
      type: session.type,
    });

    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `• ${i.message}`).join("\n");
      await ctx.reply(`❌ Noto'g'ri ma'lumot:\n${errors}\n\nQaytadan kiriting yoki /cancel`);
      return;
    }

    try {
      const category = await this.categoriesService.create(
        ctx.appState.userId,
        ctx.appState.userRole,
        validation.data,
      );
      createSessions.delete(ctx.appState.userId);
      await ctx.reply(
        `✅ Kategoriya yaratildi!\n\n` +
        `${category.emoji} ${category.name}\n` +
        `Turi: ${category.type === "INCOME" ? "🟢 Kirim" : "🔴 Chiqim"}`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "📂 Kategoriyalar", callback_data: "categories:list" }]],
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }

  private parseNameInput(text: string): { emoji: string; name: string } {
    const match = text.match(/^(\p{Extended_Pictographic}(?:\uFE0F)?)\s*(.+)$/u);
    if (match && match[1] && match[2]) {
      return { emoji: match[1], name: match[2].trim() };
    }
    return { emoji: "📝", name: text };
  }
}
