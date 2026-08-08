import { PrismaClient } from "@prisma/client";
import { getLogger } from "../logger/index.js";

let prisma: PrismaClient | null = null;

type PrismaLogEventName = "query" | "error" | "warn";
type PrismaLogEvent = {
  query?: string;
  params?: string;
  duration?: number;
};
type PrismaClientWithEvents = Omit<PrismaClient, "$on"> & {
  $on: (event: PrismaLogEventName, callback: (event: PrismaLogEvent) => void) => void;
};

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

  const prismaWithEvents = prisma as PrismaClientWithEvents;

  prismaWithEvents.$on("query", (e) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        duration: e.duration,
      },
      "Query executed",
    );
  });

  prismaWithEvents.$on("error", (e) => {
    logger.error({ error: e }, "Prisma error");
  });

  prismaWithEvents.$on("warn", (e) => {
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
