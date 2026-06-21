import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, checkDatabase } from './database.js';
import { runMigrations } from './migrate.js';
import { checkRedis, closeRedis } from './redis.js';

async function bootstrap(): Promise<void> {
  await checkDatabase();
  await runMigrations();

  try {
    await checkRedis();
  } catch (error) {
    if (config.REDIS_REQUIRED) {
      throw error;
    }
    console.warn('Redis is unavailable; starting in degraded mode');
  }

  const server = createServer(createApp());
  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`SEOULMATE API listening on port ${config.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);

    const forceExit = setTimeout(() => {
      console.error('Graceful shutdown timed out');
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async (error) => {
      await Promise.allSettled([closeRedis(), closeDatabase()]);
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(async (error) => {
  console.error('Failed to start SEOULMATE API', error);
  await Promise.allSettled([closeRedis(), closeDatabase()]);
  process.exit(1);
});
