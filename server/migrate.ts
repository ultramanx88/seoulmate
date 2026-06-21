import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { database, closeDatabase } from './database.js';

const migrationsDirectory = path.resolve(process.cwd(), 'server/migrations');

async function ensureMigrationTable(): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function checksum(contents: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(contents).digest('hex');
}

export async function runMigrations(): Promise<void> {
  await ensureMigrationTable();

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  for (const filename of migrationFiles) {
    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
    const migrationChecksum = await checksum(sql);
    const existing = await database.query<{ checksum: string }>(
      'SELECT checksum FROM schema_migrations WHERE filename = $1',
      [filename],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== migrationChecksum) {
        throw new Error(`Applied migration was modified: ${filename}`);
      }
      continue;
    }

    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, migrationChecksum],
      );
      await client.query('COMMIT');
      console.log(`Applied migration ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  runMigrations()
    .then(() => console.log('Database migrations are up to date'))
    .catch((error) => {
      console.error('Migration failed', error);
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
