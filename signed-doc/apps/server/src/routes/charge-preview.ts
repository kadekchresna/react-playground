/**
 * `POST /api/envelopes/:id/charge-preview`.
 *
 * Parses, calls the service, maps the result (PRD §9). No validation branch, no
 * money arithmetic, no knowledge of price or quota — it hands the raw parsed
 * body straight to the service, which owns the fixed five-stage order.
 *
 * `express.json` is mounted HERE rather than globally, so the multipart upload
 * route is never touched by the JSON body parser and the two routes cannot
 * share a body-size ceiling by accident.
 */

import express, { Router } from 'express';

import { MAX_JSON_BYTES } from '../config/limits.js';
import type { ChargePreviewService } from '../services/charge-preview-service.js';

export interface ChargePreviewRouterDependencies {
  readonly chargePreviewService: ChargePreviewService;
}

export function chargePreviewRouter({
  chargePreviewService,
}: ChargePreviewRouterDependencies): Router {
  const router = Router();
  const jsonBody = express.json({ limit: MAX_JSON_BYTES });

  router.post('/envelopes/:id/charge-preview', jsonBody, (req, res) => {
    // `req.body` is whatever the client sent. Every question about its shape —
    // including which keys are even allowed — belongs to the service.
    res.status(200).json(chargePreviewService.preview(req.params['id'] ?? '', req.body));
  });

  return router;
}
