import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(10).default("📝"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#FF9800"),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().max(500).optional(),
  groupId: z.string().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().min(1).max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  description: z.string().max(500).optional(),
  groupId: z.string().nullable().optional(),
});

export const categoryFilterSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  groupId: z.string().optional(),
  search: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export const createCategoryGroupSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().min(1).max(10).default("📁"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#2196F3"),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFilterInput = z.infer<typeof categoryFilterSchema>;
export type CreateCategoryGroupInput = z.infer<typeof createCategoryGroupSchema>;
