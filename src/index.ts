import "dotenv/config";
import { Bot, GrammyError } from "grammy";
import { Role } from "./shared/types/index.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { loadConfig } from "./shared/config/index.js";
import { createLogger, getLogger } from "./shared/logger/index.js";
import { createPrismaClient, disconnectPrisma } from "./shared/database/prisma.js";
import { createRedisClient, disconnectRedis } from "./shared/database/redis.js";
import { createAuthMiddleware, type CustomContext } from "./modules/auth/auth.middleware.js";
import { AuthRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthHandler } from "./modules/auth/auth.handler.js";
import { UsersRepository } from "./modules/users/users.repository.js";
import { UsersService } from "./modules/users/users.service.js";
import { AuditLogRepository } from "./modules/users/audit-log.repository.js";
import { AuditLogService } from "./modules/users/audit-log.service.js";
import { UsersHandler } from "./modules/users/users.handler.js";
import { SourcesRepository } from "./modules/sources/sources.repository.js";
import { SourcesService } from "./modules/sources/sources.service.js";
import { SourcesHandler } from "./modules/sources/sources.handler.js";
import { CategoriesRepository } from "./modules/categories/categories.repository.js";
import { CategoriesService } from "./modules/categories/categories.service.js";
import { CategoriesHandler } from "./modules/categories/categories.handler.js";
import { TransactionsRepository } from "./modules/transactions/transactions.repository.js";
import { TransactionsService } from "./modules/transactions/transactions.service.js";
import { TransactionsHandler } from "./modules/transactions/transactions.handler.js";
import { CreditsRepository } from "./modules/credits/credits.repository.js";
import { CreditsService } from "./modules/credits/credits.service.js";
import { CreditsHandler } from "./modules/credits/credits.handler.js";
import { ReportsService } from "./modules/reports/reports.service.js";
import { ReportsHandler } from "./modules/reports/reports.handler.js";
import { ExcelService } from "./modules/excel/excel.service.js";
import { SettingsRepository } from "./modules/settings/settings.repository.js";
import { SettingsService } from "./modules/settings/settings.service.js";
import { NotificationsRepository } from "./modules/notifications/notifications.repository.js";
import { NotificationsService } from "./modules/notifications/notifications.service.js";
import { NotificationWorker } from "./modules/notifications/notification.worker.js";
import { createApiRoutes } from "./api/routes.js";
import { errorHandler } from "./shared/middlewares/error-handler.js";
import { requestLogger } from "./shared/middlewares/request-logger.js";

async function main(): Promise<void> {
  const logger = createLogger();

  logger.info("Starting Finance Manager...");

  // Load configuration
  const config = loadConfig();
  logger.info({ env: config.NODE_ENV }, "Configuration loaded");

  // Initialize database
  const prisma = createPrismaClient();
  await prisma.$connect();
  logger.info("Database connected");

  // Initialize Redis
  const redis = await createRedisClient();
  logger.info("Redis connected");

  // ============================================
  // DEPENDENCY INJECTION
  // ============================================

  // Auth
  const authRepository = new AuthRepository(prisma);
  const authService = new AuthService(authRepository);

  // Audit Log
  const auditLogRepository = new AuditLogRepository(prisma);
  const auditLogService = new AuditLogService(auditLogRepository);

  // Users
  const usersRepository = new UsersRepository(prisma);
  const usersService = new UsersService(usersRepository, auditLogService);

  // Sources
  const sourcesRepository = new SourcesRepository(prisma);
  const sourcesService = new SourcesService(sourcesRepository, auditLogService);

  // Categories
  const categoriesRepository = new CategoriesRepository(prisma);
  const categoriesService = new CategoriesService(categoriesRepository, auditLogService);

  // Transactions
  const transactionsRepository = new TransactionsRepository(prisma);
  const transactionsService = new TransactionsService(transactionsRepository, auditLogService);

  // Credits
  const creditsRepository = new CreditsRepository(prisma);
  const creditsService = new CreditsService(creditsRepository, auditLogService);

  // Reports
  const reportsService = new ReportsService(transactionsRepository, creditsRepository, auditLogService);

  // Excel
  const excelService = new ExcelService(prisma, auditLogService);

  // Settings
  const settingsRepository = new SettingsRepository(prisma);
  const settingsService = new SettingsService(settingsRepository, auditLogService);

  // Notifications
  const notificationsRepository = new NotificationsRepository(prisma);
  const notificationsService = new NotificationsService(notificationsRepository);

  // ============================================
  // TELEGRAM BOT
  // ============================================

  const bot = new Bot<CustomContext>(config.BOT_TOKEN);

  const authMiddleware = createAuthMiddleware(authService);
  bot.use(authMiddleware);

  // Set appState defaults
  bot.use(async (ctx, next) => {
    ctx.appState = {
      userId: ctx.appState?.userId ?? "",
      userRole: ctx.appState?.userRole ?? Role.EMPLOYEE,
      prisma,
      redis,
      logger: getLogger("bot"),
      authService,
      auditLogService,
    };
    await next();
  });

  // Register handlers
  const authHandler = new AuthHandler(bot, authService);
  authHandler.register();

  const usersHandler = new UsersHandler(bot, usersService);
  usersHandler.register();

  const sourcesHandler = new SourcesHandler(bot, sourcesService);
  sourcesHandler.register();

  const categoriesHandler = new CategoriesHandler(bot, categoriesService);
  categoriesHandler.register();

  const transactionsHandler = new TransactionsHandler(bot, transactionsService);
  transactionsHandler.register();

  const creditsHandler = new CreditsHandler(bot, creditsService);
  creditsHandler.register(bot);

  const reportsHandler = new ReportsHandler(bot, reportsService);
  reportsHandler.register();

  // Menu callback
  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    const firstName = ctx.from?.first_name ?? "Foydalanuvchi";
    await ctx.editMessageText(
      `📊 Finance Manager - Bosh menyu\n\n` +
      `Salom, ${firstName}! Quyidagi bo'limlardan birini tanlang:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💰 Manbalar", callback_data: "sources:list" },
              { text: "📂 Kategoriyalar", callback_data: "categories:list" },
            ],
            [
              { text: "💵 Tranzaksiyalar", callback_data: "transactions:list" },
              { text: "🏦 Kreditlar", callback_data: "credits:list" },
            ],
            [
              { text: "📈 Hisobotlar", callback_data: "reports:dashboard" },
            ],
          ],
        },
      },
    );
  });

  // ============================================
  // EXPRESS API
  // ============================================

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));
  app.use(requestLogger);

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" } },
  });
  app.use("/api", apiLimiter);

  const apiRoutes = createApiRoutes({
    authService,
    sourcesService,
    categoriesService,
    transactionsService,
    creditsService,
    reportsService,
    excelService,
    usersService,
    auditLogService,
    settingsService,
  });

  app.use("/api/v1", apiRoutes);

  app.use(errorHandler);

  // ============================================
  // WEBHOOK OR POLLING
  // ============================================

  if (config.BOT_WEBHOOK_URL) {
    logger.info({ webhookUrl: config.BOT_WEBHOOK_URL }, "Starting in webhook mode");

    app.use(config.BOT_WEBHOOK_PATH, async (req, res) => {
      try {
        await bot.api.setWebhook(config.BOT_WEBHOOK_URL!, {
          secret_token: config.BOT_SECRET_TOKEN,
        });
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        logger.error({ error }, "Webhook error");
        res.sendStatus(500);
      }
    });
  } else {
    logger.info("Starting in polling mode");
    bot.start({
      onStart: (info) => {
        logger.info({ username: info.username }, "Bot started");
      },
    });
  }

  // ============================================
  // START SERVER
  // ============================================

  const server = app.listen(config.APP_PORT, () => {
    logger.info({ port: config.APP_PORT }, "API server started");
  });

  // ============================================
  // NOTIFICATION WORKER
  // ============================================

  const _notificationWorker = new NotificationWorker(bot, notificationsService, transactionsRepository);

  // ============================================
  // GRACEFUL SHUTDOWN
  // ============================================

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");

    server.close();
    bot.stop();

    await disconnectPrisma();
    await disconnectRedis();

    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  logger.info("Finance Manager started successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
