/**
 * Written BEFORE `page-count.ts`. The table is transcribed by hand from PRD §6:
 *
 *   agreement-vendor-2026.pdf -> 8
 *   nda-partner.pdf           -> 3
 *   berita-acara.docx         -> 1
 *   anything else             -> 1
 *
 * PRD §4 fact 3: page count is NOT derived from file content. The signature
 * asserted here — one string in, one number out — is what makes that true by
 * construction: there is nowhere to pass a buffer.
 */
import { describe, expect, it } from 'vitest';

import { pageCountFor } from '../page-count.js';

describe('pageCountFor (PRD §6)', () => {
  it('returns the fixture page count for each listed filename', () => {
    expect(pageCountFor('agreement-vendor-2026.pdf')).toBe(8);
    expect(pageCountFor('nda-partner.pdf')).toBe(3);
    expect(pageCountFor('berita-acara.docx')).toBe(1);
  });

  it('matches case-insensitively', () => {
    expect(pageCountFor('AGREEMENT-VENDOR-2026.PDF')).toBe(8);
    expect(pageCountFor('Agreement-Vendor-2026.Pdf')).toBe(8);
    expect(pageCountFor('NDA-Partner.pdf')).toBe(3);
  });

  it('returns 1 for any unlisted name', () => {
    expect(pageCountFor('something-else.pdf')).toBe(1);
    expect(pageCountFor('agreement-vendor-2027.pdf')).toBe(1);
    expect(pageCountFor('')).toBe(1);
  });

  it('keys on the sanitized basename only — a path never matches a fixture', () => {
    // Sanitization happens before this call; a name that still carries a path
    // is by definition not one of the three fixtures.
    expect(pageCountFor('../../agreement-vendor-2026.pdf')).toBe(1);
  });

  it('never returns NaN or undefined for hostile input', () => {
    for (const raw of [undefined, null, 8, {}, []]) {
      expect(pageCountFor(raw as unknown as string)).toBe(1);
    }
  });

  it('takes exactly one string argument, so file content cannot reach it', () => {
    expect(pageCountFor).toHaveLength(1);
  });
});
