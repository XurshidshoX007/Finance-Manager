import type { UsersRepository } from "./users.repository.js";
import type { AuditLogService } from "./audit-log.service.js";
import type { PaginationInput } from "../../shared/types/index.js";
import { Role } from "../../shared/types/index.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";

interface UserListItem {
  id: string;
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  isBlocked: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type PaginatedUserList = {
  data: UserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export class UsersService {
  private readonly usersRepo: UsersRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("users-service");

  constructor(usersRepo: UsersRepository, auditLogService: AuditLogService) {
    this.usersRepo = usersRepo;
    this.auditLogService = auditLogService;
  }

  async listUsers(
    pagination: PaginationInput,
    filters?: { role?: string; isActive?: boolean; isBlocked?: boolean },
    requesterRole?: string,
  ): Promise<PaginatedUserList> {
    if (requesterRole && requesterRole !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view users list");
    }
    return this.usersRepo.findAll(pagination, filters) as unknown as PaginatedUserList;
  }

  async getUser(id: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundError("User", id);
    }
    return user;
  }

  async changeRole(requesterId: string, targetUserId: string, newRole: string): Promise<void> {
    const requester = await this.usersRepo.findById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can change user roles");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot change your own role");
    }

    const target = await this.usersRepo.findById(targetUserId);
    if (!target) {
      throw new NotFoundError("User", targetUserId);
    }

    const oldRole = target.role;
    await this.usersRepo.updateUserRole(targetUserId, newRole);

    await this.auditLogService.logUpdate(requesterId, "USER", targetUserId, {
      field: "role",
      oldValue: oldRole,
      newValue: newRole,
    });

    this.logger.info({ requesterId, targetUserId, oldRole, newRole }, "User role changed");
  }

  async toggleActive(requesterId: string, targetUserId: string, isActive: boolean): Promise<void> {
    const requester = await this.usersRepo.findById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can toggle user active status");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot toggle your own active status");
    }

    await this.usersRepo.setUserActive(targetUserId, isActive);

    await this.auditLogService.logUpdate(requesterId, "USER", targetUserId, {
      field: "isActive",
      newValue: isActive,
    });

    this.logger.info({ requesterId, targetUserId, isActive }, "User active status toggled");
  }

  async toggleBlocked(
    requesterId: string,
    targetUserId: string,
    isBlocked: boolean,
  ): Promise<void> {
    const requester = await this.usersRepo.findById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can block/unblock users");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot block/unblock yourself");
    }

    await this.usersRepo.setUserBlocked(targetUserId, isBlocked);

    await this.auditLogService.logUpdate(requesterId, "USER", targetUserId, {
      field: "isBlocked",
      newValue: isBlocked,
    });

    this.logger.info({ requesterId, targetUserId, isBlocked }, "User blocked status toggled");
  }

  async getUserStats() {
    const total = await this.usersRepo.countUsers();
    const admins = await this.usersRepo.countUsersByRole(Role.ADMIN);
    const managers = await this.usersRepo.countUsersByRole(Role.MANAGER);
    const employees = await this.usersRepo.countUsersByRole(Role.EMPLOYEE);

    return {
      total,
      byRole: {
        admin: admins,
        manager: managers,
        employee: employees,
      },
    };
  }
}
