import { z } from "zod";

export const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().url().optional(),
});

export type TelegramAuthData = z.infer<typeof telegramAuthSchema>;

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    telegramId: z.string(),
    firstName: z.string(),
    lastName: z.string().nullable(),
    username: z.string().nullable(),
    role: z.string(),
    isActive: z.boolean(),
  }),
  isFirstLogin: z.boolean(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
