import type { PoolClient } from 'pg';
import { database } from '../database.js';

export type TransactionIsolation =
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

export async function withRawTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  options: { isolation?: TransactionIsolation; readOnly?: boolean } = {},
): Promise<T> {
  const client = await database.connect();
  try {
    const clauses = [
      'BEGIN',
      options.isolation ? `ISOLATION LEVEL ${options.isolation}` : '',
      options.readOnly ? 'READ ONLY' : '',
    ].filter(Boolean);
    await client.query(clauses.join(' '));
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function forUpdate(sql: string, mode: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE' = 'UPDATE'): string {
  return `${sql} FOR ${mode}`;
}
