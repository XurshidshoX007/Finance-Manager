import type { PrismaClient } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { AuditLogEntry } from "../../shared/types/index.js";

export class AuditLogRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(entry: AuditLogEntry) {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ?? undefined,
      },
    });
  }

  async findByUser(userId: string, pagination: PaginationInput) {
    const where = { userId };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(logs, total, pagination);
  }

  async findByEntity(entity: string, entityId: string, pagination: PaginationInput) {
    const where = { entity, entityId };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(logs, total, pagination);
  }

  async findByAction(action: string, pagination: PaginationInput) {
    const where = { action };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(logs, total, pagination);
  }

  async findAll(pagination: PaginationInput, filters?: { userId?: string; entity?: string; action?: string }) {
    const where: Record<string, unknown> = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.entity) {
      where.entity = filters.entity;
    }
    if (filters?.action) {
      where.action = filters.action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResult(logs, total, pagination);
  }
}
