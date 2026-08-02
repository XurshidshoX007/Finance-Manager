import type { CreditsRepository } from "./credits.repository.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import type { CreateCreditInput, EarlyPaymentInput, CreditFilterInput } from "./credits.types.js";
import type { PaginationInput, PaginatedResult } from "../../shared/types/index.js";
import { ROLE_PERMISSIONS, Permission } from "../../shared/types/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";
import { toDecimal, formatMoney } from "../../shared/utils/index.js";
import { calculateAnnuitySchedule, calculateDifferentialSchedule } from "./credit-calculator.js";

interface CreditWithDetails {
  id: string;
  name: string;
  totalAmount: string;
  currency: string;
  remainingDebt: string;
  monthlyPayment: string;
  interestRate: string;
  termMonths: number;
  paidMonths: number;
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
  source: { id: string; name: string; emoji: string } | null;
  scheduleCount: number;
  paidScheduleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CreditsService {
  private readonly creditsRepo: CreditsRepository;
  private readonly auditLogService: AuditLogService;
  private readonly logger = getLogger("credits-service");

  constructor(creditsRepo: CreditsRepository, auditLogService: AuditLogService) {
    this.creditsRepo = creditsRepo;
    this.auditLogService = auditLogService;
  }

  async create(userId: string, userRole: string, input: CreateCreditInput): Promise<CreditWithDetails> {
    this.requirePermission(userRole, Permission.CREDITS_CREATE);

    const totalAmount = toDecimal(input.totalAmount);
    if (!totalAmount.greaterThan(0)) {
      throw new ValidationError("Total amount must be greater than 0");
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      throw new ValidationError("startDate must be a valid date");
    }

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + input.termMonths);

    const calculation =
      input.type === "ANNUITY"
        ? calculateAnnuitySchedule(input.totalAmount, input.interestRate, input.termMonths, startDate)
        : calculateDifferentialSchedule(input.totalAmount, input.interestRate, input.termMonths, startDate);

    const credit = await this.creditsRepo.create({
      name: input.name,
      totalAmount: input.totalAmount,
      currency: input.currency,
      remainingDebt: input.totalAmount,
      monthlyPayment: calculation.monthlyPayment,
      interestRate: input.interestRate,
      termMonths: input.termMonths,
      type: input.type,
      startDate,
      endDate,
      sourceId: input.sourceId,
      createdBy: userId,
    });

    if (calculation.schedule.length > 0) {
      await this.creditsRepo.createSchedule(
        calculation.schedule.map((entry) => ({
          creditId: credit.id,
          monthNumber: entry.monthNumber,
          paymentDate: entry.paymentDate,
          principalAmount: entry.principalAmount,
          interestAmount: entry.interestAmount,
          totalPayment: entry.totalPayment,
          remainingDebt: entry.remainingDebt,
        })),
      );
    }

    await this.auditLogService.logCreate(userId, "CREDIT", credit.id, {
      name: credit.name,
      totalAmount: credit.totalAmount,
      type: credit.type,
    });

    this.logger.info({ creditId: credit.id, userId }, "Credit created");

    const full = await this.creditsRepo.findByIdAndUser(credit.id, userId);
    return this.mapCreditWithDetails(full as unknown as Record<string, unknown>);
  }

  async getById(id: string, userId: string, userRole: string): Promise<CreditWithDetails> {
    this.requirePermission(userRole, Permission.CREDITS_READ);

    const credit = await this.creditsRepo.findByIdAndUser(id, userId);
    if (!credit) {
      throw new NotFoundError("Credit", id);
    }

    return this.mapCreditWithDetails(credit);
  }

  async list(
    userId: string,
    userRole: string,
    pagination: PaginationInput,
    filters?: CreditFilterInput,
  ): Promise<PaginatedResult<CreditWithDetails>> {
    this.requirePermission(userRole, Permission.CREDITS_READ);

    const result = await this.creditsRepo.findAll(userId, pagination, filters);

    return {
      data: result.data.map((credit: unknown) => this.mapCreditWithDetails(credit as Record<string, unknown>)),
      pagination: result.pagination,
    };
  }

  async listActive(userId: string, userRole: string): Promise<CreditWithDetails[]> {
    this.requirePermission(userRole, Permission.CREDITS_READ);

    const credits = await this.creditsRepo.findActiveByUser(userId);
    return credits.map((credit: unknown) => this.mapCreditWithDetails(credit as Record<string, unknown>));
  }

  async earlyPayment(userId: string, userRole: string, creditId: string, input: EarlyPaymentInput): Promise<void> {
    this.requirePermission(userRole, Permission.CREDITS_EARLY_PAYMENT);

    const credit = await this.creditsRepo.findByIdAndUser(creditId, userId);
    if (!credit) {
      throw new NotFoundError("Credit", creditId);
    }

    if (credit.status !== "ACTIVE") {
      throw new ValidationError("Only active credits can receive early payments");
    }

    const amount = toDecimal(input.amount);
    const remainingDebt = toDecimal(credit.remainingDebt.toString());

    if (!amount.greaterThan(0)) {
      throw new ValidationError("Early payment amount must be greater than 0");
    }

    if (remainingDebt.lessThanOrEqualTo(0)) {
      throw new ValidationError("This credit has no remaining debt");
    }

    // To'liq yopish bo'lmasa-da, summa qarzni qoplasa — kreditni yopamiz
    const closesCredit = input.isFull || amount.greaterThanOrEqualTo(remainingDebt);

    if (!input.isFull && amount.greaterThan(remainingDebt)) {
      throw new ValidationError("Early payment amount cannot exceed remaining debt");
    }

    const newRemainingDebt = closesCredit ? "0.00" : remainingDebt.minus(amount).toFixed(2);

    await this.creditsRepo.applyEarlyPayment({
      creditId,
      amount: input.amount,
      newRemainingDebt,
      paidMonths: closesCredit ? credit.termMonths : credit.paidMonths,
      isFull: closesCredit,
      paymentDate: new Date(),
    });

    await this.auditLogService.logUpdate(userId, "CREDIT", creditId, {
      action: "EARLY_PAYMENT",
      amount: input.amount,
      isFull: closesCredit,
      newRemainingDebt,
    });

    this.logger.info({ creditId, userId, amount: input.amount }, "Early payment made");
  }

  async archive(userId: string, userRole: string, id: string): Promise<void> {
    this.requirePermission(userRole, Permission.CREDITS_DELETE);

    const credit = await this.creditsRepo.findByIdAndUser(id, userId);
    if (!credit) {
      throw new NotFoundError("Credit", id);
    }

    await this.creditsRepo.archive(id);

    await this.auditLogService.logArchive(userId, "CREDIT", id, {
      name: credit.name,
    });

    this.logger.info({ creditId: id, userId }, "Credit archived");
  }

  async getCreditStats(userId: string, userRole: string) {
    this.requirePermission(userRole, Permission.CREDITS_READ);

    // Ilgari 4 ta so'rov ketma-ket bajarilardi
    const [total, active, completed, totalRemainingDebt] = await Promise.all([
      this.creditsRepo.countByUser(userId),
      this.creditsRepo.countByStatus(userId, "ACTIVE"),
      this.creditsRepo.countByStatus(userId, "COMPLETED"),
      this.creditsRepo.sumRemainingDebt(userId, "UZS"),
    ]);

    return {
      total,
      active,
      completed,
      totalRemainingDebt: formatMoney(totalRemainingDebt, "UZS"),
    };
  }

  private mapCreditWithDetails(credit: Record<string, unknown>): CreditWithDetails {
    const source = credit.source as { id: string; name: string; emoji: string } | null;
    const schedule = credit.schedule as Array<{ isPaid: boolean }> | undefined;

    return {
      id: credit.id as string,
      name: credit.name as string,
      totalAmount: String(credit.totalAmount),
      currency: credit.currency as string,
      remainingDebt: String(credit.remainingDebt),
      monthlyPayment: String(credit.monthlyPayment),
      interestRate: String(credit.interestRate),
      termMonths: credit.termMonths as number,
      paidMonths: credit.paidMonths as number,
      type: credit.type as string,
      status: credit.status as string,
      startDate: credit.startDate as Date,
      endDate: credit.endDate as Date,
      source,
      scheduleCount: schedule?.length ?? 0,
      paidScheduleCount: schedule?.filter((s) => s.isPaid).length ?? 0,
      createdAt: credit.createdAt as Date,
      updatedAt: credit.updatedAt as Date,
    };
  }

  private requirePermission(userRole: string, permission: string): void {
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
    if (!permissions || !permissions.includes(permission as Permission)) {
      throw new ForbiddenError(`Permission '${permission}' is required`);
    }
  }
}
