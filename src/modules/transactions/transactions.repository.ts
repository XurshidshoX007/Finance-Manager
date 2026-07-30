import type { PrismaClient, Prisma } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { TransactionFilterInput, TransactionSortInput } from "./transactions.types.js";

export class TransactionsRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: {
    type: string;
    amount: string;
    currency: string;
    description?: string;
    referenceId?: string;
    categoryId?: string;
    sourceId?: string;
    transferSourceId?: string;
    transferTargetId?: string;
    transactionDate: Date;
    createdBy: string;
  }) {
    return this.prisma.transaction.create({
      data: {
        type: data.type as "INCOME" | "EXPENSE" | "TRANSFER",
        amount: data.amount,
        currency: data.currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        description: data.description,
        referenceId: data.referenceId,
        categoryId: data.categoryId,
        sourceId: data.sourceId,
        transferSourceId: data.transferSourceId,
        transferTargetId: data.transferTargetId,
        transactionDate: data.transactionDate,
        createdBy: data.createdBy,
      },
    });
  }

  async createTransferPair(data: {
    amount: string;
    currency: string;
    description?: string;
    transferSourceId: string;
    transferTargetId: string;
    transactionDate: Date;
    createdBy: string;
  }) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const expense = await tx.transaction.create({
        data: {
          type: "TRANSFER",
          amount: data.amount,
          currency: data.currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
          description: data.description ? `Transfer: ${data.description}` : "Transfer",
          transferSourceId: data.transferSourceId,
          transferTargetId: data.transferTargetId,
          transactionDate: data.transactionDate,
          createdBy: data.createdBy,
        },
      });

      return expense;
    });
  }

  async findById(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        source: true,
        transferSource: true,
        transferTarget: true,
      },
    });
  }

  async findByIdAndUser(id: string, userId: string) {
    return this.prisma.transaction.findFirst({
      where: { id, createdBy: userId },
      include: {
        category: true,
        source: true,
        transferSource: true,
        transferTarget: true,
      },
    });
  }

  async findAll(
    userId: string,
    pagination: PaginationInput,
    filters?: TransactionFilterInput,
    sort?: TransactionSortInput,
  ) {
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.currency) {
      where.currency = filters.currency;
    }

    if (filters?.sourceId) {
      where.OR = [
        { sourceId: filters.sourceId },
        { transferSourceId: filters.sourceId },
        { transferTargetId: filters.sourceId },
      ];
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.isCancelled !== undefined) {
      where.isCancelled = filters.isCancelled;
    }

    if (filters?.search) {
      where.description = { contains: filters.search, mode: "insensitive" };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (filters.dateFrom) {
        dateFilter.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        dateFilter.lte = new Date(filters.dateTo);
      }
      where.transactionDate = dateFilter;
    }

    const sortField = sort?.field ?? "transactionDate";
    const sortDirection = sort?.direction ?? "desc";

    const orderBy: Record<string, string> = {};
    orderBy[sortField] = sortDirection;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy,
        include: {
          category: true,
          source: true,
          transferSource: true,
          transferTarget: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return createPaginatedResult(transactions as unknown[], total, pagination) as unknown as {
      data: Record<string, unknown>[];
      pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
    };
  }

  async cancel(id: string, cancelledBy: string, cancelReason?: string) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy,
        cancelReason,
      },
    });
  }

  async archive(id: string) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async calculateBalance(userId: string, currency: string, dateFrom?: Date, dateTo?: Date): Promise<{ income: number; expense: number; net: number }> {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const whereBase = {
      createdBy: userId,
      currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
      isCancelled: false,
      isArchived: false,
      ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
    };

    const [incomeResult, expenseResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { ...whereBase, type: "INCOME" },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { ...whereBase, type: "EXPENSE" },
      }),
    ]);

    const income = Number(incomeResult._sum.amount ?? 0);
    const expense = Number(expenseResult._sum.amount ?? 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }

  async calculateBalanceByCurrency(userId: string, dateFrom?: Date, dateTo?: Date): Promise<Record<string, { income: number; expense: number; net: number }>> {
    const currencies = ["UZS", "USD", "EUR", "RUB", "GBP", "CNY"];
    const result: Record<string, { income: number; expense: number; net: number }> = {};

    for (const currency of currencies) {
      const balance = await this.calculateBalance(userId, currency, dateFrom, dateTo);
      if (balance.income > 0 || balance.expense > 0) {
        result[currency] = balance;
      }
    }

    return result;
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.transaction.count({
      where: { createdBy: userId, isArchived: false },
    });
  }

  async countByType(userId: string, type: string): Promise<number> {
    return this.prisma.transaction.count({
      where: { createdBy: userId, type: type as "INCOME" | "EXPENSE" | "TRANSFER", isArchived: false, isCancelled: false },
    });
  }

  async sumByCategory(userId: string, type: string, dateFrom?: Date, dateTo?: Date): Promise<Array<{ categoryId: string; categoryName: string; categoryEmoji: string; total: number }>> {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdBy: userId,
        type: type as "INCOME" | "EXPENSE",
        isCancelled: false,
        isArchived: false,
        categoryId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      },
      select: {
        amount: true,
        categoryId: true,
        category: {
          select: { name: true, emoji: true },
        },
      },
    });

    const grouped = new Map<string, { name: string; emoji: string; total: number }>();

    for (const tx of transactions as Array<{ amount: unknown; categoryId: string | null; category: { name: string; emoji: string } | null }>) {
      if (!tx.categoryId || !tx.category) continue;

      const existing = grouped.get(tx.categoryId);
      if (existing) {
        existing.total += Number(tx.amount);
      } else {
        grouped.set(tx.categoryId, {
          name: tx.category.name,
          emoji: tx.category.emoji,
          total: Number(tx.amount),
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        categoryEmoji: data.emoji,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async sumBySource(userId: string, type: string, dateFrom?: Date, dateTo?: Date): Promise<Array<{ sourceId: string; sourceName: string; sourceEmoji: string; total: number }>> {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdBy: userId,
        type: type as "INCOME" | "EXPENSE",
        isCancelled: false,
        isArchived: false,
        sourceId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      },
      select: {
        amount: true,
        sourceId: true,
        source: {
          select: { name: true, emoji: true },
        },
      },
    });

    const grouped = new Map<string, { name: string; emoji: string; total: number }>();

    for (const tx of transactions) {
      if (!tx.sourceId || !tx.source) continue;

      const existing = grouped.get(tx.sourceId);
      if (existing) {
        existing.total += Number(tx.amount);
      } else {
        grouped.set(tx.sourceId, {
          name: tx.source.name,
          emoji: tx.source.emoji,
          total: Number(tx.amount),
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([sourceId, data]) => ({
        sourceId,
        sourceName: data.name,
        sourceEmoji: data.emoji,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }
}
