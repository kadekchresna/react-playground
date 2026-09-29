/**
 * `POST /api/envelopes` and `GET /api/health`.
 *
 * The handler parses, delegates and maps — nothing else (PRD §9). There is not
 * one validation branch in this file: the parser refuses oversize and surplus
 * parts, the service refuses everything else, and `errorMapper` turns either
 * into a response. If a rule ever appears here, it is in the wrong layer.
 *
 * The router is a factory taking its service so the composition root is the
 * only place that decides what is wired to what, and a test can substitute.
 */

import { Router } from 'express';

import type { EnvelopeService, UploadedFile } from '../services/envelope-service.js';
import { uploadSingleDocument } from '../http/upload-middleware.js';

export interface EnvelopesRouterDependencies {
  readonly envelopeService: EnvelopeService;
}

export function envelopesRouter({ envelopeService }: EnvelopesRouterDependencies): Router {
  const router = Router();

  /** Liveness probe, so the README's run instructions are checkable in one curl. */
  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.post('/envelopes', uploadSingleDocument, (req, res) => {
    // `req.file` is `undefined` when the request carried no file part at all —
    // including when it was not multipart. The service owns that rejection.
    const file = req.file as UploadedFile | undefined;
    res.status(201).json(envelopeService.createFromUpload(file));
  });

  return router;
}
