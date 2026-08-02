import crypto from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthService } from "../modules/auth/auth.service.js";
import { UnauthorizedError, ForbiddenError } from "../shared/errors/index.js";
import { getLogger } from "../shared/logger/index.js";
import { Role, ROLE_PERMISSIONS, type Permission } from "../shared/types/index.js";

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  telegramId: string;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthenticatedUser;
  }
}

interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Telegram Mini App `initData` imzosini tekshiradi.
 * Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = INIT_DATA_MAX_AGE_SECONDS,
): TelegramInitUser | null {
  if (!initData) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(computedHash, "hex");
  const received = Buffer.from(hash, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return null;
  if (Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const rawUser = params.get("user");
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser) as TelegramInitUser;
    if (typeof parsed?.id !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface ApiAuthOptions {
  authService: AuthService;
  botToken: string;
  /** Faqat development uchun: x-user-id header'i bilan kirishga ruxsat beradi. */
  allowHeaderFallback: boolean;
}

/**
 * API uchun autentifikatsiya. Ilgari route'lar mijoz yuborgan
 * `x-user-id` / `x-user-role` header'lariga so'zsiz ishonardi —
 * bu istalgan foydalanuvchiga ADMIN bo'lib olish imkonini berardi.
 */
export function createApiAuthMiddleware(options: ApiAuthOptions): RequestHandler {
  const logger = getLogger("api-auth");

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const initData = req.header("x-telegram-init-data");

      if (initData) {
        const telegramUser = verifyTelegramInitData(initData, options.botToken);

        if (!telegramUser) {
          throw new UnauthorizedError("Invalid or expired Telegram init data");
        }

        const login = await options.authService.authenticate(
          BigInt(telegramUser.id),
          telegramUser.first_name ?? "User",
          telegramUser.last_name,
          telegramUser.username,
          telegramUser.language_code,
        );

        req.auth = {
          userId: login.user.id,
          role: login.user.role as Role,
          telegramId: login.user.telegramId,
        };

        next();
        return;
      }

      if (options.allowHeaderFallback) {
        const userId = req.header("x-user-id");
        const role = req.header("x-user-role");

        if (userId) {
          logger.warn({ path: req.path }, "Using insecure header auth fallback (development only)");
          req.auth = {
            userId,
            role: (role as Role) ?? Role.EMPLOYEE,
            telegramId: "0",
          };
          next();
          return;
        }
      }

      throw new UnauthorizedError("Authentication required");
    } catch (error) {
      next(error);
    }
  };
}

/** Route ichida autentifikatsiyalangan foydalanuvchini olish. */
export function getAuth(req: Request): AuthenticatedUser {
  if (!req.auth) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.auth;
}

/** Ma'lum bir ruxsatni talab qiluvchi middleware. */
export function requireApiPermission(permission: Permission): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const { role } = getAuth(req);
      const permissions = ROLE_PERMISSIONS[role];

      if (!permissions?.includes(permission)) {
        throw new ForbiddenError(`Permission '${permission}' is required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Faqat ADMIN roli uchun. */
export function requireAdmin(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const { role } = getAuth(req);
      if (role !== Role.ADMIN) {
        throw new ForbiddenError("Admin role is required");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
