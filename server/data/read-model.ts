import { redis } from '../redis.js';

export type CacheOptions = {
  ttlSeconds: number;
};

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!redis.isOpen) return null;
  const value = await redis.get(key);
  if (typeof value !== 'string') return null;
  return value ? JSON.parse(value) as T : null;
}

export async function setCachedJson<T>(key: string, value: T, options: CacheOptions): Promise<void> {
  if (!redis.isOpen) return;
  await redis.set(key, JSON.stringify(value), { EX: options.ttlSeconds });
}

export async function rememberJson<T>(key: string, options: CacheOptions, loader: () => Promise<T>): Promise<T> {
  const cached = await getCachedJson<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await setCachedJson(key, value, options);
  return value;
}

export async function invalidateReadModels(keys: string[]): Promise<void> {
  if (!redis.isOpen || keys.length === 0) return;
  await redis.del(keys);
}
