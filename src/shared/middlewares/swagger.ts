export function createSwaggerSetup() {
  const swaggerSpec = {
    openapi: "3.0.0",
    info: {
      title: "Finance Manager API",
      version: "1.0.0",
      description: "Production-grade Finance Manager REST API for Telegram",
    },
    servers: [
      { url: "/api/v1", description: "API v1" },
    ],
    components: {
      securitySchemes: {
        UserAuth: {
          type: "apiKey",
          in: "header",
          name: "x-user-id",
        },
      },
      schemas: {
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            total: { type: "integer", example: 100 },
            totalPages: { type: "integer", example: 5 },
            hasNext: { type: "boolean", example: true },
            hasPrev: { type: "boolean", example: false },
          },
        },
        Source: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            emoji: { type: "string" },
            color: { type: "string" },
            currency: { type: "string", enum: ["UZS", "USD", "EUR", "RUB", "GBP", "CNY"] },
            description: { type: "string", nullable: true },
            isSystem: { type: "boolean" },
            balance: {
              type: "object",
              properties: {
                income: { type: "number" },
                expense: { type: "number" },
                net: { type: "number" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            emoji: { type: "string" },
            color: { type: "string" },
            type: { type: "string", enum: ["INCOME", "EXPENSE"] },
            description: { type: "string", nullable: true },
            groupId: { type: "string", nullable: true },
            groupName: { type: "string", nullable: true },
            stats: {
              type: "object",
              properties: {
                total: { type: "number" },
                count: { type: "number" },
              },
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["INCOME", "EXPENSE", "TRANSFER"] },
            amount: { type: "string" },
            currency: { type: "string", enum: ["UZS", "USD", "EUR", "RUB", "GBP", "CNY"] },
            description: { type: "string", nullable: true },
            isCancelled: { type: "boolean" },
            transactionDate: { type: "string", format: "date-time" },
            category: { type: "object", nullable: true },
            source: { type: "object", nullable: true },
          },
        },
        Credit: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            totalAmount: { type: "string" },
            remainingDebt: { type: "string" },
            monthlyPayment: { type: "string" },
            interestRate: { type: "string" },
            termMonths: { type: "integer" },
            type: { type: "string", enum: ["ANNUITY", "DIFFERENTIAL"] },
            status: { type: "string", enum: ["ACTIVE", "COMPLETED", "CANCELLED"] },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          responses: { "200": { description: "OK" } },
        },
      },
      "/sources": {
        get: {
          summary: "List sources",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "currency", in: "query", schema: { type: "string" } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Sources list" } },
        },
        post: {
          summary: "Create source",
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Source" } } },
          },
          responses: { "201": { description: "Source created" } },
        },
      },
      "/sources/{id}": {
        get: { summary: "Get source", responses: { "200": { description: "Source details" } } },
        put: { summary: "Update source", responses: { "200": { description: "Source updated" } } },
        delete: { summary: "Archive source", responses: { "200": { description: "Source archived" } } },
      },
      "/categories": {
        get: { summary: "List categories", responses: { "200": { description: "Categories list" } } },
        post: { summary: "Create category", responses: { "201": { description: "Category created" } } },
      },
      "/transactions": {
        get: { summary: "List transactions", responses: { "200": { description: "Transactions list" } } },
        post: { summary: "Create transaction", responses: { "201": { description: "Transaction created" } } },
      },
      "/transactions/transfer": {
        post: { summary: "Create transfer", responses: { "201": { description: "Transfer created" } } },
      },
      "/credits": {
        get: { summary: "List credits", responses: { "200": { description: "Credits list" } } },
        post: { summary: "Create credit", responses: { "201": { description: "Credit created" } } },
      },
      "/reports/dashboard": {
        get: { summary: "Dashboard", responses: { "200": { description: "Dashboard data" } } },
      },
      "/reports/report": {
        get: { summary: "Period report", responses: { "200": { description: "Report data" } } },
      },
      "/reports/kpi": {
        get: { summary: "KPI", responses: { "200": { description: "KPI data" } } },
      },
    },
  };

  return swaggerSpec;
}
