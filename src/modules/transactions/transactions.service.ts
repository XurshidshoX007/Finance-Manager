import type { TransactionsRepository } from "./transactions.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import type {
  CreateTransactionInput,
  CreateTransferInput,
  CancelTransactionInput,
  TransactionFilterInput,
  TransactionSortInput,
} from "./transactions.types.js";
import type { PaginationInput, PaginatedResult, Permission } from "../../shared/types/index.js";
import { ROLE_PERMISSIONS } from "../../shared/types/index.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";
import { toDecimal } from "../../shared/utils/index.js";

interface TransactionWithDetails {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  referenceId: string | null;
  isCancelled: boolean;
  cancelledAt: Date | null;
  cancelReason: string | null;
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; emoji: string } | null;
  source: { id: string; name: string; emoji: string } | null;
  transferSource: { id: string; name: string; emoji: string } | null;
  transferTarget: { id: string; name: string; emoji: string } | null;
}

interface BalanceResult {
  income: number;
  expense: number;
  net: number;
}

export class TransactionsService {
  private readonly transactionsRepo: TransactionsRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("transactions-service");

  constructor(transactionsRepo: TransactionsRepository, auditLogService: AuditLogService) {
    this.transactionsRepo = transactionsRepo;
    this.auditLogService = auditLogService;
  }

  async create(
    userId: string,
    userRole: string,
    input: CreateTransactionInput,
  ): Promise<TransactionWithDetails> {
    this.requirePermission(userRole, "TRANSACTIONS_CREATE");

    const amount = toDecimal(input.amount);
    if (!amount.greaterThan(0)) {
      throw new ValidationError("Amount must be greater than 0");
    }

    const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();

    const transaction = await this.transactionsRepo.create({
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      referenceId: input.referenceId,
      categoryId: input.categoryId,
      sourceId: input.sourceId,
      transactionDate,
      createdBy: userId,
    });

    await this.auditLogService.logCreate(userId, "TRANSACTION", transaction.id, {
      type: input.type,
      amount: input.amount,
      currency: input.currency,
    });

    this.logger.info({ transactionId: transaction.id, userId }, "Transaction created");

    const full = await this.transactionsRepo.findById(transaction.id);
    return this.mapTransactionWithDetails(full as unknown as Record<string, unknown>);
  }

  async createTransfer(
    userId: string,
    userRole: string,
    input: CreateTransferInput,
  ): Promise<TransactionWithDetails> {
    this.requirePermission(userRole, "TRANSACTIONS_CREATE");

    const amount = toDecimal(input.amount);
    if (!amount.greaterThan(0)) {
      throw new ValidationError("Amount must be greater than 0");
    }

    if (input.transferSourceId === input.transferTargetId) {
      throw new ValidationError("Source and target must be different");
    }

    const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();

    const transaction = await this.transactionsRepo.createTransferPair({
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      transferSourceId: input.transferSourceId,
      transferTargetId: input.transferTargetId,
      transactionDate,
      createdBy: userId,
    });

    await this.auditLogService.logCreate(userId, "TRANSACTION", transaction.id, {
      type: "TRANSFER",
      amount: input.amount,
      currency: input.currency,
      transferSourceId: input.transferSourceId,
      transferTargetId: input.transferTargetId,
    });

    this.logger.info({ transactionId: transaction.id, userId }, "Transfer created");

    const full = await this.transactionsRepo.findById(transaction.id);
    return this.mapTransactionWithDetails(full as unknown as Record<string, unknown>);
  }

  async getById(id: string, userId: string, userRole: string): Promise<TransactionWithDetails> {
    this.requirePermission(userRole, "TRANSACTIONS_READ");

    const transaction = await this.transactionsRepo.findByIdAndUser(id, userId);
    if (!transaction) {
      throw new NotFoundError("Transaction", id);
    }

    return this.mapTransactionWithDetails(transaction as unknown as Record<string, unknown>);
  }

  async list(
    userId: string,
    userRole: string,
    pagination: PaginationInput,
    filters?: TransactionFilterInput,
    sort?: TransactionSortInput,
  ): Promise<PaginatedResult<TransactionWithDetails>> {
    this.requirePermission(userRole, "TRANSACTIONS_READ");

    const result = await this.transactionsRepo.findAll(userId, pagination, filters, sort);

    return {
      data: result.data.map((tx) => this.mapTransactionWithDetails(tx as Record<string, unknown>)),
      pagination: result.pagination,
    };
  }

  async cancel(
    userId: string,
    userRole: string,
    id: string,
    input: CancelTransactionInput,
  ): Promise<void> {
    this.requirePermission(userRole, "TRANSACTIONS_CANCEL");

    const transaction = await this.transactionsRepo.findByIdAndUser(id, userId);
    if (!transaction) {
      throw new NotFoundError("Transaction", id);
    }

    if (transaction.isCancelled) {
      throw new ConflictError("Transaction is already cancelled");
    }

    await this.transactionsRepo.cancel(id, userId, input.cancelReason);

    await this.auditLogService.logCancel(userId, "TRANSACTION", id, {
      cancelReason: input.cancelReason,
    });

    this.logger.info({ transactionId: id, userId }, "Transaction cancelled");
  }

  async archive(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, "TRANSACTIONS_UPDATE");

    const transaction = await this.transactionsRepo.findByIdAndUser(id, userId);
    if (!transaction) {
      throw new NotFoundError("Transaction", id);
    }

    await this.transactionsRepo.archive(id);

    await this.auditLogService.logArchive(userId, "TRANSACTION", id);

    this.logger.info({ transactionId: id, userId }, "Transaction archived");
  }

  async getBalance(
    userId: string,
    userRole: string,
    currency?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<BalanceResult | Record<string, BalanceResult>> {
    this.requirePermission(userRole, "REPORTS_READ");

    if (currency) {
      return this.transactionsRepo.calculateBalance(userId, currency, dateFrom, dateTo);
    }

    return this.transactionsRepo.calculateBalanceByCurrency(userId, dateFrom, dateTo);
  }

  async getStatsByCategory(
    userId: string,
    userRole: string,
    type: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    this.requirePermission(userRole, "REPORTS_READ");
    return this.transactionsRepo.sumByCategory(userId, type, dateFrom, dateTo);
  }

  async getStatsBySource(
    userId: string,
    userRole: string,
    type: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    this.requirePermission(userRole, "REPORTS_READ");
    return this.transactionsRepo.sumBySource(userId, type, dateFrom, dateTo);
  }

  private mapTransactionWithDetails(tx: Record<string, unknown>): TransactionWithDetails {
    const category = tx.category as { id: string; name: string; emoji: string } | null;
    const source = tx.source as { id: string; name: string; emoji: string } | null;
    const transferSource = tx.transferSource as { id: string; name: string; emoji: string } | null;
    const transferTarget = tx.transferTarget as { id: string; name: string; emoji: string } | null;

    return {
      id: tx.id as string,
      type: tx.type as string,
      amount: String(tx.amount),
      currency: tx.currency as string,
      description: tx.description as string | null,
      referenceId: tx.referenceId as string | null,
      isCancelled: tx.isCancelled as boolean,
      cancelledAt: tx.cancelledAt as Date | null,
      cancelReason: tx.cancelReason as string | null,
      transactionDate: tx.transactionDate as Date,
      createdAt: tx.createdAt as Date,
      updatedAt: tx.updatedAt as Date,
      category,
      source,
      transferSource,
      transferTarget,
    };
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
