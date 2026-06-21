import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const database = new Pool({
  connectionString: config.DATABASE_URL,
  min: config.DATABASE_POOL_MIN,
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'seoulmate-api',
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

database.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function checkDatabase(): Promise<void> {
  await database.query('SELECT 1');
}

export async function closeDatabase(): Promise<void> {
  await database.end();
}
