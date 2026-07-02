import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { createApiRouter } from './api-routes.js';
import { checkDatabase } from './database.js';
import { checkRedis } from './redis.js';

export function createApp() {
  const app = express();

  if (config.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health/live', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'seoulmate-api',
      version: config.APP_VERSION,
    });
  });

  app.get('/health/ready', async (_request, response) => {
    const dependencies: Record<string, string> = {};

    try {
      await checkDatabase();
      dependencies.postgres = 'ok';
    } catch {
      dependencies.postgres = 'unavailable';
    }

    try {
      await checkRedis();
      dependencies.redis = 'ok';
    } catch {
      dependencies.redis = 'unavailable';
    }

    const ready =
      dependencies.postgres === 'ok' &&
      (!config.REDIS_REQUIRED || dependencies.redis === 'ok');

    response.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies,
    });
  });

  app.get('/api/v1', (_request, response) => {
    response.json({
      service: 'seoulmate-api',
      version: config.APP_VERSION,
      migrationPhase: 'postgres-api-auth',
    });
  });

  app.use(createApiRouter());

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const staticDirectory = path.resolve(currentDirectory, '../../dist');
  app.use(express.static(staticDirectory, { index: false, maxAge: '1h' }));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/') || request.path.startsWith('/health/')) {
      next();
      return;
    }
    response.sendFile(path.join(staticDirectory, 'index.html'));
  });

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  app.use(
    (
      error: Error,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('Unhandled request error', error);
      response.status(500).json({ error: 'internal_server_error' });
    },
  );

  return app;
}
