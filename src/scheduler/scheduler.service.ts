import cron from "node-cron";
import type { BackupService } from "../modules/backup/backup.service.js";
import type { QueueService } from "../modules/queue/queue.service.js";
import type { PrismaClient } from "@prisma/client";
import { getLogger } from "../shared/logger/index.js";

export class SchedulerService {
  private readonly backupService: BackupService;
  private readonly queueService: QueueService;
  private readonly prisma: PrismaClient;
  private readonly logger = getLogger("scheduler");

  constructor(
    _bot: unknown,
    backupService: BackupService,
    queueService: QueueService,
    prisma: PrismaClient,
  ) {
    this.backupService = backupService;
    this.queueService = queueService;
    this.prisma = prisma;
  }

  start(): void {
    this.logger.info("Starting scheduler...");

    // Daily backup at 03:00
    cron.schedule("0 3 * * *", async () => {
      this.logger.info("Running daily backup...");
      try {
        await this.backupService.createBackup();
        this.logger.info("Daily backup completed");
      } catch (error) {
        this.logger.error({ error }, "Daily backup failed");
      }
    });

    // Daily reminder at 09:00
    cron.schedule("0 9 * * *", async () => {
      this.logger.info("Sending daily reminders...");
      try {
        const activeUsers = await this.prisma.user.findMany({
          where: { isActive: true, isBlocked: false, isArchived: false },
          select: { id: true, telegramId: true },
        });

        for (const user of activeUsers) {
          try {
            await this.queueService.addDailyReminder(user.id, user.telegramId.toString());
          } catch (error) {
            this.logger.error({ userId: user.id, error }, "Failed to queue daily reminder");
          }
        }

        this.logger.info({ count: activeUsers.length }, "Daily reminders queued");
      } catch (error) {
        this.logger.error({ error }, "Daily reminders failed");
      }
    });

    // Credit reminders at 08:00
    cron.schedule("0 8 * * *", async () => {
      this.logger.info("Sending credit reminders...");
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingPayments = await this.prisma.creditSchedule.findMany({
          where: {
            paymentDate: { gte: today, lte: tomorrow },
            isPaid: false,
          },
          include: {
            credit: {
              include: {
                user: true,
              },
            },
          },
        });

        for (const payment of upcomingPayments) {
          try {
            await this.queueService.addCreditReminder(
              payment.creditId,
              payment.credit.userId,
              payment.credit.user.telegramId.toString(),
              payment.credit.name,
              String(payment.totalPayment),
              payment.paymentDate.toISOString(),
            );
          } catch (error) {
            this.logger.error({ paymentId: payment.id, error }, "Failed to queue credit reminder");
          }
        }

        this.logger.info({ count: upcomingPayments.length }, "Credit reminders queued");
      } catch (error) {
        this.logger.error({ error }, "Credit reminders failed");
      }
    });

    this.logger.info("Scheduler started");
  }
}
