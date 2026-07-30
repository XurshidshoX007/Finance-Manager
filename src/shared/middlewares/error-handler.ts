import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import { AppError } from "../errors/index.js";
import { getLogger } from "../logger/index.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const logger: Logger = getLogger("error-handler");

  if (err instanceof AppError) {
    logger.warn(
      {
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
      },
      "Application error",
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  logger.error({ error: err, stack: err.stack }, "Unexpected error");

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
}
