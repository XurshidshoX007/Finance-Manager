import type { PrismaClient } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";

export class UsersRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findAll(pagination: PaginationInput, filters?: { role?: string; isActive?: boolean; isBlocked?: boolean }) {
    const where: Record<string, unknown> = { isArchived: false };

    if (filters?.role) {
      where.role = filters.role;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.isBlocked !== undefined) {
      where.isBlocked = filters.isBlocked;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
          isActive: true,
          isBlocked: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginatedResult(users, total, pagination);
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, isArchived: false },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        isActive: true,
        isBlocked: true,
        languageCode: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByTelegramId(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as "ADMIN" | "MANAGER" | "EMPLOYEE" },
    });
  }

  async setUserActive(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async setUserBlocked(id: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
    });
  }

  async countUsers(): Promise<number> {
    return this.prisma.user.count({ where: { isArchived: false } });
  }

  async countUsersByRole(role: string): Promise<number> {
    return this.prisma.user.count({ where: { role: role as "ADMIN" | "MANAGER" | "EMPLOYEE", isArchived: false } });
  }
}
