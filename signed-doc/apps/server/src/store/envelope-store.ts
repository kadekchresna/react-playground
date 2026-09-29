/**
 * In-memory envelope metadata (ADR-002).
 *
 * PRD §4 allows in-memory storage and PRD §7.10 allows discarding the uploaded
 * bytes after validation, keeping only metadata. This store takes that literally:
 * the record has no buffer field, so there is nowhere for file content to be
 * retained even by accident, and a process restart is a complete erasure.
 *
 * Recipients are deliberately NOT stored (`LD-20`): `charge-preview` is a pure
 * function of its request plus server-sourced price and quota, which makes it
 * idempotent and safe across concurrent tabs.
 *
 * Two methods, no query language, no SQL — which is why SQL injection is not
 * yet a live concern here while input validation still is (PRD §9).
 */

/** Exactly what survives an upload. No content, no recipients. */
export interface EnvelopeRecord {
  readonly id: string;
  /** Sanitized basename — never the raw client-supplied name (PRD §7.8). */
  readonly filename: string;
  readonly size_bytes: number;
  readonly page_count: number;
  readonly created_at: string;
}

/** The port the services depend on. A real repository can replace it verbatim. */
export interface EnvelopeStore {
  save(meta: Omit<EnvelopeRecord, 'id' | 'created_at'>): EnvelopeRecord;
  findById(id: string): EnvelopeRecord | undefined;
}

/** `env_01`, `env_02`, ... — PRD §9's own example shape. */
function envelopeId(sequence: number): string {
  return `env_${String(sequence).padStart(2, '0')}`;
}

export function createEnvelopeStore(): EnvelopeStore {
  const records = new Map<string, EnvelopeRecord>();
  let sequence = 0;

  return {
    save(meta) {
      sequence += 1;
      const record: EnvelopeRecord = {
        id: envelopeId(sequence),
        filename: meta.filename,
        size_bytes: meta.size_bytes,
        page_count: meta.page_count,
        created_at: new Date().toISOString(),
      };
      records.set(record.id, record);
      return record;
    },

    /** `undefined` for an unknown id — the input to the `404` path (PRD §9). */
    findById(id) {
      return typeof id === 'string' ? records.get(id) : undefined;
    },
  };
}
