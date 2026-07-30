import type { AuditLogRepository } from "./audit-log.repository.js";
import type { AuditLogEntry, InputJsonValue, PaginationInput } from "../../shared/types/index.js";
import { getLogger } from "../../shared/logger/index.js";

export class AuditLogService {
  private readonly auditLogRepo: AuditLogRepository;
  private readonly logger = getLogger("audit-log-service");

  constructor(auditLogRepo: AuditLogRepository) {
    this.auditLogRepo = auditLogRepo;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.auditLogRepo.create(entry);
      this.logger.debug(
        { action: entry.action, entity: entry.entity, entityId: entry.entityId },
        "Audit log created",
      );
    } catch (error) {
      this.logger.error({ error, entry }, "Failed to create audit log");
    }
  }

  async logCreate(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "CREATE", entity, entityId, details });
  }

  async logUpdate(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "UPDATE", entity, entityId, details });
  }

  async logDelete(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "DELETE", entity, entityId, details });
  }

  async logArchive(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "ARCHIVE", entity, entityId, details });
  }

  async logRestore(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "RESTORE", entity, entityId, details });
  }

  async logCancel(userId: string, entity: string, entityId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "CANCEL", entity, entityId, details });
  }

  async logLogin(userId: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "LOGIN", entity: "USER", entityId: userId, details });
  }

  async logExport(userId: string, entity: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "EXPORT", entity, details });
  }

  async logImport(userId: string, entity: string, details?: InputJsonValue): Promise<void> {
    await this.log({ userId, action: "IMPORT", entity, details });
  }

  async getUserLogs(userId: string, pagination: PaginationInput) {
    return this.auditLogRepo.findByUser(userId, pagination);
  }

  async getEntityLogs(entity: string, entityId: string, pagination: PaginationInput) {
    return this.auditLogRepo.findByEntity(entity, entityId, pagination);
  }

  async getAllLogs(pagination: PaginationInput, filters?: { userId?: string; entity?: string; action?: string }) {
    return this.auditLogRepo.findAll(pagination, filters);
  }
}
