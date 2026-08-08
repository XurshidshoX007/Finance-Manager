import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { CategoriesService } from "./categories.service.js";
import { createCategorySchema } from "./categories.types.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";

type CategoryType = "INCOME" | "EXPENSE";
type NextFunction = () => Promise<void>;

const userSessions = new Map<string, { type: CategoryType }>();

const categoryDefaults: Record<CategoryType, { emoji: string; color: string; label: string; callbackData: string }> = {
  INCOME: {
    emoji: "💵",
    color: "#4CAF50",
    label: "Kirim",
    callbackData: "category:create:income",
  },
  EXPENSE: {
    emoji: "🛒",
    color: "#F44336",
    label: "Chiqim",
    callbackData: "category:create:expense",
  },
};

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
    this.bot.callbackQuery("category:create:income", this.handleCreateIncome.bind(this));
    this.bot.callbackQuery("category:create:expense", this.handleCreateExpense.bind(this));
    this.bot.on("message", this.handleCreateInput.bind(this));
  }

  private async handleList(ctx: CustomContext): Promise<void> {
    await this.sendCategoriesList(ctx);
  }

  private async handleListCallback(ctx: CustomContext): Promise<void> {
    await this.sendCategoriesList(ctx);
    await ctx.answerCallbackQuery();
  }

  private async sendCategoriesList(ctx: CustomContext): Promise<void> {
    const pagination = createPaginationInput(1, 50);
    const result = await this.categoriesService.list(
      ctx.appState.userId,
      ctx.appState.userRole,
      pagination,
    );

    if (result.data.length === 0) {
      await ctx.reply(
        "📂 Kategoriyalar ro'yxati bo'sh.\n\n" +
        "Yangi kategoriya qo'shish uchun quyidagi tugmani bosing:",
        {
          reply_markup: {
            inline_keyboard: [
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
    const buttons = category.isSystem
      ? [[{ text: "🔙 Ortga", callback_data: "categories:list" }]]
      : [
          [{ text: "🗑 Arxivlash", callback_data: `category:archive:${category.id}` }],
          [{ text: "🔙 Ortga", callback_data: "categories:list" }],
        ];

    const text =
      `${category.emoji} ${category.name}\n\n` +
      `Turi: ${typeLabel}\n` +
      `Holati: ${category.isSystem ? "🌐 Umumiy" : "👤 Shaxsiy"}\n` +
      `Jami: ${formatMoney(category.stats.total)}\n` +
      `Tranzaksiyalar: ${category.stats.count}\n` +
      (category.groupName ? `Guruh: ${category.groupName}\n` : "") +
      (category.description ? `📝 ${category.description}\n` : "");

    await ctx.editMessageText(text, {
      reply_markup: {
        inline_keyboard: buttons,
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
              { text: "🟢 Kirim", callback_data: categoryDefaults.INCOME.callbackData },
              { text: "🔴 Chiqim", callback_data: categoryDefaults.EXPENSE.callbackData },
            ],
            [{ text: "🔙 Ortga", callback_data: "categories:list" }],
          ],
        },
      },
    );
    await ctx.answerCallbackQuery();
  }

  private async handleCreateIncome(ctx: CustomContext): Promise<void> {
    await this.handleCreateType(ctx, "INCOME");
  }

  private async handleCreateExpense(ctx: CustomContext): Promise<void> {
    await this.handleCreateType(ctx, "EXPENSE");
  }

  private async handleCreateType(ctx: CustomContext, type: CategoryType): Promise<void> {
    const defaults = categoryDefaults[type];
    userSessions.set(ctx.appState.userId, { type });

    await ctx.reply(
      `${type === "INCOME" ? "🟢" : "🔴"} ${defaults.label} kategoriyasi qo'shish\n\n` +
      "Kategoriya nomini yuboring:\n" +
      `Masalan: ${type === "INCOME" ? "Oylik" : "Ovqat"}\n\n` +
      "Bekor qilish uchun /cancel buyrug'ini yuboring",
    );
    await ctx.answerCallbackQuery();
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
      await ctx.reply("❌ Kategoriya yaratish bekor qilindi.");
      return;
    }

    if (text.startsWith("/")) {
      await ctx.reply("Kategoriya nomini yuboring yoki bekor qilish uchun /cancel buyrug'ini yozing.");
      return;
    }

    const name = text.trim();
    const defaults = categoryDefaults[session.type];
    const validation = createCategorySchema.safeParse({
      name,
      emoji: defaults.emoji,
      color: defaults.color,
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
      userSessions.delete(ctx.appState.userId);
      await ctx.reply(
        "✅ Kategoriya muvaffaqiyatli yaratildi!\n\n" +
        `${category.type === "INCOME" ? "🟢" : "🔴"} ${category.emoji} ${category.name}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: `➕ Yana ${defaults.label.toLowerCase()} kategoriya`, callback_data: defaults.callbackData }],
              [{ text: "📂 Kategoriyalar", callback_data: "categories:list" }],
            ],
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
      await ctx.reply(`❌ ${message}\n\nQaytadan urinib ko'ring yoki /cancel`);
    }
  }
}
