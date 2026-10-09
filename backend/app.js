import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeDatabase } from './config/database.js';
import apiRouter from './routes/index.js';

function validateEnvironment() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    missing.push('ADMIN_PASSWORD');
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function createApp() {
  const app = express();
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const builtClient = path.resolve(directory, '../frontend/dist');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(apiRouter);

  if (fs.existsSync(builtClient)) {
    app.use(express.static(builtClient));
    app.get('/{*path}', (request, response, next) => {
      if (request.path.startsWith('/api/')) return next();
      response.sendFile(path.join(builtClient, 'index.html'));
    });
  }

  app.use((error, request, response, next) => {
    console.error(`[${request.method}] ${request.originalUrl}`, error.message);
    if (response.headersSent) return next(error);
    const payload = { error: 'حدث خطأ غير متوقع' };
    if (process.env.NODE_ENV !== 'production') payload.details = error.message;
    response.status(500).json(payload);
  });

  return app;
}

export function startServer(port = Number(process.env.PORT || 3001), host = '0.0.0.0') {
  validateEnvironment();
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      console.log(`Center API listening on http://${host}:${port}`);
      resolve(server);
    });

    server.on('close', () => {
      closeDatabase();
    });
  });
}

const app = createApp();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

export default app;
