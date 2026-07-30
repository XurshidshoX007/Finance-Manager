import type { Bot } from "grammy";
import type { NotificationsService } from "./notifications.service.js";
import type { TransactionsRepository } from "../transactions/transactions.repository.js";
import type { CustomContext } from "../auth/auth.middleware.js";
import { getLogger } from "../../shared/logger/index.js";
import { formatMoney } from "../../shared/utils/index.js";
import { startOfDay, endOfDay } from "../../shared/utils/index.js";

export class NotificationWorker {
  private readonly bot: Bot<CustomContext>;
  private readonly notificationsService: NotificationsService;
  private readonly transactionsRepo: TransactionsRepository;
  private readonly logger = getLogger("notification-worker");

  constructor(
    bot: Bot<CustomContext>,
    notificationsService: NotificationsService,
    transactionsRepo: TransactionsRepository,
  ) {
    this.bot = bot;
    this.notificationsService = notificationsService;
    this.transactionsRepo = transactionsRepo;
  }

  async sendDailyReminder(): Promise<void> {
    this.logger.info("Sending daily reminders...");

    try {
      this.logger.info("Daily reminder job executed");
    } catch (error) {
      this.logger.error({ error }, "Failed to send daily reminders");
    }
  }

  async sendDailyReminderToUser(userId: string, telegramId: bigint): Promise<void> {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      const balance = await this.transactionsRepo.calculateBalance(userId, "UZS", todayStart, todayEnd);

      const text =
        "☀️ Kunlik eslatma\n\n" +
        `Bugungi kirim: ${formatMoney(balance.income, "UZS")}\n` +
        `Bugungi chiqim: ${formatMoney(balance.expense, "UZS")}\n` +
        `Bugungi net: ${formatMoney(balance.net, "UZS")}\n\n` +
        `Tranzaksiya qo'shish uchun /transactions buyrug'ini yuboring.`;

      await this.bot.api.sendMessage(telegramId.toString(), text);

      await this.notificationsService.create(userId, {
        type: "DAILY_REMINDER",
        title: "Kunlik eslatma",
        message: text,
      });
    } catch (error) {
      this.logger.error({ error, userId, telegramId: telegramId.toString() }, "Failed to send daily reminder to user");
    }
  }

  async sendCreditReminders(): Promise<void> {
    this.logger.info("Sending credit reminders...");

    try {
      const reminders = await this.notificationsService.getCreditReminders();

      for (const reminder of reminders) {
        const text =
          "🏦 Kredit to'lovi eslatmasi\n\n" +
          `Kredit: ${reminder.creditName}\n` +
          `To'lov miqdori: ${formatMoney(Number(reminder.totalPayment), "UZS")}\n` +
          `To'lov sanasi: ${reminder.paymentDate.toLocaleDateString("uz-UZ")}\n\n` +
          `Iltimos, o'z vaqtida to'lovni amalga oshiring.`;

        try {
          await this.bot.api.sendMessage(reminder.telegramId.toString(), text);

          await this.notificationsService.create(reminder.userId, {
            type: "CREDIT_REMINDER",
            title: "Kredit to'lovi eslatmasi",
            message: text,
          });
        } catch (error) {
          this.logger.error({ error, reminder }, "Failed to send credit reminder");
        }
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to send credit reminders");
    }
  }
}
