import type { PoolClient, QueryResultRow } from 'pg';
import { database } from '../database.js';

type Queryable = Pick<PoolClient, 'query'>;

export type AppDb = {
  many<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<T[]>;
  maybeOne<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<T | null>;
  one<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<T>;
  execute(sql: string, values?: unknown[]): Promise<number>;
};

export function createAppDb(client: Queryable = database): AppDb {
  async function many<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await client.query<T>(sql, values);
    return result.rows;
  }

  async function maybeOne<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<T | null> {
    const result = await client.query<T>(sql, values);
    return result.rows[0] ?? null;
  }

  async function one<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<T> {
    const result = await client.query<T>(sql, values);
    const row = result.rows[0];
    if (!row) throw new Error('APP_DB_EXPECTED_ONE_ROW');
    return row;
  }

  async function execute(sql: string, values: unknown[] = []): Promise<number> {
    const result = await client.query(sql, values);
    return result.rowCount ?? 0;
  }

  return {
    many,
    maybeOne,
    one,
    execute,
  };
}

export const appDb = createAppDb();

export async function withAppTransaction<T>(callback: (db: AppDb) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(createAppDb(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
