import type { CategoriesRepository } from "./categories.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryFilterInput,
  CreateCategoryGroupInput,
} from "./categories.types.js";
import type { PaginationInput, PaginatedResult, Permission } from "../../shared/types/index.js";
import { ROLE_PERMISSIONS } from "../../shared/types/index.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";
import { DEFAULT_CATEGORIES } from "./default-categories.js";

interface CategoryWithStats {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: string;
  description: string | null;
  groupId: string | null;
  groupName: string | null;
  stats: { total: number; count: number };
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryGroupWithCategories {
  id: string;
  name: string;
  emoji: string;
  color: string;
  categories: CategoryWithStats[];
  createdAt: Date;
  updatedAt: Date;
}

export class CategoriesService {
  private readonly categoriesRepo: CategoriesRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("categories-service");

  constructor(categoriesRepo: CategoriesRepository, auditLogService: AuditLogService) {
    this.categoriesRepo = categoriesRepo;
    this.auditLogService = auditLogService;
  }

  async create(
    userId: string,
    userRole: string,
    input: CreateCategoryInput,
  ): Promise<CategoryWithStats> {
    this.requirePermission(userRole, "CATEGORIES_CREATE");

    const existing = await this.categoriesRepo.findByNameAndUser(input.name, input.type, userId);
    if (existing) {
      throw new ConflictError(
        `Category with name '${input.name}' and type '${input.type}' already exists`,
      );
    }

    if (input.groupId) {
      const group = await this.categoriesRepo.findGroupById(input.groupId);
      if (!group || group.createdBy !== userId) {
        throw new NotFoundError("Category group", input.groupId);
      }
    }

    const category = await this.categoriesRepo.create(input, userId);

    await this.auditLogService.logCreate(userId, "CATEGORY", category.id, {
      name: category.name,
      type: category.type,
    });

    this.logger.info({ categoryId: category.id, userId }, "Category created");

    return {
      id: category.id,
      name: category.name,
      emoji: category.emoji,
      color: category.color,
      type: category.type,
      description: category.description,
      groupId: category.groupId,
      groupName: null,
      stats: { total: 0, count: 0 },
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async createGroup(
    userId: string,
    userRole: string,
    input: CreateCategoryGroupInput,
  ): Promise<CategoryGroupWithCategories> {
    this.requirePermission(userRole, "CATEGORIES_CREATE");

    const group = await this.categoriesRepo.createGroup(input, userId);

    await this.auditLogService.logCreate(userId, "CATEGORY_GROUP", group.id, {
      name: group.name,
    });

    this.logger.info({ groupId: group.id, userId }, "Category group created");

    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      color: group.color,
      categories: [],
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * Foydalanuvchida hech qanday kategoriya bo'lmasa, standart
   * (default) kirim/chiqim kategoriyalarini yaratadi.
   * Ro'yxat ochilganda avtomatik chaqiriladi, shuning uchun
   * yangi foydalanuvchi bo'sh ro'yxat ko'rmaydi.
   */
  async ensureDefaults(userId: string): Promise<number> {
    const count = await this.categoriesRepo.countByUser(userId);
    if (count > 0) {
      return 0;
    }

    const created = await this.categoriesRepo.createMany(DEFAULT_CATEGORIES, userId);

    if (created > 0) {
      await this.auditLogService.logCreate(userId, "CATEGORY", "default-seed", {
        count: created,
      });
      this.logger.info({ userId, count: created }, "Default categories created");
    }

    return created;
  }

  async getById(id: string, userId: string, userRole: string): Promise<CategoryWithStats> {
    this.requirePermission(userRole, "CATEGORIES_READ");

    const category = await this.categoriesRepo.findByIdAndUser(id, userId);
    if (!category) {
      throw new NotFoundError("Category", id);
    }

    const stats = await this.categoriesRepo.calculateCategoryStats(category.id, "UZS");

    return this.mapCategoryWithStats(category as unknown as Record<string, unknown>, stats);
  }

  async list(
    userId: string,
    userRole: string,
    pagination: PaginationInput,
    filters?: CategoryFilterInput,
  ): Promise<PaginatedResult<CategoryWithStats>> {
    this.requirePermission(userRole, "CATEGORIES_READ");

    await this.ensureDefaults(userId);

    const result = await this.categoriesRepo.findAll(userId, pagination, filters);

    const rows = result.data as unknown as Array<Record<string, unknown>>;
    const statsMap = await this.categoriesRepo.calculateStatsForCategories(
      rows.map((cat) => cat.id as string),
      "UZS",
    );

    return {
      data: rows.map((cat) =>
        this.mapCategoryWithStats(cat, statsMap.get(cat.id as string) ?? { total: 0, count: 0 }),
      ),
      pagination: result.pagination,
    };
  }

  async listActive(userId: string, userRole: string, type?: string): Promise<CategoryWithStats[]> {
    this.requirePermission(userRole, "CATEGORIES_READ");

    await this.ensureDefaults(userId);

    const categories = (await this.categoriesRepo.findActiveByUser(
      userId,
      type,
    )) as unknown as Array<Record<string, unknown>>;

    const statsMap = await this.categoriesRepo.calculateStatsForCategories(
      categories.map((cat) => cat.id as string),
      "UZS",
    );

    return categories.map((cat) =>
      this.mapCategoryWithStats(cat, statsMap.get(cat.id as string) ?? { total: 0, count: 0 }),
    );
  }

  async listGroups(userId: string, userRole: string): Promise<CategoryGroupWithCategories[]> {
    this.requirePermission(userRole, "CATEGORIES_READ");

    const groups = await this.categoriesRepo.findGroupsByUser(userId);

    return groups.map((group: Record<string, unknown>) => ({
      id: group.id as string,
      name: group.name as string,
      emoji: group.emoji as string,
      color: group.color as string,
      categories: (group.categories as Array<Record<string, unknown>>).map((cat) => ({
        ...this.mapCategoryWithStats(cat, { total: 0, count: 0 }),
        groupName: group.name as string,
      })),
      createdAt: group.createdAt as Date,
      updatedAt: group.updatedAt as Date,
    }));
  }

  async update(
    userId: string,
    userRole: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryWithStats> {
    this.requirePermission(userRole, "CATEGORIES_UPDATE");

    const category = await this.categoriesRepo.findByIdAndUser(id, userId);
    if (!category) {
      throw new NotFoundError("Category", id);
    }

    if (input.name && input.name !== category.name) {
      const existing = await this.categoriesRepo.findByNameAndUser(
        input.name,
        category.type,
        userId,
      );
      if (existing) {
        throw new ConflictError(`Category with name '${input.name}' already exists`);
      }
    }

    const updated = await this.categoriesRepo.update(id, input);

    await this.auditLogService.logUpdate(userId, "CATEGORY", id, {
      changes: input,
    });

    this.logger.info({ categoryId: id, userId }, "Category updated");

    const stats = await this.categoriesRepo.calculateCategoryStats(updated.id, "UZS");

    return {
      id: updated.id,
      name: updated.name,
      emoji: updated.emoji,
      color: updated.color,
      type: updated.type,
      description: updated.description,
      groupId: updated.groupId,
      groupName: null,
      stats,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async archive(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, "CATEGORIES_DELETE");

    const category = await this.categoriesRepo.findByIdAndUser(id, userId);
    if (!category) {
      throw new NotFoundError("Category", id);
    }

    await this.categoriesRepo.archive(id);

    await this.auditLogService.logArchive(userId, "CATEGORY", id, {
      name: category.name,
    });

    this.logger.info({ categoryId: id, userId }, "Category archived");
  }

  async restore(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, "CATEGORIES_DELETE");

    const category = await this.categoriesRepo.findById(id);
    if (!category || !category.isArchived) {
      throw new NotFoundError("Archived category", id);
    }

    await this.categoriesRepo.restore(id);

    await this.auditLogService.logRestore(userId, "CATEGORY", id, {
      name: category.name,
    });

    this.logger.info({ categoryId: id, userId }, "Category restored");
  }

  private mapCategoryWithStats(
    category: Record<string, unknown>,
    stats: { total: number; count: number },
  ): CategoryWithStats {
    const group = category.group as Record<string, unknown> | null;
    return {
      id: category.id as string,
      name: category.name as string,
      emoji: category.emoji as string,
      color: category.color as string,
      type: category.type as string,
      description: category.description as string | null,
      groupId: category.groupId as string | null,
      groupName: group?.name as string | null,
      stats,
      createdAt: category.createdAt as Date,
      updatedAt: category.updatedAt as Date,
    };
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
