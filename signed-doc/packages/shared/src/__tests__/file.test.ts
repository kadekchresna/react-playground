/**
 * Written BEFORE `file.ts`. Expected values are hand-derived from PRD §6
 * (allowed extensions, 200-character cap after sanitization), PRD §7.8-§7.9
 * (untrusted filename, extension judged from the sanitized name) and the PRD
 * §10 path-traversal and XSS acceptance rows.
 *
 * Note the deliberate non-hardening assertion: `<img src=x onerror=alert(1)>.pdf`
 * must survive sanitization UNCHANGED. Stripping angle brackets here would make
 * the XSS row pass for the wrong reason and hide whether the frontend really
 * renders the filename as a text node.
 */
import { describe, expect, it } from 'vitest';

import { isValidationFailure, type ValidationFailure } from '../errors.js';
import {
  extensionOf,
  isAllowedExtension,
  sanitizeFilename,
  validateFileMeta,
  type SanitizedFilename,
} from '../file.js';

/** Narrow to the success branch, failing loudly with the code if it is not. */
function ok(result: SanitizedFilename | ValidationFailure): SanitizedFilename {
  if (isValidationFailure(result)) {
    throw new Error(`expected a sanitized filename, got ${result.code}`);
  }
  return result;
}

function failureOf(result: unknown): ValidationFailure {
  if (!isValidationFailure(result)) {
    throw new Error(`expected a ValidationFailure, got ${JSON.stringify(result)}`);
  }
  return result;
}

describe('sanitizeFilename — path components', () => {
  it('reduces a traversal path to a bare basename (PRD §10)', () => {
    expect(ok(sanitizeFilename('../../etc/passwd.pdf')).value).toBe('passwd.pdf');
  });

  it('strips Windows separators too', () => {
    expect(ok(sanitizeFilename('..\\..\\windows\\system32\\evil.pdf')).value).toBe('evil.pdf');
    expect(ok(sanitizeFilename('C:\\Users\\rina\\agreement.pdf')).value).toBe('agreement.pdf');
  });

  it('keeps a name that is already a bare basename', () => {
    const result = ok(sanitizeFilename('agreement-vendor-2026.pdf'));
    expect(result.value).toBe('agreement-vendor-2026.pdf');
    expect(result.truncated).toBe(false);
  });

  it('trims surrounding whitespace and drops control characters', () => {
    expect(ok(sanitizeFilename('  nda-partner.pdf  ')).value).toBe('nda-partner.pdf');
    // A NUL byte is the classic "truncate the name after the check" trick.
    expect(ok(sanitizeFilename('safe.pdf\u0000.exe')).value).toBe('safe.pdf.exe');
    expect(ok(sanitizeFilename('log\ninjection.pdf')).value).toBe('loginjection.pdf');
  });

  it('rejects anything that cannot be reduced to a basename', () => {
    expect(failureOf(sanitizeFilename('')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename('   ')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename('../..')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename('/')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename('some/dir/')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename('.')).code).toBe('FILENAME_INVALID');
    expect(failureOf(sanitizeFilename(null as unknown as string)).code).toBe('FILENAME_INVALID');
  });
});

describe('sanitizeFilename — XSS payload is preserved, not laundered', () => {
  it('leaves the script-looking basename byte-for-byte intact (PRD §10)', () => {
    const payload = '<img src=x onerror=alert(1)>.pdf';
    const result = ok(sanitizeFilename(payload));
    expect(result.value).toBe(payload);
    expect(result.value).toContain('<');
    expect(result.value).toContain('>');
  });

  it('still strips the path from a payload that also traverses', () => {
    expect(ok(sanitizeFilename('../../<img src=x onerror=alert(1)>.pdf')).value).toBe(
      '<img src=x onerror=alert(1)>.pdf',
    );
  });

  it('treats a slash inside a payload as the path separator it is', () => {
    // `</script>` contains a `/`. A slash is not a legal filename character,
    // so `../<script>alert(1)</script>.pdf` really is the file `script>.pdf`
    // inside a strangely named directory. Keeping the last segment is the
    // safe reading; "reassembling" the payload would mean interpreting the
    // attacker's intent instead of the bytes.
    expect(ok(sanitizeFilename('../<script>alert(1)</script>.pdf')).value).toBe('script>.pdf');
  });
});

describe('sanitizeFilename — 200-character cap (PRD §6, LD-25)', () => {
  it('leaves a 200-character name untouched', () => {
    const name = `${'a'.repeat(196)}.pdf`; // 196 + 1 + 3 = 200
    expect(name).toHaveLength(200);
    const result = ok(sanitizeFilename(name));
    expect(result.value).toBe(name);
    expect(result.truncated).toBe(false);
  });

  it('truncates a 250-character name to exactly 200, extension intact', () => {
    const name = `${'a'.repeat(246)}.pdf`; // 246 + 1 + 3 = 250
    expect(name).toHaveLength(250);
    const result = ok(sanitizeFilename(name));
    expect(result.value).toHaveLength(200);
    expect(result.value.endsWith('.pdf')).toBe(true);
    expect(result.value).toBe(`${'a'.repeat(196)}.pdf`);
    expect(result.truncated).toBe(true);
  });

  it('truncates an extensionless name to 200 characters', () => {
    const result = ok(sanitizeFilename('b'.repeat(250)));
    expect(result.value).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });

  it('rejects a name whose extension alone fills the budget', () => {
    const result = sanitizeFilename(`doc.${'x'.repeat(200)}`);
    expect(failureOf(result).code).toBe('FILENAME_INVALID');
  });

  it('truncation happens after path stripping, not before', () => {
    const raw = `/very/deep/path/${'c'.repeat(246)}.pdf`;
    const result = ok(sanitizeFilename(raw));
    expect(result.value).toBe(`${'c'.repeat(196)}.pdf`);
  });
});

describe('extensionOf', () => {
  it('returns the lowercased extension without the dot', () => {
    expect(extensionOf('agreement.pdf')).toBe('pdf');
    expect(extensionOf('SCAN.PDF')).toBe('pdf');
    expect(extensionOf('photo.JPeG')).toBe('jpeg');
  });

  it('takes the LAST extension, which is what makes .pdf.exe catchable', () => {
    expect(extensionOf('resume.pdf.exe')).toBe('exe');
    expect(extensionOf('a.b.c.docx')).toBe('docx');
  });

  it('returns an empty string when there is no extension', () => {
    expect(extensionOf('README')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(extensionOf('.pdf')).toBe(''); // dotfile: no stem, so no extension
  });
});

describe('isAllowedExtension (PRD §6)', () => {
  it('accepts all six allowed extensions in any case', () => {
    for (const ext of ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']) {
      expect(isAllowedExtension(ext)).toBe(true);
      expect(isAllowedExtension(ext.toUpperCase())).toBe(true);
      expect(isAllowedExtension(`${ext[0]?.toUpperCase() ?? ''}${ext.slice(1)}`)).toBe(true);
    }
  });

  it('rejects everything else', () => {
    for (const ext of ['exe', 'sh', 'pdfx', 'zip', 'svg', 'txt', '', 'p df']) {
      expect(isAllowedExtension(ext)).toBe(false);
    }
  });
});

describe('validateFileMeta', () => {
  const MAX = 25 * 1024 * 1024; // the limit is a PARAMETER — shared never sources it

  it('accepts an allowed document and returns the sanitized name', () => {
    const result = validateFileMeta({
      filename: '../../etc/agreement-vendor-2026.PDF',
      sizeBytes: 1_468_006,
      maxSizeBytes: MAX,
    });
    expect(isValidationFailure(result)).toBe(false);
    expect(result).toEqual({ filename: 'agreement-vendor-2026.PDF', sizeBytes: 1_468_006 });
  });

  it('rejects .exe and the double-extension .pdf.exe (PRD §10)', () => {
    expect(
      failureOf(validateFileMeta({ filename: 'malware.exe', sizeBytes: 10, maxSizeBytes: MAX })).code,
    ).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(
      failureOf(validateFileMeta({ filename: 'resume.pdf.exe', sizeBytes: 10, maxSizeBytes: MAX }))
        .code,
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('judges the extension from the sanitized name, never from a directory (PRD §7.9)', () => {
    // The ".pdf" here belongs to a directory, not to the file.
    expect(
      failureOf(validateFileMeta({ filename: 'folder.pdf/payload.exe', sizeBytes: 10, maxSizeBytes: MAX }))
        .code,
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('rejects an unusable filename before it looks at anything else', () => {
    expect(
      failureOf(validateFileMeta({ filename: '../..', sizeBytes: 10, maxSizeBytes: MAX })).code,
    ).toBe('FILENAME_INVALID');
  });

  it('treats a zero-byte payload as no document at all', () => {
    expect(
      failureOf(validateFileMeta({ filename: 'agreement.pdf', sizeBytes: 0, maxSizeBytes: MAX })).code,
    ).toBe('FILE_REQUIRED');
    expect(
      failureOf(validateFileMeta({ filename: 'agreement.pdf', sizeBytes: -1, maxSizeBytes: MAX })).code,
    ).toBe('FILE_REQUIRED');
  });

  it('enforces the caller-supplied size limit and names it in the message', () => {
    const failure = failureOf(
      validateFileMeta({ filename: 'agreement.pdf', sizeBytes: MAX + 1, maxSizeBytes: MAX }),
    );
    expect(failure.code).toBe('FILE_TOO_LARGE');
    expect(failure.message).toContain('25 MB');
  });

  it('accepts a file exactly on the limit', () => {
    const result = validateFileMeta({
      filename: 'agreement.pdf',
      sizeBytes: MAX,
      maxSizeBytes: MAX,
    });
    expect(isValidationFailure(result)).toBe(false);
  });

  it('reports a different limit when a different limit is passed in', () => {
    const failure = failureOf(
      validateFileMeta({ filename: 'agreement.pdf', sizeBytes: 2048, maxSizeBytes: 1024 }),
    );
    expect(failure.message).toContain('1 KB');
  });
});
