import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_PORT: z.coerce.number().default(3000),
  APP_URL: z.string().default("http://localhost:3000"),

  BOT_TOKEN: z.string().min(1),
  BOT_WEBHOOK_URL: z.string().optional(),
  BOT_WEBHOOK_PATH: z.string().default("/webhook"),
  BOT_SECRET_TOKEN: z.string().optional(),

  MINI_APP_URL: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  ADMIN_TELEGRAM_IDS: z.string().default(""),

  JWT_SECRET: z.string().min(1),

  BACKUP_DIR: z.string().default("./backups"),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Environment validation failed:\n${errors.join("\n")}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
