import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_VERSION: z.string().default('development'),
  DATABASE_URL: z
    .string()
    .default('postgresql://seoulmate:seoulmate@localhost:5432/seoulmate'),
  DATABASE_SSL: booleanFromString,
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_REQUIRED: booleanFromString,
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY: booleanFromString,
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  APP_URL: z.string().default('http://localhost:8080'),
  CLERK_SECRET_KEY: z.string().default(''),
  CLERK_JWT_KEY: z.string().default(''),
  CLERK_AUTHORIZED_PARTIES: z.string().default(''),
  ADMIN_SUPER_EMAIL: z.string().email().optional().or(z.literal('')).default(''),
  ADMIN_SUPER_PASSWORD: z.string().min(8).optional().or(z.literal('')).default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid server environment:', parsed.error.flatten().fieldErrors);
  throw new Error('Server environment validation failed');
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  clerkAuthorizedParties: parsed.data.CLERK_AUTHORIZED_PARTIES.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
