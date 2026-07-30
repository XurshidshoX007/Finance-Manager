import { PrismaClient } from "@prisma/client";
import { getLogger } from "../logger/index.js";

let prisma: PrismaClient | null = null;

export function createPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const logger = getLogger("database");

  prisma = new PrismaClient({
    log: [
      {
        emit: "event",
        level: "query",
      },
      {
        emit: "event",
        level: "error",
      },
      {
        emit: "event",
        level: "warn",
      },
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on("query", (e: any) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        duration: e.duration,
      },
      "Query executed",
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on("error", (e: any) => {
    logger.error({ error: e }, "Prisma error");
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on("warn", (e: any) => {
    logger.warn({ warning: e }, "Prisma warning");
  });

  return prisma;
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    return createPrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
