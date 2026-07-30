import { z } from "zod";

export const createNotificationSchema = z.object({
  type: z.enum(["DAILY_REMINDER", "CREDIT_REMINDER", "BACKUP_REMINDER"]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
