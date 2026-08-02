import { z } from "zod";

export const createSourceSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(10).default("💰"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#4CAF50"),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).default("UZS"),
  description: z.string().max(500).optional(),
});

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().min(1).max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).optional(),
  description: z.string().max(500).optional(),
});

export const sourceFilterSchema = z.object({
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).optional(),
  search: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type SourceFilterInput = z.infer<typeof sourceFilterSchema>;
