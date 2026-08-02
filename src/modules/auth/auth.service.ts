import type { AuthRepository } from "./auth.repository.js";
import type { LoginResponse } from "./types.js";
import type { Logger } from "pino";
import { getLogger } from "../../shared/logger/index.js";
import { parseAdminIds } from "../../shared/utils/index.js";
import { loadConfig } from "../../shared/config/index.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors/index.js";
import { Role, ROLE_PERMISSIONS, type Permission } from "../../shared/types/index.js";

export class AuthService {
  /** `lastLoginAt` ni shu oraliqdan tez-tez yangilamaymiz. */
  private static readonly LAST_LOGIN_THROTTLE_MS = 5 * 60 * 1000;

  private readonly authRepo: AuthRepository;
  private readonly logger: Logger;
  private readonly adminTelegramIds: bigint[];

  constructor(authRepo: AuthRepository) {
    this.authRepo = authRepo;
    this.logger = getLogger("auth-service");
    const config = loadConfig();
    this.adminTelegramIds = parseAdminIds(config.ADMIN_TELEGRAM_IDS);
  }

  async authenticate(telegramId: bigint, firstName: string, lastName?: string, username?: string, languageCode?: string): Promise<LoginResponse> {
    this.logger.info({ telegramId: telegramId.toString() }, "Authenticating user");

    const existingUser = await this.authRepo.findUserByTelegramId(telegramId);

    if (existingUser) {
      if (existingUser.isBlocked) {
        throw new ForbiddenError("Your account has been blocked. Contact administrator.");
      }

      if (!existingUser.isActive) {
        throw new ForbiddenError("Your account has been deactivated. Contact administrator.");
      }

      // Har bir tugma bosilishida 2 ta UPDATE yuborilardi.
      // Endi faqat profil haqiqatan o'zgargan bo'lsa yoki
      // oxirgi kirish 5 daqiqadan eski bo'lsa yoziladi.
      const profileChanged =
        existingUser.firstName !== firstName ||
        (lastName !== undefined && existingUser.lastName !== lastName) ||
        (username !== undefined && existingUser.username !== username) ||
        (languageCode !== undefined && existingUser.languageCode !== languageCode);

      const lastLoginStale =
        !existingUser.lastLoginAt ||
        Date.now() - existingUser.lastLoginAt.getTime() > AuthService.LAST_LOGIN_THROTTLE_MS;

      if (profileChanged || lastLoginStale) {
        const profileUpdateData: {
          firstName: string;
          lastName?: string;
          username?: string;
          languageCode?: string;
          lastLoginAt?: Date;
        } = { firstName };
        if (lastName !== undefined) profileUpdateData.lastName = lastName;
        if (username !== undefined) profileUpdateData.username = username;
        if (languageCode !== undefined) profileUpdateData.languageCode = languageCode;
        if (lastLoginStale) profileUpdateData.lastLoginAt = new Date();

        // Ikkita alohida UPDATE o'rniga bitta
        await this.authRepo.updateUserProfile(existingUser.id, profileUpdateData);
      }

      this.logger.debug({ userId: existingUser.id }, "User authenticated");

      return {
        user: {
          id: existingUser.id,
          telegramId: existingUser.telegramId.toString(),
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          username: existingUser.username,
          role: existingUser.role,
          isActive: existingUser.isActive,
        },
        isFirstLogin: false,
      };
    }

    const isAdmin = this.adminTelegramIds.includes(telegramId);
    const role = isAdmin ? Role.ADMIN : Role.EMPLOYEE;

    const newUser = await this.authRepo.createUser({
      telegramId,
      firstName,
      lastName,
      username,
      languageCode,
      role,
    });

    this.logger.info({ userId: newUser.id, role }, "New user registered");

    return {
      user: {
        id: newUser.id,
        telegramId: newUser.telegramId.toString(),
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        username: newUser.username,
        role: newUser.role,
        isActive: newUser.isActive,
      },
      isFirstLogin: true,
    };
  }

  async getUserById(id: string) {
    const user = await this.authRepo.findUserById(id);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    return user;
  }

  async getUserByTelegramId(telegramId: bigint) {
    const user = await this.authRepo.findUserByTelegramId(telegramId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    return user;
  }

  hasPermission(userRole: Role, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    return permissions.includes(permission);
  }

  requirePermission(userRole: Role, permission: Permission): void {
    if (!this.hasPermission(userRole, permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }

  async changeUserRole(requesterId: string, targetUserId: string, newRole: Role): Promise<void> {
    const requester = await this.authRepo.findUserById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can change user roles");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot change your own role");
    }

    await this.authRepo.updateUserRole(targetUserId, newRole);
    this.logger.info(
      { requesterId, targetUserId, newRole },
      "User role changed",
    );
  }

  async toggleUserActive(requesterId: string, targetUserId: string, isActive: boolean): Promise<void> {
    const requester = await this.authRepo.findUserById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can toggle user active status");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot toggle your own active status");
    }

    await this.authRepo.setUserActive(targetUserId, isActive);
    this.logger.info(
      { requesterId, targetUserId, isActive },
      "User active status toggled",
    );
  }

  async toggleUserBlocked(requesterId: string, targetUserId: string, isBlocked: boolean): Promise<void> {
    const requester = await this.authRepo.findUserById(requesterId);
    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can block/unblock users");
    }

    if (requesterId === targetUserId) {
      throw new ForbiddenError("Cannot block/unblock yourself");
    }

    await this.authRepo.setUserBlocked(targetUserId, isBlocked);
    this.logger.info(
      { requesterId, targetUserId, isBlocked },
      "User blocked status toggled",
    );
  }
}
