import type { SettingsRepository } from "./settings.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";

export class SettingsService {
  private readonly settingsRepo: SettingsRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("settings-service");

  constructor(settingsRepo: SettingsRepository, auditLogService: AuditLogService) {
    this.settingsRepo = settingsRepo;
    this.auditLogService = auditLogService;
  }

  async get(userId: string, key: string): Promise<string | null> {
    return this.settingsRepo.get(userId, key);
  }

  async set(userId: string, userRole: string, key: string, value: string): Promise<void> {
    this.requirePermission(userRole, Permission.SETTINGS_MANAGE);

    await this.settingsRepo.set(userId, key, value);

    await this.auditLogService.logUpdate(userId, "SETTING", key, { key, value });

    this.logger.info({ userId, key }, "Setting updated");
  }

  async getAll(userId: string): Promise<Array<{ key: string; value: string }>> {
    return this.settingsRepo.getByUser(userId);
  }

  async delete(userId: string, userRole: string, key: string): Promise<void> {
    this.requirePermission(userRole, Permission.SETTINGS_MANAGE);

    await this.settingsRepo.delete(userId, key);

    await this.auditLogService.logDelete(userId, "SETTING", key, { key });

    this.logger.info({ userId, key }, "Setting deleted");
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
