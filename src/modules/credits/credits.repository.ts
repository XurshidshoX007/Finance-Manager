import type { PrismaClient, Prisma } from "@prisma/client";
import type { PaginationInput } from "../../shared/types/index.js";
import { calculateOffset, createPaginatedResult } from "../../shared/utils/index.js";
import type { CreditFilterInput } from "./credits.types.js";

export class CreditsRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: {
    name: string;
    totalAmount: string;
    currency: string;
    remainingDebt: string;
    monthlyPayment: string;
    interestRate: string;
    termMonths: number;
    type: string;
    startDate: Date;
    endDate: Date;
    sourceId?: string;
    createdBy: string;
  }) {
    return this.prisma.credit.create({
      data: {
        name: data.name,
        totalAmount: data.totalAmount,
        currency: data.currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        remainingDebt: data.remainingDebt,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        termMonths: data.termMonths,
        type: data.type as "ANNUITY" | "DIFFERENTIAL",
        startDate: data.startDate,
        endDate: data.endDate,
        sourceId: data.sourceId,
        createdBy: data.createdBy,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.credit.findUnique({
      where: { id },
      include: {
        source: true,
        schedule: { orderBy: { monthNumber: "asc" } },
        earlyPayments: { orderBy: { paymentDate: "desc" } },
      },
    });
  }

  async findByIdAndUser(id: string, userId: string) {
    return this.prisma.credit.findFirst({
      where: { id, createdBy: userId, isArchived: false },
      include: {
        source: true,
        schedule: { orderBy: { monthNumber: "asc" } },
        earlyPayments: { orderBy: { paymentDate: "desc" } },
      },
    });
  }

  async findAll(userId: string, pagination: PaginationInput, filters?: CreditFilterInput) {
    const where: Record<string, unknown> = {
      createdBy: userId,
      isArchived: false,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.currency) {
      where.currency = filters.currency;
    }

    const [credits, total] = await Promise.all([
      this.prisma.credit.findMany({
        where,
        skip: calculateOffset(pagination),
        take: pagination.limit,
        orderBy: { createdAt: "desc" },
        include: { source: true },
      }),
      this.prisma.credit.count({ where }),
    ]);

    return createPaginatedResult(credits, total, pagination);
  }

  async findActiveByUser(userId: string) {
    return this.prisma.credit.findMany({
      where: { createdBy: userId, status: "ACTIVE", isArchived: false },
      orderBy: { startDate: "asc" },
      include: { source: true },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.credit.update({
      where: { id },
      data: { status: status as "ACTIVE" | "COMPLETED" | "CANCELLED" },
    });
  }

  async updateRemainingDebt(id: string, remainingDebt: string, paidMonths: number) {
    return this.prisma.credit.update({
      where: { id },
      data: { remainingDebt, paidMonths },
    });
  }

  async createSchedule(schedule: Array<{
    creditId: string;
    monthNumber: number;
    paymentDate: Date;
    principalAmount: string;
    interestAmount: string;
    totalPayment: string;
    remainingDebt: string;
  }>) {
    return this.prisma.creditSchedule.createMany({
      data: schedule,
    });
  }

  async markSchedulePaid(scheduleId: string, transactionId?: string) {
    return this.prisma.creditSchedule.update({
      where: { id: scheduleId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        transactionId,
      },
    });
  }

  async createEarlyPayment(data: {
    creditId: string;
    amount: string;
    paymentDate: Date;
    isFull: boolean;
  }) {
    return this.prisma.creditEarlyPayment.create({
      data,
    });
  }

  /**
   * Erta to'lovni ATOMIK bajaradi: qarzni yangilash, statusni
   * o'zgartirish, jadvalni yopish va to'lov yozuvini yaratish —
   * hammasi bitta tranzaksiyada.
   *
   * Ilgari bu amallar alohida-alohida bajarilardi: o'rtada xato
   * chiqsa, qarz kamayib qolib to'lov yozuvi yaratilmasdi
   * (yoki aksincha) — ma'lumot buzilardi.
   */
  async applyEarlyPayment(data: {
    creditId: string;
    amount: string;
    newRemainingDebt: string;
    paidMonths: number;
    isFull: boolean;
    paymentDate: Date;
  }) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.credit.update({
        where: { id: data.creditId },
        data: {
          remainingDebt: data.newRemainingDebt,
          paidMonths: data.paidMonths,
          ...(data.isFull ? { status: "COMPLETED" as const } : {}),
        },
      });

      // To'liq yopilganda qolgan jadval qatorlari ham to'langan deb belgilanadi
      if (data.isFull) {
        await tx.creditSchedule.updateMany({
          where: { creditId: data.creditId, isPaid: false },
          data: { isPaid: true, paidAt: data.paymentDate },
        });
      }

      return tx.creditEarlyPayment.create({
        data: {
          creditId: data.creditId,
          amount: data.amount,
          paymentDate: data.paymentDate,
          isFull: data.isFull,
        },
      });
    });
  }

  async archive(id: string) {
    return this.prisma.credit.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.credit.count({
      where: { createdBy: userId, isArchived: false },
    });
  }

  async countByStatus(userId: string, status: string): Promise<number> {
    return this.prisma.credit.count({
      where: { createdBy: userId, status: status as "ACTIVE" | "COMPLETED" | "CANCELLED", isArchived: false },
    });
  }

  async sumRemainingDebt(userId: string, currency: string): Promise<number> {
    const result = await this.prisma.credit.aggregate({
      _sum: { remainingDebt: true },
      where: {
        createdBy: userId,
        currency: currency as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY",
        status: "ACTIVE",
        isArchived: false,
      },
    });

    return Number(result._sum.remainingDebt ?? 0);
  }
}
