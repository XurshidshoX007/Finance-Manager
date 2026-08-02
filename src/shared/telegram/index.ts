import { GrammyError } from "grammy";
import type { Context } from "grammy";
import { getLogger } from "../logger/index.js";

// Logger dangasa (lazy) olinadi: modul import qilinishi bilanoq
// konfiguratsiya yuklanishi test muhitini buzardi.
let cachedLogger: ReturnType<typeof getLogger> | null = null;
function logger(): ReturnType<typeof getLogger> {
  cachedLogger ??= getLogger("telegram");
  return cachedLogger;
}

/** Telegram API xatolari orasida zararsiz bo'lganlari. */
const IGNORABLE_DESCRIPTIONS = [
  "message is not modified",
  "message to edit not found",
  "query is too old",
  "message can't be edited",
  "MESSAGE_ID_INVALID",
];

function isIgnorable(error: unknown): boolean {
  if (!(error instanceof GrammyError)) return false;
  const description = error.description.toLowerCase();
  return IGNORABLE_DESCRIPTIONS.some((item) => description.includes(item.toLowerCase()));
}

export interface EditOptions {
  reply_markup?: { inline_keyboard: Array<Array<Record<string, unknown>>> };
}

/**
 * Xabarni tahrirlashga urinadi, iloji bo'lmasa yangi xabar yuboradi.
 *
 * Ilgari handler'lar to'g'ridan-to'g'ri `editMessageText` chaqirardi:
 * - "message is not modified" xatosi foydalanuvchiga ko'rinardi;
 * - buyruq orqali kelingan kontekstda tahrirlash umuman ishlamasdi.
 */
export async function editOrReply(
  ctx: Context,
  text: string,
  options?: EditOptions,
): Promise<void> {
  try {
    await ctx.editMessageText(text, options as never);
    return;
  } catch (error) {
    if (!isIgnorable(error)) {
      logger().warn({ error }, "editMessageText failed, falling back to reply");
    } else {
      // Kontent o'zgarmagan bo'lsa qayta yuborishning hojati yo'q
      if (error instanceof GrammyError && error.description.toLowerCase().includes("not modified")) {
        return;
      }
    }
  }

  await ctx.reply(text, options as never);
}

/**
 * `answerCallbackQuery` ni xavfsiz chaqiradi.
 * Eskirgan so'rovlar (>15 soniya) xato beradi va bu handler'ni
 * yiqitmasligi kerak.
 */
export async function safeAnswerCallback(ctx: Context, text?: string): Promise<void> {
  try {
    if (text === undefined) {
      await ctx.answerCallbackQuery();
    } else {
      await ctx.answerCallbackQuery(text);
    }
  } catch (error) {
    if (!isIgnorable(error)) {
      logger().warn({ error }, "answerCallbackQuery failed");
    }
  }
}
