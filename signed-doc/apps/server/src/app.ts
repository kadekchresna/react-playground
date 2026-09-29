/**
 * The composition root.
 *
 * Every dependency in the service is constructed here and nowhere else, so the
 * wiring is readable in one screen and a test can replace any part of it
 * without a module mock.
 *
 * `createApp()` returns the app WITHOUT binding a port, which is what lets
 * `supertest` drive the real middleware stack in-process. `index.ts` is the
 * only file that listens.
 *
 * Middleware order is load-bearing:
 *
 *   requestLogger  -> first, so it sees every request including failures
 *   routers        -> each mounting its own body parser (the JSON parser is
 *                     per-router, so multipart is never touched by it)
 *   errorMapper    -> LAST, after every router, so nothing bypasses it
 */

import express, { type Express } from 'express';

import { ACCOUNT, type AccountConfig } from './config/account.js';
import { LIMITS, type LimitsConfig } from './config/limits.js';
import { errorMapper } from './http/error-mapper.js';
import { createRequestLogger, type RequestLoggerOptions } from './http/request-logger.js';
import { chargePreviewRouter } from './routes/charge-preview.js';
import { envelopesRouter } from './routes/envelopes.js';
import { createChargePreviewService } from './services/charge-preview-service.js';
import { createEnvelopeService } from './services/envelope-service.js';
import { createEnvelopeStore, type EnvelopeStore } from './store/envelope-store.js';

export interface CreateAppOptions {
  /** Substitutable so a suite can seed or inspect envelopes directly. */
  readonly store?: EnvelopeStore;
  readonly account?: AccountConfig;
  readonly limits?: LimitsConfig;
  readonly logger?: RequestLoggerOptions;
}

export function createApp({
  store = createEnvelopeStore(),
  account = ACCOUNT,
  limits = LIMITS,
  logger,
}: CreateAppOptions = {}): Express {
  const app = express();

  // Express's own `X-Powered-By` advertises the stack for free. Off.
  app.disable('x-powered-by');

  // 1. The single store instance, shared by both services.
  // 2. The upload use case, injected with the server-only price/quota/limits.
  const envelopeService = createEnvelopeService({ store, account, limits });
  // 3. The preview use case, reading the same store and the same account.
  const chargePreviewService = createChargePreviewService({ store, account });

  // 4. Logger first, then the routers, each carrying its own body parser.
  app.use(createRequestLogger(logger));
  app.use('/api', envelopesRouter({ envelopeService }));
  app.use('/api', chargePreviewRouter({ chargePreviewService }));

  // 5. The error mapper, registered after every router.
  app.use(errorMapper);

  return app;
}
