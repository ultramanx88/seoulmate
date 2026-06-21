import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 5_000,
    reconnectStrategy: (retries) => Math.min(retries * 100, 3_000),
  },
});

redis.on('error', (error) => {
  console.error('Redis client error', error);
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function checkRedis(): Promise<void> {
  if (!redis.isOpen) {
    await connectRedis();
  }
  await redis.ping();
}

export async function closeRedis(): Promise<void> {
  if (redis.isOpen) {
    await redis.quit();
  }
}
