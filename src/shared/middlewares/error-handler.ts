import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "../errors/index.js";
import { getLogger } from "../logger/index.js";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const logger: Logger = getLogger("error-handler");

  // Javob allaqachon yuborilgan bo'lsa (masalan, stream), Express'ga qaytaramiz
  if (res.headersSent) {
    next(err);
    return;
  }

  // Zod xatolarini o'qiladigan 400 ga aylantiramiz
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: {
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
    });
    return;
  }

  // Buzuq JSON body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
    return;
  }

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

  logger.error(
    { error: err, stack: err.stack, method: req.method, path: req.path },
    "Unexpected error",
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
}
