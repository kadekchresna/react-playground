/**
 * Page count comes from a fixture table, never from the file's content
 * (PRD §4 fact 3, PRD §6).
 *
 * That is why this function takes a filename and nothing else: with no buffer
 * parameter there is no way for content parsing to creep in later, and the
 * uploaded bytes stay discardable (ADR-002).
 *
 * The key is the SANITIZED basename, compared case-insensitively.
 */

const PAGE_COUNT_FIXTURES: ReadonlyMap<string, number> = new Map([
  ['agreement-vendor-2026.pdf', 8],
  ['nda-partner.pdf', 3],
  ['berita-acara.docx', 1],
]);

/** PRD §6: any name outside the fixture table has one page. */
export const DEFAULT_PAGE_COUNT = 1;

export function pageCountFor(sanitizedFilename: string): number {
  if (typeof sanitizedFilename !== 'string') return DEFAULT_PAGE_COUNT;
  return PAGE_COUNT_FIXTURES.get(sanitizedFilename.trim().toLowerCase()) ?? DEFAULT_PAGE_COUNT;
}
