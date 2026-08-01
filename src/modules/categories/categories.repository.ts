import type { PrismaClient } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { CreateCategoryInput, UpdateCategoryInput, CategoryFilterInput, CreateCategoryGroupInput } from "./categories.types.js";

export class CategoriesRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: CreateCategoryInput, userId: string) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        type: data.type as "INCOME" | "EXPENSE",
        description: data.description,
        groupId: data.groupId,
        createdBy: userId,
      },
    });
  }

  async createMany(
    data: Array<{ name: string; emoji: string; color: string; type: "INCOME" | "EXPENSE" }>,
    userId: string,
  ): Promise<number> {
    const result = await this.prisma.category.createMany({
      data: data.map((item) => ({
        name: item.name,
        emoji: item.emoji,
        color: item.color,
        type: item.type,
        createdBy: userId,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async createGroup(data: CreateCategoryGroupInput, userId: string) {
    return this.prisma.categoryGroup.create({
      data: {
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        createdBy: userId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { group: true },
    });
  }

  async findByIdAndUser(id: string, userId: string) {
    return this.prisma.category.findFirst({
      where: { id, createdBy: userId, isArchived: false },
      include: { group: true },
    });
  }

  async findGroupById(id: string) {
    return this.prisma.categoryGroup.findUnique({
      where: { id },
      include: { categories: { where: { isArchived: false }, orderBy: { name: "asc" } } },
    });
  }

  async findAll(userId: string, pagination: PaginationInput, filters?: CategoryFilterInput) {
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.groupId) {
      where.groupId = filters.groupId;
    }

    if (filters?.isArchived !== undefined) {
      where.isArchived = filters.isArchived;
    }

    if (filters?.search) {
      where.name = { contains: filters.search, mode: "insensitive" };
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        include: { group: true },
      }),
      this.prisma.category.count({ where }),
    ]);

    return createPaginatedResult(categories, total, pagination);
  }

  async findActiveByUser(userId: string, type?: string) {
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
    };

    if (type) {
      where.type = type;
    }

    return this.prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: { group: true },
    });
  }

  async findGroupsByUser(userId: string) {
    return this.prisma.categoryGroup.findMany({
      where: { createdBy: userId, isArchived: false },
      orderBy: { name: "asc" },
      include: { categories: { where: { isArchived: false }, orderBy: { name: "asc" } } },
    });
  }

  async findByNameAndUser(name: string, type: string, userId: string) {
    return this.prisma.category.findFirst({
      where: { name, type: type as "INCOME" | "EXPENSE", createdBy: userId, isArchived: false },
    });
  }

  async update(id: string, data: UpdateCategoryInput) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.emoji !== undefined) updateData.emoji = data.emoji;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;

    return this.prisma.category.update({
      where: { id },
      data: updateData,
    });
  }

  async archive(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string) {
    return this.prisma.category.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
    });
  }

  async archiveGroup(id: string) {
    return this.prisma.categoryGroup.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.category.count({
      where: { createdBy: userId, isArchived: false },
    });
  }

  async countByType(userId: string, type: string): Promise<number> {
    return this.prisma.category.count({
      where: { createdBy: userId, type: type as "INCOME" | "EXPENSE", isArchived: false },
    });
  }

  async calculateCategoryStats(categoryId: string, currency: string): Promise<{ total: number; count: number }> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      _count: true,
      where: {
        categoryId,
        currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        isCancelled: false,
        isArchived: false,
      },
    });

    return {
      total: Number(result._sum.amount ?? 0),
      count: result._count,
    };
  }
}
