import cron, { type ScheduledTask } from "node-cron";
import type { BackupService } from "../modules/backup/backup.service.js";
import type { QueueService } from "../modules/queue/queue.service.js";
import type { PrismaClient } from "@prisma/client";
import { getLogger } from "../shared/logger/index.js";

export class SchedulerService {
  private readonly backupService: BackupService;
  private readonly queueService: QueueService;
  private readonly prisma: PrismaClient;
  private readonly logger = getLogger("scheduler");
  private readonly tasks: ScheduledTask[] = [];
  private readonly timezone: string;

  constructor(
    _bot: unknown,
    backupService: BackupService,
    queueService: QueueService,
    prisma: PrismaClient,
  ) {
    this.backupService = backupService;
    this.queueService = queueService;
    this.prisma = prisma;
    this.timezone = process.env["TZ"] ?? "Asia/Tashkent";
  }

  start(): void {
    this.logger.info("Starting scheduler...");

    // Daily backup at 03:00
    this.tasks.push(cron.schedule("0 3 * * *", async () => {
      this.logger.info("Running daily backup...");
      try {
        await this.backupService.createBackup();
        this.logger.info("Daily backup completed");
      } catch (error) {
        this.logger.error({ error }, "Daily backup failed");
      }
    }, { timezone: this.timezone }));

    // Daily reminder at 09:00
    this.tasks.push(cron.schedule("0 9 * * *", async () => {
      this.logger.info("Sending daily reminders...");
      try {
        const activeUsers = await this.prisma.user.findMany({
          where: { isActive: true, isBlocked: false, isArchived: false },
          select: { id: true, telegramId: true },
        });

        // Ketma-ket emas, bo'laklab parallel navbatga qo'yamiz —
        // minglab foydalanuvchida ketma-ket await juda sekin edi.
        const BATCH = 50;
        for (let i = 0; i < activeUsers.length; i += BATCH) {
          const batch = activeUsers.slice(i, i + BATCH);
          const results = await Promise.allSettled(
            batch.map((user: { id: string; telegramId: bigint }) => this.queueService.addDailyReminder(user.id, user.telegramId.toString())),
          );

          results.forEach((result, index) => {
            if (result.status === "rejected") {
              this.logger.error(
                { userId: batch[index]?.id, error: result.reason },
                "Failed to queue daily reminder",
              );
            }
          });
        }

        this.logger.info({ count: activeUsers.length }, "Daily reminders queued");
      } catch (error) {
        this.logger.error({ error }, "Daily reminders failed");
      }
    }, { timezone: this.timezone }));

    // Credit reminders at 08:00
    this.tasks.push(cron.schedule("0 8 * * *", async () => {
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
            credit: {
              status: "ACTIVE",
              isArchived: false,
              user: { isActive: true, isBlocked: false },
            },
          },
          select: {
            id: true,
            creditId: true,
            totalPayment: true,
            paymentDate: true,
            credit: {
              select: {
                name: true,
                createdBy: true,
                status: true,
                user: { select: { telegramId: true, isActive: true, isBlocked: true } },
              },
            },
          },
        });

        const results = await Promise.allSettled(
          upcomingPayments.map((payment: (typeof upcomingPayments)[number]) =>
            this.queueService.addCreditReminder(
              payment.creditId,
              payment.credit.createdBy,
              payment.credit.user.telegramId.toString(),
              payment.credit.name,
              String(payment.totalPayment),
              payment.paymentDate.toISOString(),
            ),
          ),
        );

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            this.logger.error(
              { paymentId: upcomingPayments[index]?.id, error: result.reason },
              "Failed to queue credit reminder",
            );
          }
        });

        this.logger.info({ count: upcomingPayments.length }, "Credit reminders queued");
      } catch (error) {
        this.logger.error({ error }, "Credit reminders failed");
      }
    }, { timezone: this.timezone }));

    this.logger.info({ timezone: this.timezone, tasks: this.tasks.length }, "Scheduler started");
  }

  /** Graceful shutdown paytida barcha cron vazifalarni to'xtatadi. */
  stop(): void {
    for (const task of this.tasks) {
      try {
        void task.stop();
      } catch {
        // ignore
      }
    }
    this.tasks.length = 0;
    this.logger.info("Scheduler stopped");
  }
}
