import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { getLogger } from "../../shared/logger/index.js";

export class NotificationsRepository {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = getLogger("notifications-repository");
  }

  async create(data: { userId: string; type: string; title: string; message: string }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as "DAILY_REMINDER" | "CREDIT_REMINDER" | "BACKUP_REMINDER",
        title: data.title,
        message: data.message,
      },
    });
  }

  async findUnreadByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async findByUser(userId: string, limit: number = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markAsSent(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isSent: true, sentAt: new Date() },
    });
  }

  async countUnreadByUser(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async findPendingCreditReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.creditSchedule.findMany({
      where: {
        paymentDate: {
          gte: today,
          lte: tomorrow,
        },
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
  }
}
