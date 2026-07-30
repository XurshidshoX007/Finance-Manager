import type { PrismaClient } from "@prisma/client";
import type { RedisClientType } from "redis";
import type { Logger } from "pino";
import type { Api } from "grammy";

// ============================================
// PRISMA TYPE ALIASES
// ============================================

export type { PrismaClient };

export type TransactionWhereInput = Record<string, unknown>;
export type TransactionCreateInput = Record<string, unknown>;

// ============================================
// PAGINATION
// ============================================

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================
// SORTING & FILTERING
// ============================================

export type SortDirection = "asc" | "desc";

export interface SortInput {
  field: string;
  direction: SortDirection;
}

// ============================================
// CONTEXT TYPES
// ============================================

export interface AppContext {
  prisma: PrismaClient;
  redis: RedisClientType;
  logger: Logger;
  userId: string;
  userRole: Role;
}

// ============================================
// ENUM EXPORTS
// ============================================

export enum Role {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE",
}

export enum Currency {
  UZS = "UZS",
  USD = "USD",
  EUR = "EUR",
  RUB = "RUB",
  GBP = "GBP",
  CNY = "CNY",
}

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  TRANSFER = "TRANSFER",
}

export enum CreditType {
  ANNUITY = "ANNUITY",
  DIFFERENTIAL = "DIFFERENTIAL",
}

export enum CreditStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

// ============================================
// PERMISSION TYPES
// ============================================

export enum Permission {
  // Sources
  SOURCES_CREATE = "SOURCES_CREATE",
  SOURCES_READ = "SOURCES_READ",
  SOURCES_UPDATE = "SOURCES_UPDATE",
  SOURCES_DELETE = "SOURCES_DELETE",

  // Categories
  CATEGORIES_CREATE = "CATEGORIES_CREATE",
  CATEGORIES_READ = "CATEGORIES_READ",
  CATEGORIES_UPDATE = "CATEGORIES_UPDATE",
  CATEGORIES_DELETE = "CATEGORIES_DELETE",

  // Transactions
  TRANSACTIONS_CREATE = "TRANSACTIONS_CREATE",
  TRANSACTIONS_READ = "TRANSACTIONS_READ",
  TRANSACTIONS_UPDATE = "TRANSACTIONS_UPDATE",
  TRANSACTIONS_CANCEL = "TRANSACTIONS_CANCEL",
  TRANSACTIONS_EXPORT = "TRANSACTIONS_EXPORT",

  // Credits
  CREDITS_CREATE = "CREDITS_CREATE",
  CREDITS_READ = "CREDITS_READ",
  CREDITS_UPDATE = "CREDITS_UPDATE",
  CREDITS_DELETE = "CREDITS_DELETE",
  CREDITS_EARLY_PAYMENT = "CREDITS_EARLY_PAYMENT",

  // Reports
  REPORTS_READ = "REPORTS_READ",
  REPORTS_EXPORT = "REPORTS_EXPORT",

  // Excel
  EXCEL_IMPORT = "EXCEL_IMPORT",
  EXCEL_EXPORT = "EXCEL_EXPORT",

  // Settings
  SETTINGS_MANAGE = "SETTINGS_MANAGE",
  USERS_MANAGE = "USERS_MANAGE",
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.MANAGER]: [
    Permission.SOURCES_CREATE,
    Permission.SOURCES_READ,
    Permission.SOURCES_UPDATE,
    Permission.SOURCES_DELETE,
    Permission.CATEGORIES_CREATE,
    Permission.CATEGORIES_READ,
    Permission.CATEGORIES_UPDATE,
    Permission.CATEGORIES_DELETE,
    Permission.TRANSACTIONS_CREATE,
    Permission.TRANSACTIONS_READ,
    Permission.TRANSACTIONS_UPDATE,
    Permission.TRANSACTIONS_CANCEL,
    Permission.TRANSACTIONS_EXPORT,
    Permission.CREDITS_CREATE,
    Permission.CREDITS_READ,
    Permission.CREDITS_UPDATE,
    Permission.CREDITS_DELETE,
    Permission.CREDITS_EARLY_PAYMENT,
    Permission.REPORTS_READ,
    Permission.REPORTS_EXPORT,
    Permission.EXCEL_IMPORT,
    Permission.EXCEL_EXPORT,
  ],
  [Role.EMPLOYEE]: [
    Permission.SOURCES_READ,
    Permission.CATEGORIES_READ,
    Permission.TRANSACTIONS_CREATE,
    Permission.TRANSACTIONS_READ,
    Permission.CREDITS_READ,
    Permission.REPORTS_READ,
  ],
};

// ============================================
// BALANCE TYPES
// ============================================

export interface BalanceResult {
  currency: Currency;
  income: number;
  expense: number;
  net: number;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLogEntry {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

// ============================================
// TELEGRAM CONTEXT
// ============================================

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// ============================================
// API CONTEXT
// ============================================

export interface ApiContext {
  prisma: PrismaClient;
  redis: RedisClientType;
  logger: Logger;
  api: Api;
}
