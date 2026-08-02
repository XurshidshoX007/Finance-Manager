import { z } from "zod";

export const createCreditSchema = z.object({
  name: z.string().min(1).max(200),
  totalAmount: z
    .string()
    .min(1)
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a positive number"),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).default("UZS"),
  interestRate: z
    .string()
    .min(1)
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Interest rate must be between 0 and 100"),
  termMonths: z.number().int().min(1).max(360),
  type: z.enum(["ANNUITY", "DIFFERENTIAL"]),
  startDate: z.string().optional(),
  sourceId: z.string().optional(),
});

export const earlyPaymentSchema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a positive number"),
  isFull: z.boolean().default(false),
});

export const creditFilterSchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  type: z.enum(["ANNUITY", "DIFFERENTIAL"]).optional(),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).optional(),
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;
export type EarlyPaymentInput = z.infer<typeof earlyPaymentSchema>;
export type CreditFilterInput = z.infer<typeof creditFilterSchema>;
