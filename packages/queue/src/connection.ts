// TerraQura Redis Connection Manager
// Enterprise-grade Redis connection with failover support

import { Redis, type RedisOptions } from "ioredis";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  retryStrategy?: (times: number) => number | null;
}

const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    // Exponential backoff with max 30 seconds
    const delay = Math.min(times * 100, 30000);
    console.log(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
};

// Singleton connections
let publisherConnection: Redis | null = null;
let subscriberConnection: Redis | null = null;

/**
 * Get Redis connection for publishing (queue operations)
 */
export function getPublisherConnection(config?: Partial<RedisConfig>): Redis {
  if (!publisherConnection) {
    const finalConfig: RedisOptions = { ...defaultConfig, ...config };
    publisherConnection = new Redis(finalConfig);

    publisherConnection.on("error", (err: Error) => {
      console.error("Redis Publisher Error:", err.message);
    });

    publisherConnection.on("connect", () => {
      console.log("Redis Publisher connected");
    });

    publisherConnection.on("ready", () => {
      console.log("Redis Publisher ready");
    });
  }

  return publisherConnection;
}

/**
 * Get Redis connection for subscribing (worker operations)
 */
export function getSubscriberConnection(config?: Partial<RedisConfig>): Redis {
  if (!subscriberConnection) {
    const finalConfig: RedisOptions = { ...defaultConfig, ...config };
    subscriberConnection = new Redis(finalConfig);

    subscriberConnection.on("error", (err: Error) => {
      console.error("Redis Subscriber Error:", err.message);
    });

    subscriberConnection.on("connect", () => {
      console.log("Redis Subscriber connected");
    });

    subscriberConnection.on("ready", () => {
      console.log("Redis Subscriber ready");
    });
  }

  return subscriberConnection;
}

/**
 * Close all Redis connections
 */
export async function closeConnections(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (publisherConnection) {
    promises.push(
      publisherConnection.quit().then(() => {
        publisherConnection = null;
      })
    );
  }

  if (subscriberConnection) {
    promises.push(
      subscriberConnection.quit().then(() => {
        subscriberConnection = null;
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Health check for Redis
 */
export async function healthCheck(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const connection = getPublisherConnection();
    const start = Date.now();
    await connection.ping();
    const latency = Date.now() - start;

    return { connected: true, latency };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default { getPublisherConnection, getSubscriberConnection, closeConnections, healthCheck };
