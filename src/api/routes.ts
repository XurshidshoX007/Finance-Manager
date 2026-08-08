import { Router } from "express";
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
}

export function createApiRoutes(services: ApiServices): Router {
  const router = Router();

  // Health check
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Swagger spec
  router.get("/docs", (_req, res) => {
    res.json(createSwaggerSetup());
  });

  // ============================================
  // SOURCES API
  // ============================================
  const sourcesRouter = Router();

  sourcesRouter.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 20,
      );
      const result = await services.sourcesService.list(userId, userRole, pagination, {
        currency: req.query["currency"] as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY" | undefined,
        search: req.query["search"] as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  sourcesRouter.get("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.sourcesService.getById(req.params["id"] as string, userId, userRole);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  sourcesRouter.post("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.sourcesService.create(userId, userRole, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  sourcesRouter.put("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.sourcesService.update(userId, userRole, req.params["id"] as string, req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  sourcesRouter.delete("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      await services.sourcesService.archive(userId, userRole, req.params["id"] as string);
      res.json({ success: true, message: "Source archived" });
    } catch (error) { next(error); }
  });

  router.use("/sources", sourcesRouter);

  // ============================================
  // CATEGORIES API
  // ============================================
  const categoriesRouter = Router();

  categoriesRouter.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 50,
      );
      const result = await services.categoriesService.list(userId, userRole, pagination, {
        type: req.query["type"] as "INCOME" | "EXPENSE" | undefined,
        search: req.query["search"] as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  categoriesRouter.post("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.categoriesService.create(userId, userRole, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  categoriesRouter.put("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.categoriesService.update(userId, userRole, req.params["id"] as string, req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  categoriesRouter.delete("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      await services.categoriesService.archive(userId, userRole, req.params["id"] as string);
      res.json({ success: true, message: "Category archived" });
    } catch (error) { next(error); }
  });

  router.use("/categories", categoriesRouter);

  // ============================================
  // TRANSACTIONS API
  // ============================================
  const transactionsRouter = Router();

  transactionsRouter.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 20,
      );
      const result = await services.transactionsService.list(userId, userRole, pagination, {
        type: req.query["type"] as "INCOME" | "EXPENSE" | "TRANSFER" | undefined,
        currency: req.query["currency"] as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY" | undefined,
        dateFrom: req.query["dateFrom"] as string | undefined,
        dateTo: req.query["dateTo"] as string | undefined,
        isCancelled: req.query["isCancelled"] === "true" ? true : req.query["isCancelled"] === "false" ? false : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  transactionsRouter.get("/:id", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.transactionsService.getById(req.params["id"] as string, userId, userRole);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  transactionsRouter.post("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.transactionsService.create(userId, userRole, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  transactionsRouter.post("/transfer", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.transactionsService.createTransfer(userId, userRole, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  transactionsRouter.post("/:id/cancel", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      await services.transactionsService.cancel(userId, userRole, req.params["id"] as string, req.body);
      res.json({ success: true, message: "Transaction cancelled" });
    } catch (error) { next(error); }
  });

  transactionsRouter.get("/balance/summary", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.transactionsService.getBalance(
        userId,
        userRole,
        req.query["currency"] as string | undefined,
        req.query["dateFrom"] ? new Date(req.query["dateFrom"] as string) : undefined,
        req.query["dateTo"] ? new Date(req.query["dateTo"] as string) : undefined,
      );
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  router.use("/transactions", transactionsRouter);

  // ============================================
  // CREDITS API
  // ============================================
  const creditsRouter = Router();

  creditsRouter.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 20,
      );
      const result = await services.creditsService.list(userId, userRole, pagination, {
        status: req.query["status"] as "ACTIVE" | "COMPLETED" | "CANCELLED" | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  creditsRouter.post("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.creditsService.create(userId, userRole, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  creditsRouter.post("/:id/early-payment", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      await services.creditsService.earlyPayment(userId, userRole, req.params["id"] as string, req.body);
      res.json({ success: true, message: "Early payment processed" });
    } catch (error) { next(error); }
  });

  router.use("/credits", creditsRouter);

  // ============================================
  // REPORTS API
  // ============================================
  const reportsRouter = Router();

  reportsRouter.get("/dashboard", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.reportsService.getDashboard(userId, userRole);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  reportsRouter.get("/report", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.reportsService.getReport(userId, userRole, {
        period: (req.query["period"] as "today" | "weekly" | "monthly" | "yearly") || "monthly",
        currency: (req.query["currency"] as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY") || "UZS",
        dateFrom: req.query["dateFrom"] as string | undefined,
        dateTo: req.query["dateTo"] as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  reportsRouter.get("/kpi", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const result = await services.reportsService.getKpi(userId, userRole);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  // PDF Export
  reportsRouter.get("/pdf", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const report = await services.reportsService.getReport(userId, userRole, {
        period: (req.query["period"] as "today" | "weekly" | "monthly" | "yearly") || "monthly",
        currency: (req.query["currency"] as "UZS" | "USD" | "EUR" | "RUB" | "GBP" | "CNY") || "UZS",
      });
      const buffer = await services.pdfService.exportReport(userId, userRole, report);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report_${report.period}.pdf`);
      res.send(buffer);
    } catch (error) { next(error); }
  });

  router.use("/reports", reportsRouter);

  // ============================================
  // EXCEL API
  // ============================================
  const excelRouter = Router();

  excelRouter.get("/export/transactions", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const buffer = await services.excelService.exportTransactions(userId, userRole);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=transactions.xlsx");
      res.send(buffer);
    } catch (error) { next(error); }
  });

  excelRouter.get("/export/credits", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const buffer = await services.excelService.exportCredits(userId, userRole);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=credits.xlsx");
      res.send(buffer);
    } catch (error) { next(error); }
  });

  excelRouter.get("/template", async (_req, res, next) => {
    try {
      const buffer = await services.excelService.generateTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=template.xlsx");
      res.send(buffer);
    } catch (error) { next(error); }
  });

  excelRouter.post("/import/preview", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      if (!req.body || !Buffer.isBuffer(req.body)) {
        res.status(400).json({ success: false, error: { message: "File buffer required" } });
        return;
      }
      const result = await services.excelService.importPreview(userId, userRole, req.body);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  router.use("/excel", excelRouter);

  // ============================================
  // USERS API
  // ============================================
  const usersRouter = Router();

  usersRouter.get("/", async (req, res, next) => {
    try {
      const userRole = req.headers["x-user-role"] as string;
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 20,
      );
      const result = await services.usersService.listUsers(pagination, undefined, userRole);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  usersRouter.put("/:id/role", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await services.usersService.changeRole(userId, req.params["id"] as string, req.body.role);
      res.json({ success: true, message: "Role updated" });
    } catch (error) { next(error); }
  });

  router.use("/users", usersRouter);

  // ============================================
  // AUDIT LOG API
  // ============================================
  const auditRouter = Router();

  auditRouter.get("/", async (req, res, next) => {
    try {
      const pagination = createPaginationInput(
        Number(req.query["page"]) || 1,
        Number(req.query["limit"]) || 20,
      );
      const result = await services.auditLogService.getAllLogs(pagination, {
        userId: req.query["userId"] as string | undefined,
        entity: req.query["entity"] as string | undefined,
        action: req.query["action"] as string | undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  router.use("/audit", auditRouter);

  // ============================================
  // BACKUP API
  // ============================================
  const backupRouter = Router();

  backupRouter.get("/list", async (req, res, next) => {
    try {
      const userRole = req.headers["x-user-role"] as string;
      if (userRole !== "ADMIN") {
        res.status(403).json({ success: false, error: { message: "Admin only" } });
        return;
      }
      const backups = await services.backupService.listBackups();
      res.json({ success: true, data: backups });
    } catch (error) { next(error); }
  });

  backupRouter.post("/create", async (req, res, next) => {
    try {
      const userRole = req.headers["x-user-role"] as string;
      if (userRole !== "ADMIN") {
        res.status(403).json({ success: false, error: { message: "Admin only" } });
        return;
      }
      const filePath = await services.backupService.createBackup();
      res.json({ success: true, data: { filePath } });
    } catch (error) { next(error); }
  });

  router.use("/backup", backupRouter);

  // ============================================
  // QUEUE STATS API
  // ============================================
  const queueRouter = Router();

  queueRouter.get("/stats", async (req, res, next) => {
    try {
      const userRole = req.headers["x-user-role"] as string;
      if (userRole !== "ADMIN") {
        res.status(403).json({ success: false, error: { message: "Admin only" } });
        return;
      }
      const stats = await services.queueService.getQueueStats();
      res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  });

  router.use("/queue", queueRouter);

  return router;
}
