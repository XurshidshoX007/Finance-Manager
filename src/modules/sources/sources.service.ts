import type { SourcesRepository } from "./sources.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import type { CreateSourceInput, UpdateSourceInput, SourceFilterInput } from "./sources.types.js";
import type { PaginationInput, PaginatedResult } from "../../shared/types/index.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";

interface SourceWithBalance {
  id: string;
  name: string;
  emoji: string;
  color: string;
  currency: string;
  description: string | null;
  isSystem: boolean;
  balance: { income: number; expense: number; net: number };
  createdAt: Date;
  updatedAt: Date;
}

export class SourcesService {
  private readonly sourcesRepo: SourcesRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("sources-service");

  constructor(sourcesRepo: SourcesRepository, auditLogService: AuditLogService) {
    this.sourcesRepo = sourcesRepo;
    this.auditLogService = auditLogService;
  }

  async create(userId: string, userRole: string, input: CreateSourceInput): Promise<SourceWithBalance> {
    this.requirePermission(userRole, "SOURCES_CREATE");

    const existing = await this.sourcesRepo.findByNameAndUser(input.name, userId);
    if (existing) {
      throw new ConflictError(`Source with name '${input.name}' already exists`);
    }

    const source = await this.sourcesRepo.create(input, userId);

    await this.auditLogService.logCreate(userId, "SOURCE", source.id, {
      name: source.name,
      currency: source.currency,
    });

    this.logger.info({ sourceId: source.id, userId }, "Source created");

    return {
      id: source.id,
      name: source.name,
      emoji: source.emoji,
      color: source.color,
      currency: source.currency,
      description: source.description,
      isSystem: source.isSystem,
      balance: { income: 0, expense: 0, net: 0 },
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async getById(id: string, userId: string, userRole: string): Promise<SourceWithBalance> {
    this.requirePermission(userRole, "SOURCES_READ");

    const source = await this.sourcesRepo.findByIdAndUser(id, userId);
    if (!source) {
      throw new NotFoundError("Source", id);
    }

    const balance = await this.sourcesRepo.calculateSourceBalance(source.id, source.currency);

    return this.mapSourceWithBalance(source as unknown as Record<string, unknown>, balance);
  }

  async list(
    userId: string,
    userRole: string,
    pagination: PaginationInput,
    filters?: SourceFilterInput,
  ): Promise<PaginatedResult<SourceWithBalance>> {
    this.requirePermission(userRole, "SOURCES_READ");

    const result = await this.sourcesRepo.findAll(userId, pagination, filters);

    const sourcesWithBalance = await Promise.all(
      result.data.map(async (source: unknown) => {
        const src = source as Record<string, unknown>;
        const balance = await this.sourcesRepo.calculateSourceBalance(src.id as string, src.currency as string);
        return this.mapSourceWithBalance(src, balance);
      }),
    );

    return {
      data: sourcesWithBalance,
      pagination: result.pagination,
    };
  }

  async listActive(userId: string, userRole: string): Promise<SourceWithBalance[]> {
    this.requirePermission(userRole, "SOURCES_READ");

    const sources = await this.sourcesRepo.findActiveByUser(userId);

    return Promise.all(
      sources.map(async (source: unknown) => {
        const src = source as Record<string, unknown>;
        const balance = await this.sourcesRepo.calculateSourceBalance(src.id as string, src.currency as string);
        return this.mapSourceWithBalance(src, balance);
      }),
    );
  }

  async update(userId: string, userRole: string, id: string, input: UpdateSourceInput): Promise<SourceWithBalance> {
    this.requirePermission(userRole, "SOURCES_UPDATE");

    const source = await this.sourcesRepo.findByIdAndUser(id, userId);
    if (!source) {
      throw new NotFoundError("Source", id);
    }

    if (input.name && input.name !== source.name) {
      const existing = await this.sourcesRepo.findByNameAndUser(input.name, userId);
      if (existing) {
        throw new ConflictError(`Source with name '${input.name}' already exists`);
      }
    }

    const updated = await this.sourcesRepo.update(id, input);

    await this.auditLogService.logUpdate(userId, "SOURCE", id, {
      changes: input,
    });

    this.logger.info({ sourceId: id, userId }, "Source updated");

    const balance = await this.sourcesRepo.calculateSourceBalance(updated.id, updated.currency);

    return this.mapSourceWithBalance(updated as unknown as Record<string, unknown>, balance);
  }

  async archive(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, "SOURCES_DELETE");

    const source = await this.sourcesRepo.findByIdAndUser(id, userId);
    if (!source) {
      throw new NotFoundError("Source", id);
    }

    await this.sourcesRepo.archive(id);

    await this.auditLogService.logArchive(userId, "SOURCE", id, {
      name: source.name,
    });

    this.logger.info({ sourceId: id, userId }, "Source archived");
  }

  async restore(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, "SOURCES_DELETE");

    const source = await this.sourcesRepo.findById(id);
    if (!source || !source.isArchived) {
      throw new NotFoundError("Archived source", id);
    }

    await this.sourcesRepo.restore(id);

    await this.auditLogService.logRestore(userId, "SOURCE", id, {
      name: source.name,
    });

    this.logger.info({ sourceId: id, userId }, "Source restored");
  }

  private mapSourceWithBalance(source: Record<string, unknown>, balance: { income: number; expense: number; net: number }): SourceWithBalance {
    return {
      id: source.id as string,
      name: source.name as string,
      emoji: source.emoji as string,
      color: source.color as string,
      currency: source.currency as string,
      description: source.description as string | null,
      isSystem: source.isSystem as boolean,
      balance,
      createdAt: source.createdAt as Date,
      updatedAt: source.updatedAt as Date,
    };
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
