import type { TransactionsRepository } from "../transactions/transactions.repository.js";
import type { CreditsRepository } from "../credits/credits.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import type { ReportFilterInput, ReportResult, DashboardResult, KpiResult } from "./reports.types.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError, ValidationError } from "../../shared/errors/index.js";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "../../shared/utils/index.js";

export class ReportsService {
  private readonly transactionsRepo: TransactionsRepository;
  private readonly creditsRepo: CreditsRepository;

  constructor(
    transactionsRepo: TransactionsRepository,
    creditsRepo: CreditsRepository,
    _auditLogService: AuditLogService,
  ) {
    this.transactionsRepo = transactionsRepo;
    this.creditsRepo = creditsRepo;
  }

  async getReport(userId: string, userRole: string, input: ReportFilterInput): Promise<ReportResult> {
    this.requirePermission(userRole, Permission.REPORTS_READ);

    const { dateFrom, dateTo } = this.getDateRange(input.period, input.dateFrom, input.dateTo);

    const [balance, topIncomeCategories, topExpenseCategories, topIncomeSources, topExpenseSources, balanceByCurrency] = await Promise.all([
      this.transactionsRepo.calculateBalance(userId, input.currency, dateFrom, dateTo),
      this.transactionsRepo.sumByCategory(userId, "INCOME", dateFrom, dateTo),
      this.transactionsRepo.sumByCategory(userId, "EXPENSE", dateFrom, dateTo),
      this.transactionsRepo.sumBySource(userId, "INCOME", dateFrom, dateTo),
      this.transactionsRepo.sumBySource(userId, "EXPENSE", dateFrom, dateTo),
      this.transactionsRepo.calculateBalanceByCurrency(userId, dateFrom, dateTo),
    ]);

    // Foiz endi o'z turi ichida hisoblanadi: kirim kategoriyasi jami
    // kirimga, chiqim kategoriyasi jami chiqimga nisbatan.
    // Ilgari ikkalasi qo'shilib bo'linardi va foizlar ma'nosiz chiqardi.
    const incomeTotal = topIncomeCategories.reduce((sum, c) => sum + c.total, 0);
    const expenseTotal = topExpenseCategories.reduce((sum, c) => sum + c.total, 0);

    const percentage = (value: number, base: number): number =>
      base > 0 ? Math.round((value / base) * 10000) / 100 : 0;

    const topCategories = [
      ...topIncomeCategories.map((c) => ({
        id: c.categoryId,
        name: c.categoryName,
        emoji: c.categoryEmoji,
        total: c.total,
        percentage: percentage(c.total, incomeTotal),
      })),
      ...topExpenseCategories.map((c) => ({
        id: c.categoryId,
        name: c.categoryName,
        emoji: c.categoryEmoji,
        total: c.total,
        percentage: percentage(c.total, expenseTotal),
      })),
    ]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const incomeSourceTotal = topIncomeSources.reduce((sum, s) => sum + s.total, 0);
    const expenseSourceTotal = topExpenseSources.reduce((sum, s) => sum + s.total, 0);

    const topSources = [
      ...topIncomeSources.map((s) => ({
        id: s.sourceId,
        name: s.sourceName,
        emoji: s.sourceEmoji,
        total: s.total,
        percentage: percentage(s.total, incomeSourceTotal),
      })),
      ...topExpenseSources.map((s) => ({
        id: s.sourceId,
        name: s.sourceName,
        emoji: s.sourceEmoji,
        total: s.total,
        percentage: percentage(s.total, expenseSourceTotal),
      })),
    ]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      period: input.period,
      currency: input.currency,
      income: balance.income,
      expense: balance.expense,
      net: balance.net,
      topCategories,
      topSources,
      balanceByCurrency,
    };
  }

  async getDashboard(userId: string, userRole: string): Promise<DashboardResult> {
    this.requirePermission(userRole, Permission.REPORTS_READ);

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Ilgari bugungi va oylik balans ikki martadan so'ralardi
    // (9 ta so'rov o'rniga endi 7 ta).
    const [
      totalBalance,
      todayBalance,
      monthlyBalance,
      topExpenseCategories,
      topIncomeCategories,
      creditStats,
      remainingDebt,
    ] = await Promise.all([
      this.transactionsRepo.calculateBalanceByCurrency(userId),
      this.transactionsRepo.calculateBalance(userId, "UZS", todayStart, todayEnd),
      this.transactionsRepo.calculateBalance(userId, "UZS", monthStart, monthEnd),
      this.transactionsRepo.sumByCategory(userId, "EXPENSE", monthStart, monthEnd),
      this.transactionsRepo.sumByCategory(userId, "INCOME", monthStart, monthEnd),
      this.creditsRepo.countByStatus(userId, "ACTIVE"),
      this.creditsRepo.sumRemainingDebt(userId, "UZS"),
    ]);

    return {
      totalBalance,
      todayIncome: todayBalance.income,
      todayExpense: todayBalance.expense,
      monthlyIncome: monthlyBalance.income,
      monthlyExpense: monthlyBalance.expense,
      activeCredits: creditStats,
      totalRemainingDebt: String(remainingDebt),
      topExpenseCategories: topExpenseCategories.slice(0, 5).map((c) => ({
        id: c.categoryId,
        name: c.categoryName,
        emoji: c.categoryEmoji,
        total: c.total,
      })),
      topIncomeCategories: topIncomeCategories.slice(0, 5).map((c) => ({
        id: c.categoryId,
        name: c.categoryName,
        emoji: c.categoryEmoji,
        total: c.total,
      })),
    };
  }

  async getKpi(userId: string, userRole: string): Promise<KpiResult> {
    this.requirePermission(userRole, Permission.REPORTS_READ);

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);

    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStart = startOfMonth(lastMonth);
    const lastMonthEnd = endOfMonth(lastMonth);

    const [
      thisMonthBalance,
      lastMonthBalance,
      totalBalance,
      remainingDebt,
    ] = await Promise.all([
      this.transactionsRepo.calculateBalance(userId, "UZS", thisMonthStart, thisMonthEnd),
      this.transactionsRepo.calculateBalance(userId, "UZS", lastMonthStart, lastMonthEnd),
      this.transactionsRepo.calculateBalance(userId, "UZS"),
      this.creditsRepo.sumRemainingDebt(userId, "UZS"),
    ]);

    const savingsRate = thisMonthBalance.income > 0
      ? ((thisMonthBalance.income - thisMonthBalance.expense) / thisMonthBalance.income) * 100
      : 0;

    const incomeGrowth = lastMonthBalance.income > 0
      ? ((thisMonthBalance.income - lastMonthBalance.income) / lastMonthBalance.income) * 100
      : 0;

    const expenseGrowth = lastMonthBalance.expense > 0
      ? ((thisMonthBalance.expense - lastMonthBalance.expense) / lastMonthBalance.expense) * 100
      : 0;

    const debtToIncomeRatio = thisMonthBalance.income > 0
      ? remainingDebt / thisMonthBalance.income
      : 0;

    return {
      savingsRate: Math.round(savingsRate * 100) / 100,
      incomeGrowth: Math.round(incomeGrowth * 100) / 100,
      expenseGrowth: Math.round(expenseGrowth * 100) / 100,
      netWorth: totalBalance.net,
      debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
    };
  }

  private getDateRange(period: string, dateFrom?: string, dateTo?: string): { dateFrom?: Date; dateTo?: Date } {
    const now = new Date();

    if (period === "custom") {
      if (!dateFrom || !dateTo) {
        throw new ValidationError("'custom' period requires both dateFrom and dateTo");
      }

      const from = new Date(dateFrom);
      const to = new Date(dateTo);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new ValidationError("dateFrom and dateTo must be valid dates");
      }

      if (from > to) {
        throw new ValidationError("dateFrom cannot be later than dateTo");
      }

      return { dateFrom: from, dateTo: to };
    }

    switch (period) {
      case "today":
        return { dateFrom: startOfDay(now), dateTo: endOfDay(now) };
      case "weekly":
        return { dateFrom: startOfWeek(now), dateTo: endOfWeek(now) };
      case "monthly":
        return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) };
      case "yearly":
        return { dateFrom: startOfYear(now), dateTo: endOfYear(now) };
      default:
        return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) };
    }
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
