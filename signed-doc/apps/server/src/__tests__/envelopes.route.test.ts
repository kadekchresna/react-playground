/**
 * `POST /api/envelopes` over real HTTP (PRD §10 rows 1-5, `docs/prompt.md` §7
 * criteria 1-5).
 *
 * Driven through `supertest` against `createApp()` in-process: the whole
 * middleware stack runs — multer, the router, the service, the error mapper —
 * with no port bound and no server to start.
 *
 * The filenames here are constructed with form-data's `filepath` option rather
 * than `filename`, because `filename` is `path.basename`d by the CLIENT. Using
 * it would sanitize the traversal before it ever left the test, and the suite
 * would prove nothing about the server.
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { MAX_UPLOAD_BYTES } from '../config/limits.js';
import { errorMapper } from '../http/error-mapper.js';
import { attachRaw } from './support/attach.js';

/** Bytes are irrelevant to every rule here — only the name and the length are. */
function documentBytes(size = 1024): Buffer {
  return Buffer.alloc(size, 0x41);
}

/**
 * Attach a file under a filename the client does NOT get to clean up first.
 * `contentType` is set independently of the extension on purpose: PRD §7.9
 * forbids the server from believing it.
 */
function attachAs(
  agent: request.Test,
  rawFilename: string,
  bytes: Buffer,
  contentType = 'application/octet-stream',
): request.Test {
  return attachRaw(agent, bytes, { filepath: rawFilename, contentType });
}

describe('GET /api/health', () => {
  it('answers so the README run instructions are checkable in one curl', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/envelopes', () => {
  it('accepts agreement-vendor-2026.pdf with the fixture page count', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes'),
      'agreement-vendor-2026.pdf',
      documentBytes(1_468_006),
      'application/pdf',
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      envelope_id: 'env_01',
      document: {
        filename: 'agreement-vendor-2026.pdf',
        size_bytes: 1_468_006,
        page_count: 8,
      },
      // Case 2 §B1 adds the second priced resource. The Case-1 figures are
      // byte-identical — a new key, not a changed value.
      price: { signature: '5000.00', meterai: '10000.10' },
      quota: { signature: 8, meterai: 3 },
    });
    // Money crosses the wire as a decimal string, never a JSON number (PRD §6).
    expect(response.text).toContain('"signature":"5000.00"');
    expect(response.text).toContain('"meterai":"10000.10"');
    expect(response.text).not.toMatch(/"meterai":\s*1000[01]/);
  });

  it('rejects .exe even when the client swears it is a PDF', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes'),
      'payload.exe',
      documentBytes(),
      'application/pdf',
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('rejects a double extension: the LAST one decides', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes'),
      'resume.pdf.exe',
      documentBytes(),
      'application/pdf',
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('stores ../../etc/passwd.pdf as a bare basename with no path component', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes'),
      '../../etc/passwd.pdf',
      documentBytes(),
      'application/pdf',
    );

    expect(response.status).toBe(201);
    expect(response.body.document.filename).toBe('passwd.pdf');
    expect(response.body.document.filename).not.toMatch(/[\\/]|\.\./);
  });

  it('returns an HTML-looking filename verbatim as a basename', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes'),
      '<img src=x onerror=alert(1)>.pdf',
      documentBytes(),
      'application/pdf',
    );

    // Not escaped and not laundered here: the server's job is to guarantee a
    // basename, the renderer's job is to print it as text (PRD §10 XSS row).
    expect(response.status).toBe(201);
    expect(response.body.document.filename).toBe('<img src=x onerror=alert(1)>.pdf');
    expect(response.body.document.filename).not.toMatch(/[\\/]/);
  });

  it('rejects a request carrying no file at all', async () => {
    const response = await request(createApp()).post('/api/envelopes');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });

  it(
    'rejects a payload over the 25 MB limit on the SERVER, as 422 not 413',
    async () => {
      const response = await attachAs(
        request(createApp()).post('/api/envelopes'),
        'huge.pdf',
        documentBytes(MAX_UPLOAD_BYTES + 1),
        'application/pdf',
      );

      // `LD-27`: one status and one envelope shape for every upload failure, so
      // the frontend branches on `error.code` alone.
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    },
    30_000,
  );

  it('refuses a second file part at the parser (files: 1)', async () => {
    const response = await attachAs(
      attachAs(
        request(createApp()).post('/api/envelopes'),
        'first.pdf',
        documentBytes(),
        'application/pdf',
      ),
      'second.pdf',
      documentBytes(),
      'application/pdf',
    );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
  });

  it('refuses a smuggled text field at the parser (fields: 0)', async () => {
    const response = await attachAs(
      request(createApp()).post('/api/envelopes').field('total_charge', '1.00'),
      'agreement-vendor-2026.pdf',
      documentBytes(),
      'application/pdf',
    );

    // There is no multipart route by which a client can supply a price, a total
    // or a quota — the parser refuses the part before a handler sees it (PRD §9).
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_FIELD');
  });

  it('never leaks an internal error to the client', async () => {
    // A router whose service throws something that is not a `ServiceError`:
    // the mapper must answer `500` with nothing about what actually broke.
    const app = express();
    app.get('/boom', () => {
      throw new Error('connection string postgres://user:hunter2@db/prod');
    });
    app.use(errorMapper);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    });
    expect(response.text).not.toContain('hunter2');
    expect(response.text).not.toContain('at ');
  });

  it('keeps envelopes addressable for the preview endpoint', async () => {
    const app = createApp();
    const created = await attachAs(
      request(app).post('/api/envelopes'),
      'nda-partner.pdf',
      documentBytes(),
      'application/pdf',
    );

    expect(created.body.envelope_id).toBe('env_01');
    expect(created.body.document.page_count).toBe(3);

    // A different app instance has its own store — the map is per-process state,
    // not global state leaking between suites (ADR-002).
    const other = await request(createApp())
      .post(`/api/envelopes/${created.body.envelope_id}/charge-preview`)
      .send({ recipients: [{ name: 'A', email: 'a@example.test', signature_count: 1 }] });
    expect(other.status).toBe(404);
  });
});
