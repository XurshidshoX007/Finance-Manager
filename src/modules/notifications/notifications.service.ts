import type { NotificationsRepository } from "./notifications.repository.js";
import type { CreateNotificationInput } from "./notifications.types.js";
import { getLogger } from "../../shared/logger/index.js";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  isSent: boolean;
  createdAt: Date;
}

interface CreditReminderSchedule {
  id: string;
  paymentDate: Date;
  totalPayment: unknown;
  credit: {
    name: string;
    createdBy: string;
    user: { telegramId: bigint };
  };
}

export class NotificationsService {
  private readonly notificationsRepo: NotificationsRepository;
  private readonly logger = getLogger("notifications-service");

  constructor(notificationsRepo: NotificationsRepository) {
    this.notificationsRepo = notificationsRepo;
  }

  async create(userId: string, input: CreateNotificationInput): Promise<NotificationItem> {
    const notification = await this.notificationsRepo.create({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
    });

    this.logger.info({ notificationId: notification.id, userId }, "Notification created");

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      isSent: notification.isSent,
      createdAt: notification.createdAt,
    };
  }

  async getUnread(userId: string): Promise<NotificationItem[]> {
    const notifications = await this.notificationsRepo.findUnreadByUser(userId);
    return notifications.map((n: { id: string; type: string; title: string; message: string; isRead: boolean; isSent: boolean; createdAt: Date }) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      isSent: n.isSent,
      createdAt: n.createdAt,
    }));
  }

  async getAll(userId: string, limit?: number): Promise<NotificationItem[]> {
    const notifications = await this.notificationsRepo.findByUser(userId, limit);
    return notifications.map((n: { id: string; type: string; title: string; message: string; isRead: boolean; isSent: boolean; createdAt: Date }) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      isSent: n.isSent,
      createdAt: n.createdAt,
    }));
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationsRepo.markAsRead(id);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepo.markAllAsRead(userId);
  }

  async markAsSent(id: string): Promise<void> {
    await this.notificationsRepo.markAsSent(id);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepo.countUnreadByUser(userId);
  }

  async getCreditReminders(): Promise<Array<{
    scheduleId: string;
    creditName: string;
    paymentDate: Date;
    totalPayment: string;
    userId: string;
    telegramId: bigint;
  }>> {
    const schedules = await this.notificationsRepo.findPendingCreditReminders();

    return schedules.map((s: CreditReminderSchedule) => ({
      scheduleId: s.id,
      creditName: s.credit.name,
      paymentDate: s.paymentDate,
      totalPayment: String(s.totalPayment),
      userId: s.credit.createdBy,
      telegramId: s.credit.user.telegramId,
    }));
  }
}
