import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AuthService } from "../modules/auth/auth.service.js";
import type { SourcesService } from "../modules/sources/sources.service.js";
import type { CategoriesService } from "../modules/categories/categories.service.js";
import type { TransactionsService } from "../modules/transactions/transactions.service.js";
import type { CreditsService } from "../modules/credits/credits.service.js";
import type { ReportsService } from "../modules/reports/reports.service.js";
import type { ExcelService } from "../modules/excel/excel.service.js";
import type { PdfService } from "../modules/reports/pdf.service.js";
import type { UsersService } from "../modules/users/users.service.js";
import type { AuditLogService } from "../modules/users/audit-log.service.js";
import type { SettingsService } from "../modules/settings/settings.service.js";
import type { BackupService } from "../modules/backup/backup.service.js";
import type { QueueService } from "../modules/queue/queue.service.js";
import { createPaginationInput } from "../shared/utils/index.js";
import { createSwaggerSetup } from "../shared/middlewares/swagger.js";
import { ValidationError } from "../shared/errors/index.js";
import { createApiAuthMiddleware, getAuth, requireAdmin } from "./api-auth.middleware.js";

export interface ApiServices {
  authService: AuthService;
  sourcesService: SourcesService;
  categoriesService: CategoriesService;
  transactionsService: TransactionsService;
  creditsService: CreditsService;
  reportsService: ReportsService;
  excelService: ExcelService;
  pdfService: PdfService;
  usersService: UsersService;
  auditLogService: AuditLogService;
  settingsService: SettingsService;
  backupService: BackupService;
  queueService: QueueService;
  botToken: string;
  allowHeaderFallback: boolean;
}

const CURRENCIES = ["UZS", "USD", "EUR", "RUB", "GBP", "CNY"] as const;
const PERIODS = ["today", "weekly", "monthly", "yearly"] as const;

type Currency = (typeof CURRENCIES)[number];
type Period = (typeof PERIODS)[number];

/** So'rov query'sini zod bilan tekshiradi va tipli natija qaytaradi. */
function parseQuery<T extends z.ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

/** Route parametrini xavfsiz olish (Express 5 da tip `string | string[]`). */
function param(req: { params: Record<string, unknown> }, name: string): string {
  const value = req.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (typeof resolved !== "string" || resolved.length === 0) {
    throw new ValidationError(`Missing route parameter '${name}'`);
  }
  return resolved;
}

/** Body'ni zod bilan tekshiradi. */
function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Invalid request body", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

/**
 * Async route handler'larni o'raydi: ilgari har bir route'da
 * `try/catch + next(error)` takrorlanardi va bittasi unutilsa
 * so'rov osilib qolardi.
 */
function asyncHandler(
  handler: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const booleanQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export function createApiRoutes(services: ApiServices): Router {
  const router = Router();

  // Health check (autentifikatsiyasiz)
  router.get("/health", (_req, res) => {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
  });

  // Swagger spec (autentifikatsiyasiz)
  router.get("/docs", (_req, res) => {
    res.json(createSwaggerSetup());
  });

  // Bundan keyingi barcha route'lar autentifikatsiyani talab qiladi
  router.use(
    createApiAuthMiddleware({
      authService: services.authService,
      botToken: services.botToken,
      allowHeaderFallback: services.allowHeaderFallback,
    }),
  );

  // ============================================
  // SOURCES API
  // ============================================
  const sourcesRouter = Router();

  const sourceListQuery = paginationQuery.extend({
    currency: z.enum(CURRENCIES).optional(),
    search: z.string().max(100).optional(),
  });

  sourcesRouter.get("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(sourceListQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.sourcesService.list(userId, role, pagination, {
      currency: query.currency,
      search: query.search,
    });
    res.json({ success: true, data: result });
  }));

  sourcesRouter.get("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.sourcesService.getById(param(req, "id"), userId, role);
    res.json({ success: true, data: result });
  }));

  sourcesRouter.post("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.sourcesService.create(userId, role, req.body);
    res.status(201).json({ success: true, data: result });
  }));

  sourcesRouter.put("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.sourcesService.update(userId, role, param(req, "id"), req.body);
    res.json({ success: true, data: result });
  }));

  sourcesRouter.delete("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    await services.sourcesService.archive(userId, role, param(req, "id"));
    res.json({ success: true, message: "Source archived" });
  }));

  router.use("/sources", sourcesRouter);

  // ============================================
  // CATEGORIES API
  // ============================================
  const categoriesRouter = Router();

  const categoryListQuery = paginationQuery.extend({
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    search: z.string().max(100).optional(),
  });

  categoriesRouter.get("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(categoryListQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.categoriesService.list(userId, role, pagination, {
      type: query.type,
      search: query.search,
    });
    res.json({ success: true, data: result });
  }));

  categoriesRouter.post("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.categoriesService.create(userId, role, req.body);
    res.status(201).json({ success: true, data: result });
  }));

  categoriesRouter.post("/defaults", asyncHandler(async (req, res) => {
    const { userId } = getAuth(req);
    const created = await services.categoriesService.ensureDefaults(userId);
    res.json({ success: true, data: { created } });
  }));

  categoriesRouter.put("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.categoriesService.update(userId, role, param(req, "id"), req.body);
    res.json({ success: true, data: result });
  }));

  categoriesRouter.delete("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    await services.categoriesService.archive(userId, role, param(req, "id"));
    res.json({ success: true, message: "Category archived" });
  }));

  router.use("/categories", categoriesRouter);

  // ============================================
  // TRANSACTIONS API
  // ============================================
  const transactionsRouter = Router();

  const transactionListQuery = paginationQuery.extend({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
    currency: z.enum(CURRENCIES).optional(),
    categoryId: z.string().optional(),
    sourceId: z.string().optional(),
    dateFrom: z.string().datetime().or(z.string().date()).optional(),
    dateTo: z.string().datetime().or(z.string().date()).optional(),
    isCancelled: booleanQuery,
    search: z.string().max(100).optional(),
  });

  transactionsRouter.get("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(transactionListQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.transactionsService.list(userId, role, pagination, {
      type: query.type,
      currency: query.currency,
      categoryId: query.categoryId,
      sourceId: query.sourceId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      isCancelled: query.isCancelled,
      search: query.search,
    });
    res.json({ success: true, data: result });
  }));

  // Diqqat: bu route "/:id" dan OLDIN turishi shart, aks holda
  // "balance" id sifatida talqin qilinadi.
  const balanceQuery = z.object({
    currency: z.enum(CURRENCIES).optional(),
    dateFrom: z.string().datetime().or(z.string().date()).optional(),
    dateTo: z.string().datetime().or(z.string().date()).optional(),
  });

  transactionsRouter.get("/balance/summary", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(balanceQuery, req.query);

    const result = await services.transactionsService.getBalance(
      userId,
      role,
      query.currency,
      query.dateFrom ? new Date(query.dateFrom) : undefined,
      query.dateTo ? new Date(query.dateTo) : undefined,
    );
    res.json({ success: true, data: result });
  }));

  transactionsRouter.get("/:id", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.transactionsService.getById(param(req, "id"), userId, role);
    res.json({ success: true, data: result });
  }));

  transactionsRouter.post("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.transactionsService.create(userId, role, req.body);
    res.status(201).json({ success: true, data: result });
  }));

  transactionsRouter.post("/transfer", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.transactionsService.createTransfer(userId, role, req.body);
    res.status(201).json({ success: true, data: result });
  }));

  transactionsRouter.post("/:id/cancel", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const body = parseBody(z.object({ cancelReason: z.string().max(500).optional() }), req.body ?? {});
    await services.transactionsService.cancel(userId, role, param(req, "id"), body);
    res.json({ success: true, message: "Transaction cancelled" });
  }));

  router.use("/transactions", transactionsRouter);

  // ============================================
  // CREDITS API
  // ============================================
  const creditsRouter = Router();

  const creditListQuery = paginationQuery.extend({
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  });

  creditsRouter.get("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(creditListQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.creditsService.list(userId, role, pagination, {
      status: query.status,
    });
    res.json({ success: true, data: result });
  }));

  creditsRouter.post("/", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.creditsService.create(userId, role, req.body);
    res.status(201).json({ success: true, data: result });
  }));

  creditsRouter.post("/:id/early-payment", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    await services.creditsService.earlyPayment(userId, role, param(req, "id"), req.body);
    res.json({ success: true, message: "Early payment processed" });
  }));

  router.use("/credits", creditsRouter);

  // ============================================
  // REPORTS API
  // ============================================
  const reportsRouter = Router();

  const reportQuery = z.object({
    period: z.enum(PERIODS).default("monthly"),
    currency: z.enum(CURRENCIES).default("UZS"),
    dateFrom: z.string().datetime().or(z.string().date()).optional(),
    dateTo: z.string().datetime().or(z.string().date()).optional(),
  });

  reportsRouter.get("/dashboard", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.reportsService.getDashboard(userId, role);
    res.json({ success: true, data: result });
  }));

  reportsRouter.get("/report", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(reportQuery, req.query);

    const result = await services.reportsService.getReport(userId, role, {
      period: query.period as Period,
      currency: query.currency as Currency,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    res.json({ success: true, data: result });
  }));

  reportsRouter.get("/kpi", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const result = await services.reportsService.getKpi(userId, role);
    res.json({ success: true, data: result });
  }));

  reportsRouter.get("/pdf", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const query = parseQuery(reportQuery, req.query);

    const report = await services.reportsService.getReport(userId, role, {
      period: query.period as Period,
      currency: query.currency as Currency,
    });
    const buffer = await services.pdfService.exportReport(userId, role, report);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report_${report.period}.pdf"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  }));

  router.use("/reports", reportsRouter);

  // ============================================
  // EXCEL API
  // ============================================
  const excelRouter = Router();
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  excelRouter.get("/export/transactions", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const buffer = await services.excelService.exportTransactions(userId, role);
    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.xlsx"');
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  }));

  excelRouter.get("/export/credits", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);
    const buffer = await services.excelService.exportCredits(userId, role);
    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", 'attachment; filename="credits.xlsx"');
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  }));

  excelRouter.get("/template", asyncHandler(async (_req, res) => {
    const buffer = await services.excelService.generateTemplate();
    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", 'attachment; filename="template.xlsx"');
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  }));

  excelRouter.post("/import/preview", asyncHandler(async (req, res) => {
    const { userId, role } = getAuth(req);

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new ValidationError("File buffer required (Content-Type: application/octet-stream)");
    }

    const result = await services.excelService.importPreview(userId, role, req.body);
    res.json({ success: true, data: result });
  }));

  router.use("/excel", excelRouter);

  // ============================================
  // USERS API (faqat ADMIN)
  // ============================================
  const usersRouter = Router();
  usersRouter.use(requireAdmin());

  const userListQuery = paginationQuery.extend({
    role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
    isActive: booleanQuery,
    isBlocked: booleanQuery,
  });

  usersRouter.get("/", asyncHandler(async (req, res) => {
    const { role } = getAuth(req);
    const query = parseQuery(userListQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.usersService.listUsers(
      pagination,
      { role: query.role, isActive: query.isActive, isBlocked: query.isBlocked },
      role,
    );
    res.json({ success: true, data: result });
  }));

  usersRouter.put("/:id/role", asyncHandler(async (req, res) => {
    const { userId } = getAuth(req);
    const body = parseBody(z.object({ role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]) }), req.body);
    await services.usersService.changeRole(userId, param(req, "id"), body.role);
    res.json({ success: true, message: "Role updated" });
  }));

  router.use("/users", usersRouter);

  // ============================================
  // AUDIT LOG API (faqat ADMIN)
  // ============================================
  const auditRouter = Router();
  auditRouter.use(requireAdmin());

  const auditQuery = paginationQuery.extend({
    userId: z.string().optional(),
    entity: z.string().max(50).optional(),
    action: z.string().max(50).optional(),
  });

  auditRouter.get("/", asyncHandler(async (req, res) => {
    const query = parseQuery(auditQuery, req.query);
    const pagination = createPaginationInput(query.page, query.limit);

    const result = await services.auditLogService.getAllLogs(pagination, {
      userId: query.userId,
      entity: query.entity,
      action: query.action,
    });
    res.json({ success: true, data: result });
  }));

  router.use("/audit", auditRouter);

  // ============================================
  // BACKUP API (faqat ADMIN)
  // ============================================
  const backupRouter = Router();
  backupRouter.use(requireAdmin());

  backupRouter.get("/list", asyncHandler(async (_req, res) => {
    const backups = await services.backupService.listBackups();
    res.json({ success: true, data: backups });
  }));

  backupRouter.post("/create", asyncHandler(async (_req, res) => {
    const filePath = await services.backupService.createBackup();
    res.json({ success: true, data: { filePath } });
  }));

  router.use("/backup", backupRouter);

  // ============================================
  // QUEUE STATS API (faqat ADMIN)
  // ============================================
  const queueRouter = Router();
  queueRouter.use(requireAdmin());

  queueRouter.get("/stats", asyncHandler(async (_req, res) => {
    const stats = await services.queueService.getQueueStats();
    res.json({ success: true, data: stats });
  }));

  router.use("/queue", queueRouter);

  return router;
}
