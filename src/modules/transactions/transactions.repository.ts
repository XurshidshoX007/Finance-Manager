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

    // Ikkita alohida aggregate o'rniga bitta groupBy
    const grouped = await this.prisma.transaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { ...whereBase, type: { in: ["INCOME", "EXPENSE"] } },
    });

    let income = 0;
    let expense = 0;

    for (const row of grouped) {
      const amount = Number(row._sum.amount ?? 0);
      if (row.type === "INCOME") income = amount;
      else if (row.type === "EXPENSE") expense = amount;
    }

    return {
      income,
      expense,
      net: income - expense,
    };
  }

  /**
   * Barcha valyutalar bo'yicha balans — BITTA so'rovda.
   * Ilgari har bir valyuta uchun ketma-ket 2 tadan, jami 12 ta
   * so'rov yuborilardi.
   */
  async calculateBalanceByCurrency(userId: string, dateFrom?: Date, dateTo?: Date): Promise<Record<string, { income: number; expense: number; net: number }>> {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const grouped = await this.prisma.transaction.groupBy({
      by: ["currency", "type"],
      _sum: { amount: true },
      where: {
        createdBy: userId,
        type: { in: ["INCOME", "EXPENSE"] },
        isCancelled: false,
        isArchived: false,
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      },
    });

    const result: Record<string, { income: number; expense: number; net: number }> = {};

    for (const row of grouped) {
      const amount = Number(row._sum.amount ?? 0);
      if (amount === 0) continue;

      const entry = result[row.currency] ?? { income: 0, expense: 0, net: 0 };
      if (row.type === "INCOME") entry.income += amount;
      else entry.expense += amount;
      entry.net = entry.income - entry.expense;

      result[row.currency] = entry;
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

    // Ilgari BARCHA tranzaksiyalar xotiraga yuklanib, JS'da yig'ilardi —
    // yillik hisobotda bu o'n minglab qatorni anglatardi.
    const grouped = (await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: {
        createdBy: userId,
        type: type as "INCOME" | "EXPENSE",
        isCancelled: false,
        isArchived: false,
        categoryId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      },
    })) as Array<{ categoryId: string | null; _sum: { amount: unknown } }>;

    const categoryIds = grouped
      .map((row) => row.categoryId)
      .filter((id): id is string => Boolean(id));

    if (categoryIds.length === 0) return [];

    const categories = (await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, emoji: true },
    })) as Array<{ id: string; name: string; emoji: string }>;

    const metaById = new Map(categories.map((c) => [c.id, c]));

    return grouped
      .map((row) => {
        const meta = row.categoryId ? metaById.get(row.categoryId) : undefined;
        return {
          categoryId: row.categoryId ?? "",
          categoryName: meta?.name ?? "Noma'lum",
          categoryEmoji: meta?.emoji ?? "📝",
          total: Number(row._sum.amount ?? 0),
        };
      })
      .filter((row) => row.categoryId.length > 0)
      .sort((a, b) => b.total - a.total);
  }

  async sumBySource(userId: string, type: string, dateFrom?: Date, dateTo?: Date): Promise<Array<{ sourceId: string; sourceName: string; sourceEmoji: string; total: number }>> {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const grouped = (await this.prisma.transaction.groupBy({
      by: ["sourceId"],
      _sum: { amount: true },
      where: {
        createdBy: userId,
        type: type as "INCOME" | "EXPENSE",
        isCancelled: false,
        isArchived: false,
        sourceId: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}),
      },
    })) as Array<{ sourceId: string | null; _sum: { amount: unknown } }>;

    const sourceIds = grouped
      .map((row) => row.sourceId)
      .filter((id): id is string => Boolean(id));

    if (sourceIds.length === 0) return [];

    const sources = (await this.prisma.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true, emoji: true },
    })) as Array<{ id: string; name: string; emoji: string }>;

    const metaById = new Map(sources.map((s) => [s.id, s]));

    return grouped
      .map((row) => {
        const meta = row.sourceId ? metaById.get(row.sourceId) : undefined;
        return {
          sourceId: row.sourceId ?? "",
          sourceName: meta?.name ?? "Noma'lum",
          sourceEmoji: meta?.emoji ?? "💰",
          total: Number(row._sum.amount ?? 0),
        };
      })
      .filter((row) => row.sourceId.length > 0)
      .sort((a, b) => b.total - a.total);
  }
}
