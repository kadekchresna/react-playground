/**
 * The composition root itself: middleware order, the per-router body parser,
 * and the one structured log line per request (`LD-30`).
 *
 * These are the properties that make every other suite meaningful — if the
 * error mapper were not last, or the JSON parser were global, the rules would
 * still be right and the responses would still be wrong.
 */

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import type { RequestLogLine } from '../http/request-logger.js';
import { attachRaw } from './support/attach.js';

/** Collect the logger's output instead of writing it to the console. */
function appWithCapturedLog(): { app: ReturnType<typeof createApp>; lines: RequestLogLine[] } {
  const lines: RequestLogLine[] = [];
  const app = createApp({ logger: { enabled: true, write: (line) => lines.push(line) } });
  return { app, lines };
}

describe('createApp', () => {
  it('is drivable in-process with no port bound', async () => {
    // No `listen`, no port, no teardown — `supertest` runs the real stack.
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200);
  });

  it('emits exactly one structured log line per request', async () => {
    const { app, lines } = appWithCapturedLog();
    await request(app).get('/api/health');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      msg: 'request',
      method: 'GET',
      path: '/api/health',
      status: 200,
      error_code: null,
    });
    expect(typeof lines[0]?.duration_ms).toBe('number');
  });

  it('logs the error code that was actually sent', async () => {
    const { app, lines } = appWithCapturedLog();
    await request(app)
      .post('/api/envelopes/env_999/charge-preview')
      .send({ recipients: [{ name: 'A', email: 'a@example.test', signature_count: 1 }] });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      method: 'POST',
      path: '/api/envelopes/env_999/charge-preview',
      status: 404,
      error_code: 'ENVELOPE_NOT_FOUND',
    });
  });

  it('never logs a filename, an email address or a request body', async () => {
    const { app, lines } = appWithCapturedLog();
    await attachRaw(request(app).post('/api/envelopes'), Buffer.alloc(32, 0x41), {
      filepath: 'nda-partner.pdf',
      contentType: 'application/pdf',
    });

    // PRD §5: no real personal data in logs, and the filename is untrusted
    // input that would otherwise be a log-injection carrier.
    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain('nda-partner');
    expect(serialized).not.toContain('@example.test');
  });

  it('is silent by default under the test runner, so suite output stays clean', async () => {
    const lines: RequestLogLine[] = [];
    // `enabled` unset -> falls back to NODE_ENV, which vitest sets to "test".
    const app = createApp({ logger: { write: (line) => lines.push(line) } });
    await request(app).get('/api/health');
    expect(lines).toHaveLength(0);
  });

  it('keeps the JSON body parser off the multipart route', async () => {
    // A 70 KB JSON body is past the preview route's 64 KB ceiling. Sent to the
    // upload route it must be ignored entirely, not rejected as an oversize
    // entity — which is only true if `express.json` is mounted per-router.
    const response = await request(createApp())
      .post('/api/envelopes')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(70 * 1024) }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });

  it('gives each app instance its own store', async () => {
    const first = createApp();
    const second = createApp();

    const attach = (app: ReturnType<typeof createApp>) =>
      attachRaw(request(app).post('/api/envelopes'), Buffer.alloc(16, 0x41), {
        filepath: 'nda-partner.pdf',
        contentType: 'application/pdf',
      });

    expect((await attach(first)).body.envelope_id).toBe('env_01');
    expect((await attach(second)).body.envelope_id).toBe('env_01');
    expect((await attach(first)).body.envelope_id).toBe('env_02');
  });

  it('does not advertise the server stack', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
