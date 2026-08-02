import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";
import { getLogger } from "../../shared/logger/index.js";

export class AuthRepository {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = getLogger("auth-repository");
  }

  async findUserByTelegramId(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: {
    telegramId: bigint;
    firstName: string;
    lastName?: string;
    username?: string;
    languageCode?: string;
    role: string;
  }) {
    this.logger.info({ telegramId: data.telegramId.toString() }, "Creating new user");
    return this.prisma.user.create({
      data: {
        telegramId: data.telegramId,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        languageCode: data.languageCode ?? "uz",
        role: data.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
      },
    });
  }

  async updateUserLastLogin(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateUserProfile(
    id: string,
    data: {
      firstName: string;
      lastName?: string;
      username?: string;
      languageCode?: string;
      lastLoginAt?: Date;
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateUserRole(id: string, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as "ADMIN" | "MANAGER" | "EMPLOYEE" },
    });
  }

  async setUserActive(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async setUserBlocked(id: string, isBlocked: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isBlocked },
    });
  }
}
