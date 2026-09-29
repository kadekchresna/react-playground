/**
 * Upload use case, at the service boundary (PRD §7.3, §7.8, §7.9, §7.10, §9).
 *
 * These assertions are about the RULES, not about HTTP. The wire-level versions
 * live in `envelopes.route.test.ts`; testing both is deliberate, because the
 * service is what the PRD calls the decision-maker and it must be correct even
 * if the router is rewritten.
 */

import { describe, expect, it } from 'vitest';

import { ACCOUNT } from '../config/account.js';
import { LIMITS } from '../config/limits.js';
import {
  createEnvelopeService,
  type UploadedFile,
} from '../services/envelope-service.js';
import { ServiceError } from '../services/service-error.js';
import type { EnvelopeRecord, EnvelopeStore } from '../store/envelope-store.js';

type SavedMeta = Omit<EnvelopeRecord, 'id' | 'created_at'>;

/** A store that records exactly what it was handed, so we can inspect it. */
function recordingStore(): { store: EnvelopeStore; saved: SavedMeta[] } {
  const saved: SavedMeta[] = [];
  let sequence = 0;
  const records = new Map<string, EnvelopeRecord>();

  const store: EnvelopeStore = {
    save(meta) {
      saved.push(meta);
      sequence += 1;
      const record: EnvelopeRecord = {
        id: `env_${String(sequence).padStart(2, '0')}`,
        ...meta,
        created_at: new Date().toISOString(),
      };
      records.set(record.id, record);
      return record;
    },
    findById: (id) => records.get(id),
  };

  return { store, saved };
}

function upload(originalname: string, bytes = 1024): UploadedFile {
  const buffer = Buffer.alloc(bytes, 0x41);
  return { originalname, size: buffer.byteLength, buffer };
}

function serviceWith(overrides: { maxUploadBytes?: number } = {}) {
  const { store, saved } = recordingStore();
  return {
    saved,
    store,
    service: createEnvelopeService({
      store,
      account: ACCOUNT,
      limits: { ...LIMITS, ...overrides },
    }),
  };
}

function failureOf(run: () => unknown): { code: string; status: number } {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    const serviceError = error as ServiceError;
    return { code: serviceError.failure.code, status: serviceError.status };
  }
  throw new Error('expected the service to reject, but it returned');
}

describe('createEnvelopeService.createFromUpload', () => {
  it('refuses a request with no file at all', () => {
    const { service } = serviceWith();
    expect(failureOf(() => service.createFromUpload(undefined))).toEqual({
      code: 'FILE_REQUIRED',
      status: 422,
    });
  });

  it('accepts the fixture document and reports its fixture page count', () => {
    const { service } = serviceWith();
    const created = service.createFromUpload(upload('agreement-vendor-2026.pdf', 1_468_006));

    expect(created.envelope_id).toBe('env_01');
    expect(created.document).toEqual({
      filename: 'agreement-vendor-2026.pdf',
      size_bytes: 1_468_006,
      page_count: 8,
    });
  });

  it('reads the page count from the fixture table, not from the bytes', () => {
    const { service } = serviceWith();

    // Identical content, four different names: the count follows the NAME.
    expect(service.createFromUpload(upload('nda-partner.pdf')).document.page_count).toBe(3);
    expect(service.createFromUpload(upload('berita-acara.docx')).document.page_count).toBe(1);
    expect(service.createFromUpload(upload('anything-else.pdf')).document.page_count).toBe(1);
    // Case-insensitive, per PRD §6.
    expect(service.createFromUpload(upload('AGREEMENT-Vendor-2026.PDF')).document.page_count).toBe(
      8,
    );
  });

  it('judges the extension from the sanitized filename, never from a MIME type', () => {
    const { service } = serviceWith();

    // The service is not even given a `mimetype` to be tempted by: the only
    // inputs are the name and the bytes. A `.exe` claiming to be a PDF is
    // therefore refused on its name alone (PRD §7.9).
    expect(failureOf(() => service.createFromUpload(upload('payload.exe')))).toEqual({
      code: 'FILE_TYPE_NOT_ALLOWED',
      status: 422,
    });
    expect(failureOf(() => service.createFromUpload(upload('resume.pdf.exe')))).toEqual({
      code: 'FILE_TYPE_NOT_ALLOWED',
      status: 422,
    });
  });

  it('sanitizes before it judges: a traversal path becomes a bare basename', () => {
    const { service, saved } = serviceWith();

    const created = service.createFromUpload(upload('../../etc/passwd.pdf'));
    expect(created.document.filename).toBe('passwd.pdf');
    expect(created.document.filename).not.toMatch(/[\\/]/);
    expect(saved[0]?.filename).toBe('passwd.pdf');

    // Same traversal, disallowed extension: sanitization happens first, then the
    // extension check runs on what survived.
    expect(failureOf(() => service.createFromUpload(upload('../../x.exe')))).toEqual({
      code: 'FILE_TYPE_NOT_ALLOWED',
      status: 422,
    });
  });

  it('stores an HTML-looking filename verbatim, because escaping is the renderer’s job', () => {
    const { service } = serviceWith();
    const created = service.createFromUpload(upload('<img src=x onerror=alert(1)>.pdf'));

    // Laundering `<` here would make the XSS row pass without the frontend ever
    // proving it renders the name as text (PRD §10 XSS row).
    expect(created.document.filename).toBe('<img src=x onerror=alert(1)>.pdf');
    expect(created.document.filename).not.toContain('/');
  });

  it('rejects a name that sanitizes to nothing usable', () => {
    const { service } = serviceWith();
    expect(failureOf(() => service.createFromUpload(upload('../../')))).toEqual({
      code: 'FILENAME_INVALID',
      status: 422,
    });
  });

  it('enforces the size limit it was injected with, not one it sources itself', () => {
    const { service } = serviceWith({ maxUploadBytes: 1024 });
    expect(failureOf(() => service.createFromUpload(upload('big.pdf', 1025)))).toEqual({
      code: 'FILE_TOO_LARGE',
      status: 422,
    });
    expect(service.createFromUpload(upload('fits.pdf', 1024)).document.size_bytes).toBe(1024);
  });

  it('keeps metadata only — the bytes are discarded after validation', () => {
    const { service, saved } = serviceWith();
    const created = service.createFromUpload(upload('agreement-vendor-2026.pdf', 2048));

    // What reached the store is exactly the three metadata fields, and not one
    // of them is a Buffer (PRD §7.10, ADR-002).
    expect(Object.keys(saved[0] ?? {}).sort()).toEqual(['filename', 'page_count', 'size_bytes']);
    expect(Object.values(saved[0] ?? {}).some((value) => Buffer.isBuffer(value))).toBe(false);

    // And nothing buffer-shaped escapes through the response either.
    expect(JSON.stringify(created)).not.toContain('buffer');
  });

  it('sources price and quota server-side and ignores anything the client sent', () => {
    const { service } = serviceWith();

    // A hostile client cannot put price or quota into a multipart upload at all
    // (`fields: 0`), but the service also takes no such parameter: the only
    // sources are `ACCOUNT.prices` and `ACCOUNT.quotas` (ADR-003, PRD §9).
    const created = service.createFromUpload(upload('nda-partner.pdf'));
    expect(created.price).toEqual({ signature: '5000.00' });
    expect(created.quota).toEqual({ signature: 8 });
    expect(typeof created.price.signature).toBe('string');
  });

  it('issues sequential envelope ids', () => {
    const { service } = serviceWith();
    expect(service.createFromUpload(upload('a.pdf')).envelope_id).toBe('env_01');
    expect(service.createFromUpload(upload('b.pdf')).envelope_id).toBe('env_02');
  });
});
