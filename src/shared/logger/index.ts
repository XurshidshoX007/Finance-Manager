import pino from "pino";
import { loadConfig } from "../config/index.js";

let logger: pino.Logger | null = null;

export function createLogger(name?: string): pino.Logger {
  if (logger && !name) {
    return logger;
  }

  const config = loadConfig();

  const baseLogger = pino({
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    transport:
      config.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
              ignore: "pid,hostname",
            },
          }
        : undefined,
  });

  if (name) {
    return baseLogger.child({ module: name });
  }

  logger = baseLogger;
  return logger;
}

export function getLogger(name: string): pino.Logger {
  return createLogger(name);
}
