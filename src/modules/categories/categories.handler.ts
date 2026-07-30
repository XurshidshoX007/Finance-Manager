import type { Bot } from "grammy";
import type { CustomContext } from "../auth/auth.middleware.js";
import type { CategoriesService } from "./categories.service.js";
import { createPaginationInput } from "../../shared/utils/index.js";
import { formatMoney } from "../../shared/utils/index.js";

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
}
