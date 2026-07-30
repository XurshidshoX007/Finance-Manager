import type { Request, Response, NextFunction } from "express";
import { getLogger } from "../logger/index.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const logger = getLogger("http");
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.get("user-agent"),
        ip: req.ip,
      },
      "Request completed",
    );
  });

  next();
}
