import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { serve } from '@hono/node-server';
import health from './routes/health.js';
import webhook from './routes/webhook.js';
import search from './routes/search.js';
import softbinding from './routes/softbinding.js';
import manifests from './routes/manifests.js';
import services from './routes/services.js';
import sign from './routes/sign.js';
import apiDocs from './routes/api-docs.js';
import { createRateLimiter } from './middleware/rate-limit.js';

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: '*',
    exposeHeaders: ['X-Manifest-Resolution', 'Content-Length', 'Content-Type'],
  })
);
app.use('*', honoLogger());

// Per-IP rate limits. Buckets are tight on CPU/egress-heavy endpoints and
// lenient on cheap reads. /health deliberately has no limit so orchestration
// probes don't compete with real traffic.
const cheapReadLimiter = createRateLimiter({ capacity: 60, windowMs: 60_000, name: 'read' });
const searchLimiter = createRateLimiter({ capacity: 30, windowMs: 60_000, name: 'search' });
const uploadLimiter = createRateLimiter({ capacity: 10, windowMs: 60_000, name: 'upload' });
const referenceLimiter = createRateLimiter({ capacity: 6, windowMs: 60_000, name: 'reference' });
const webhookLimiter = createRateLimiter({ capacity: 600, windowMs: 60_000, name: 'webhook' });
const signLimiter = createRateLimiter({ capacity: 30, windowMs: 60_000, name: 'sign' });

// Routes
app.route('/health', health);
app.use('/webhook/*', webhookLimiter);
app.use('/webhook', webhookLimiter);
app.route('/webhook', webhook);
app.use('/v1/search-similar/*', searchLimiter);
app.route('/v1/search-similar', search);

// Matches: /byContent decodes arbitrary images (CPU), /byReference egresses
// (attacker-controlled URL); both get stricter buckets than plain /byBinding.
app.use('/v1/matches/byContent', uploadLimiter);
app.use('/v1/matches/byReference', referenceLimiter);
app.use('/v1/matches/*', cheapReadLimiter);
app.route('/v1/matches', softbinding);

app.use('/v1/manifests/*', cheapReadLimiter);
app.route('/v1/manifests', manifests);
app.route('/v1/services', services);

app.use('/v1/sign', signLimiter);
app.use('/v1/identity/sign', signLimiter);
app.route('/v1', sign);
app.route('/api-docs', apiDocs);

// Root endpoint - service info
app.get('/', (c) => {
  return c.json({
    name: 'Trusthash Sidecar',
    version: '0.1.0',
    description:
      'C2PA manifest repository, soft binding API, and pHash similarity search for Arweave',
    endpoints: {
      health: 'GET /health',
      search: 'GET /v1/search-similar',
      matches: 'GET/POST /v1/matches/*',
      manifests: 'GET /v1/manifests/:manifestId',
      services: 'GET /v1/services/supportedAlgorithms',
      sign: 'POST /v1/sign',
      cert: 'GET /v1/cert',
      webhook: 'POST /webhook',
    },
  });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    // Initialize database
    await initDatabase();

    // Start HTTP server
    logger.info(`Starting server on port ${config.PORT}`);

    const bun = (globalThis as { Bun?: { serve?: Function } }).Bun;
    if (bun?.serve) {
      bun.serve({
        port: config.PORT,
        fetch: app.fetch,
      });
    } else {
      serve({
        port: config.PORT,
        fetch: app.fetch,
      });
    }

    logger.info(`Trusthash Sidecar running at http://localhost:${config.PORT}`);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
