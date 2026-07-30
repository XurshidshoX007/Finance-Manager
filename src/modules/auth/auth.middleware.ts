import type { Context, MiddlewareFn } from "grammy";
import type { PrismaClient } from "@prisma/client";
import type { RedisClientType } from "redis";
import type { Logger } from "pino";
import type { AuthService } from "./auth.service.js";
import type { AuditLogService } from "../users/audit-log.service.js";
import { Role, ROLE_PERMISSIONS, type Permission } from "../../shared/types/index.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors/index.js";
import { getLogger } from "../../shared/logger/index.js";

export interface CustomContext extends Context {
  appState: {
    userId: string;
    userRole: Role;
    prisma: PrismaClient;
    redis: RedisClientType;
    logger: Logger;
    authService: AuthService;
    auditLogService: AuditLogService;
  };
}

export function createAuthMiddleware(authService: AuthService): MiddlewareFn<CustomContext> {
  const logger = getLogger("auth-middleware");

  return async (ctx, next) => {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      logger.warn("No telegram user in update");
      return;
    }

    try {
      const loginResult = await authService.authenticate(
        BigInt(telegramUser.id),
        telegramUser.first_name,
        telegramUser.last_name,
        telegramUser.username,
        telegramUser.language_code,
      );

      ctx.appState = {
        userId: loginResult.user.id,
        userRole: loginResult.user.role as Role,
        prisma: ctx.appState?.prisma ?? ({} as PrismaClient),
        redis: ctx.appState?.redis ?? ({} as RedisClientType),
        logger: logger,
        authService,
        auditLogService: ctx.appState?.auditLogService ?? ({} as AuditLogService),
      };

      if (loginResult.isFirstLogin) {
        await ctx.reply(
          `👋 Salom, ${telegramUser.first_name}!\n\n` +
          `Siz Finance Manager tizimiga muvaffaqiyatli ro'yxatdan o'tdingiz.\n` +
          `Sizning rolingiz: ${loginResult.user.role}\n\n` +
          `📊 /menu - Bosh menyu\n` +
          `❓ /help - Yordam`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenError) {
        await ctx.reply(`❌ ${error.message}`);
        return;
      }
      logger.error({ error }, "Authentication failed");
      await ctx.reply("❌ Tizimga kirishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
      return;
    }

    await next();
  };
}

export function requirePermission(permission: Permission): MiddlewareFn<CustomContext> {
  return async (ctx, next) => {
    if (!ctx.appState) {
      throw new UnauthorizedError("Not authenticated");
    }

    const userRole = ctx.appState.userRole;
    const permissions = ROLE_PERMISSIONS[userRole];

    if (!permissions.includes(permission)) {
      await ctx.reply(`❌ Sizda bu amalni bajarish uchun ruxsat yo'q: ${permission}`);
      return;
    }

    await next();
  };
}

export function requireRole(role: Role): MiddlewareFn<CustomContext> {
  return async (ctx, next) => {
    if (!ctx.appState) {
      throw new UnauthorizedError("Not authenticated");
    }

    const roleHierarchy: Record<Role, number> = {
      [Role.ADMIN]: 3,
      [Role.MANAGER]: 2,
      [Role.EMPLOYEE]: 1,
    };

    if (roleHierarchy[ctx.appState.userRole] < roleHierarchy[role]) {
      await ctx.reply(`❌ Bu amal uchun kamida ${role} roli kerak.`);
      return;
    }

    await next();
  };
}
