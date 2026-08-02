import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApiRoutes, type ApiServices } from "../api/routes.js";
import { errorHandler } from "../shared/middlewares/error-handler.js";

const BOT_TOKEN = "123456:TEST-TOKEN";

function signInitData(user: Record<string, unknown>): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  });

  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);

  return params.toString();
}

/** Faqat testda kerak bo'lgan metodlarni qaytaruvchi soxta servislar. */
function buildServices(overrides: Partial<ApiServices> = {}): ApiServices {
  const authService = {
    authenticate: async (telegramId: bigint, firstName: string) => ({
      user: {
        id: `user-${telegramId}`,
        telegramId: telegramId.toString(),
        firstName,
        lastName: null,
        username: null,
        role: "EMPLOYEE",
        isActive: true,
      },
      isFirstLogin: false,
    }),
  };

  const categoriesService = {
    list: async () => ({
      data: [{ id: "c1", name: "Oziq-ovqat" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    }),
    ensureDefaults: async () => 17,
  };

  const base = {
    authService,
    categoriesService,
    sourcesService: {},
    transactionsService: {},
    creditsService: {},
    reportsService: {},
    excelService: {},
    pdfService: {},
    usersService: { listUsers: async () => ({ data: [], pagination: {} }) },
    auditLogService: { getAllLogs: async () => ({ data: [], pagination: {} }) },
    settingsService: {},
    backupService: {},
    queueService: {},
    botToken: BOT_TOKEN,
    allowHeaderFallback: false,
  };

  return { ...base, ...overrides } as unknown as ApiServices;
}

function startServer(services: ApiServices): Promise<{ url: string; server: Server }> {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createApiRoutes(services));
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } });
  });
  app.use(errorHandler);

  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}

describe("API routes", () => {
  let url: string;
  let server: Server;

  beforeAll(async () => {
    ({ url, server } = await startServer(buildServices()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("exposes an unauthenticated health check", async () => {
    const res = await fetch(`${url}/api/v1/health`);
    const body = (await res.json()) as { success: boolean; status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  it("rejects requests without authentication", async () => {
    const res = await fetch(`${url}/api/v1/categories`);
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects spoofed x-user-id headers when the fallback is disabled", async () => {
    const res = await fetch(`${url}/api/v1/categories`, {
      headers: { "x-user-id": "someone-else", "x-user-role": "ADMIN" },
    });

    expect(res.status).toBe(401);
  });

  it("rejects a forged init data signature", async () => {
    const res = await fetch(`${url}/api/v1/categories`, {
      headers: { "x-telegram-init-data": "user=%7B%22id%22%3A1%7D&hash=deadbeef" },
    });

    expect(res.status).toBe(401);
  });

  it("accepts a correctly signed request", async () => {
    const res = await fetch(`${url}/api/v1/categories`, {
      headers: { "x-telegram-init-data": signInitData({ id: 777, first_name: "Ali" }) },
    });
    const body = (await res.json()) as { success: boolean; data: { data: unknown[] } };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.data).toHaveLength(1);
  });

  it("validates query parameters", async () => {
    const res = await fetch(`${url}/api/v1/categories?limit=99999`, {
      headers: { "x-telegram-init-data": signInitData({ id: 777, first_name: "Ali" }) },
    });
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks admin-only routes for non-admin users", async () => {
    const res = await fetch(`${url}/api/v1/audit`, {
      headers: { "x-telegram-init-data": signInitData({ id: 777, first_name: "Ali" }) },
    });

    expect(res.status).toBe(403);
  });

  it("returns JSON (not HTML) for unknown API paths", async () => {
    const res = await fetch(`${url}/api/v2/does-not-exist`);
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("requires auth before resolving unknown versioned paths", async () => {
    // Noma'lum yo'l ham autentifikatsiyadan o'tishi kerak: aks holda
    // route mavjudligini tekshirib bilib olish mumkin bo'lardi.
    const res = await fetch(`${url}/api/v1/does-not-exist`);

    expect(res.status).toBe(401);
  });

  it("allows the header fallback only in development mode", async () => {
    const dev = await startServer(buildServices({ allowHeaderFallback: true }));

    try {
      const res = await fetch(`${dev.url}/api/v1/categories`, {
        headers: { "x-user-id": "dev-user", "x-user-role": "EMPLOYEE" },
      });

      expect(res.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => dev.server.close(() => resolve()));
    }
  });
});
