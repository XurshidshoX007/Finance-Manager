import { createClient, type RedisClientType } from "redis";
import { loadConfig } from "../config/index.js";
import { getLogger } from "../logger/index.js";

let redisClient: RedisClientType | null = null;

export async function createRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const config = loadConfig();
  const logger = getLogger("redis");

  const url = config.REDIS_PASSWORD
    ? `redis://:${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}`
    : `redis://${config.REDIS_HOST}:${config.REDIS_PORT}`;

  redisClient = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error({ retries }, "Redis max reconnection attempts reached");
          return new Error("Redis max reconnection attempts reached");
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn({ retries, delay }, "Redis reconnecting...");
        return delay;
      },
    },
  });

  redisClient.on("error", (err) => {
    logger.error({ error: err }, "Redis client error");
  });

  redisClient.on("connect", () => {
    logger.info("Redis client connected");
  });

  redisClient.on("reconnecting", () => {
    logger.warn("Redis client reconnecting");
  });

  await redisClient.connect();

  return redisClient;
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}
