import { z } from "zod";

export const reportPeriodSchema = z.enum(["today", "weekly", "monthly", "yearly", "custom"]);
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;

export const reportFilterSchema = z.object({
  period: reportPeriodSchema.default("monthly"),
  currency: z.enum(["UZS", "USD", "EUR", "RUB", "GBP", "CNY"]).default("UZS"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

export interface ReportResult {
  period: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
  topCategories: Array<{
    id: string;
    name: string;
    emoji: string;
    total: number;
    percentage: number;
  }>;
  topSources: Array<{
    id: string;
    name: string;
    emoji: string;
    total: number;
    percentage: number;
  }>;
  balanceByCurrency: Record<string, { income: number; expense: number; net: number }>;
}

export interface DashboardResult {
  totalBalance: Record<string, { income: number; expense: number; net: number }>;
  todayIncome: number;
  todayExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  activeCredits: number;
  totalRemainingDebt: string;
  topExpenseCategories: Array<{
    id: string;
    name: string;
    emoji: string;
    total: number;
  }>;
  topIncomeCategories: Array<{
    id: string;
    name: string;
    emoji: string;
    total: number;
  }>;
}

export interface KpiResult {
  savingsRate: number;
  incomeGrowth: number;
  expenseGrowth: number;
  netWorth: number;
  debtToIncomeRatio: number;
}
