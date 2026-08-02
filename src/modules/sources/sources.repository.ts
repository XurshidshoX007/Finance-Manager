import type { PrismaClient } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { CreateSourceInput, UpdateSourceInput, SourceFilterInput } from "./sources.types.js";

export class SourcesRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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

  /**
   * Bir nechta manba balansini BITTA groupBy so'rovida hisoblaydi
   * (ilgari har bir manba uchun 2 ta aggregate — N+1 muammosi).
   */
  async calculateBalancesForSources(
    sources: Array<{ id: string; currency: string }>,
  ): Promise<Map<string, { income: number; expense: number; net: number }>> {
    const balances = new Map<string, { income: number; expense: number; net: number }>();
    for (const source of sources) {
      balances.set(source.id, { income: 0, expense: 0, net: 0 });
    }

    if (sources.length === 0) {
      return balances;
    }

    const currencyById = new Map(sources.map((s) => [s.id, s.currency]));

    const ids = sources.map((s) => s.id);

    const [direct, transfersOut, transfersIn] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ["sourceId", "type", "currency"],
        _sum: { amount: true },
        where: {
          sourceId: { in: ids },
          type: { in: ["INCOME", "EXPENSE"] },
          isCancelled: false,
          isArchived: false,
        },
      }) as Promise<
        Array<{
          sourceId: string | null;
          type: string;
          currency: string;
          _sum: { amount: unknown };
        }>
      >,
      this.prisma.transaction.groupBy({
        by: ["transferSourceId", "currency"],
        _sum: { amount: true },
        where: {
          transferSourceId: { in: ids },
          type: "TRANSFER",
          isCancelled: false,
          isArchived: false,
        },
      }) as Promise<
        Array<{ transferSourceId: string | null; currency: string; _sum: { amount: unknown } }>
      >,
      this.prisma.transaction.groupBy({
        by: ["transferTargetId", "currency"],
        _sum: { amount: true },
        where: {
          transferTargetId: { in: ids },
          type: "TRANSFER",
          isCancelled: false,
          isArchived: false,
        },
      }) as Promise<
        Array<{ transferTargetId: string | null; currency: string; _sum: { amount: unknown } }>
      >,
    ]);

    const apply = (
      id: string | null,
      currency: string,
      amount: number,
      kind: "income" | "expense",
    ): void => {
      if (!id) return;
      if (currencyById.get(id) !== currency) return;

      const entry = balances.get(id);
      if (!entry) return;

      entry[kind] += amount;
      entry.net = entry.income - entry.expense;
    };

    for (const row of direct) {
      apply(
        row.sourceId,
        row.currency,
        Number(row._sum.amount ?? 0),
        row.type === "INCOME" ? "income" : "expense",
      );
    }

    // O'tkazmalar: chiquvchi manbadan yechiladi, qabul qiluvchiga qo'shiladi.
    // Ilgari TRANSFER umuman hisobga olinmasdi va balanslar noto'g'ri chiqardi.
    for (const row of transfersOut) {
      apply(row.transferSourceId, row.currency, Number(row._sum.amount ?? 0), "expense");
    }

    for (const row of transfersIn) {
      apply(row.transferTargetId, row.currency, Number(row._sum.amount ?? 0), "income");
    }

    return balances;
  }

  async calculateSourceBalance(
    sourceId: string,
    currency: string,
  ): Promise<{ income: number; expense: number; net: number }> {
    const balances = await this.calculateBalancesForSources([{ id: sourceId, currency }]);
    return balances.get(sourceId) ?? { income: 0, expense: 0, net: 0 };
  }
}
