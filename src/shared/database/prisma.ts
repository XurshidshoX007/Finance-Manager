import { PrismaClient } from "@prisma/client";
import { getLogger } from "../logger/index.js";

// Define Prisma event types locally since they might not be re-exported
interface PrismaQueryEvent {
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaLogEvent {
  message: string;
  target: string;
}

let prisma: PrismaClient | null = null;

export function createPrismaClient(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const logger = getLogger("database");

  const prismaInstance = new PrismaClient({
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

  const prismaWithEvents = prismaInstance as unknown as {
    $on(event: "query", cb: (e: PrismaQueryEvent) => void): void;
    $on(event: "error", cb: (e: PrismaLogEvent) => void): void;
    $on(event: "warn", cb: (e: PrismaLogEvent) => void): void;
  };

  prismaWithEvents.$on("query", (e: PrismaQueryEvent) => {
    logger.debug(
      {
        query: e.query,
        params: e.params,
        duration: e.duration,
      },
      "Query executed",
    );
  });

  prismaWithEvents.$on("error", (e: PrismaLogEvent) => {
    logger.error({ error: e.message, target: e.target }, "Prisma error");
  });

  prismaWithEvents.$on("warn", (e: PrismaLogEvent) => {
    logger.warn({ warning: e.message, target: e.target }, "Prisma warning");
  });

  prisma = prismaInstance;

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
