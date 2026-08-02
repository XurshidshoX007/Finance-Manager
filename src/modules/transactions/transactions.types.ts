import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z
    .string()
    .min(1)
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a positive number"),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).default("UZS"),
  description: z.string().max(500).optional(),
  referenceId: z.string().optional(),
  categoryId: z.string().optional(),
  sourceId: z.string().optional(),
  transactionDate: z.string().optional(),
});

export const createTransferSchema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a positive number"),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).default("UZS"),
  description: z.string().max(500).optional(),
  transferSourceId: z.string().min(1),
  transferTargetId: z.string().min(1),
  transactionDate: z.string().optional(),
});

export const cancelTransactionSchema = z.object({
  cancelReason: z.string().max(500).optional(),
});

export const transactionFilterSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).optional(),
  sourceId: z.string().optional(),
  categoryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isCancelled: z.boolean().optional(),
  search: z.string().optional(),
});

export const transactionSortSchema = z.object({
  field: z.enum(["transactionDate", "amount", "createdAt"]).default("transactionDate"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
export type TransactionSortInput = z.infer<typeof transactionSortSchema>;
