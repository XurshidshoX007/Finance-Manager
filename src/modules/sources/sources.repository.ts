import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { getLogger } from "../../shared/logger/index.js";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { CreateSourceInput, UpdateSourceInput, SourceFilterInput } from "./sources.types.js";

export class SourcesRepository {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = getLogger("sources-repository");
  }

  async create(data: CreateSourceInput, userId: string) {
    return this.prisma.source.create({
      data: {
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        currency: data.currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        description: data.description,
        createdBy: userId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.source.findUnique({
      where: { id },
    });
  }

  async findByIdAndUser(id: string, userId: string) {
    return this.prisma.source.findFirst({
      where: { id, createdBy: userId, isArchived: false },
    });
  }

  async findAll(userId: string, pagination: PaginationInput, filters?: SourceFilterInput) {
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
    };

    if (filters?.currency) {
      where.currency = filters.currency;
    }

    if (filters?.isArchived !== undefined) {
      where.isArchived = filters.isArchived;
    }

    if (filters?.search) {
      where.name = { contains: filters.search, mode: "insensitive" };
    }

    const [sources, total] = await Promise.all([
      this.prisma.source.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.source.count({ where }),
    ]);

    return createPaginatedResult(sources, total, pagination);
  }

  async findActiveByUser(userId: string) {
    return this.prisma.source.findMany({
      where: { createdBy: userId, isArchived: false },
      orderBy: { name: "asc" },
    });
  }

  async findByNameAndUser(name: string, userId: string) {
    return this.prisma.source.findFirst({
      where: { name, createdBy: userId, isArchived: false },
    });
  }

  async update(id: string, data: UpdateSourceInput) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.description !== undefined) updateData.description = data.description;

    return this.prisma.source.update({
      where: { id },
      data: updateData,
    });
  }

  async archive(id: string) {
    return this.prisma.source.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string) {
    return this.prisma.source.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.source.count({
      where: { createdBy: userId, isArchived: false },
    });
  }

  async calculateSourceBalance(sourceId: string, currency: string): Promise<{ income: number; expense: number; net: number }> {
    const [incomeResult, expenseResult] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          sourceId,
          currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
          type: "INCOME",
          isCancelled: false,
          isArchived: false,
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          sourceId,
          currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
          type: "EXPENSE",
          isCancelled: false,
          isArchived: false,
        },
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
}
