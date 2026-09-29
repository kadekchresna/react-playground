/**
 * Display-only money rendering (LD-11, ADR-006).
 *
 * `"15000.00"` -> `Rp15.000,00`.
 *
 * This is the LAST step before a value reaches the screen, and its output never
 * re-enters a calculation. Every arithmetic path upstream is `bigint` minor
 * units inside `@signed-doc/shared`; the wire value in both directions stays a
 * plain 2-decimal decimal string. No i18n framework — `Intl.NumberFormat` ships
 * with the platform, and the only locale in this exercise is `id-ID`.
 *
 * The integer part is grouped as a `bigint` rather than a `number`, so a value
 * beyond `Number.MAX_SAFE_INTEGER` still renders exactly. That the type system
 * refuses to hand a float in here is the whole point of `ADR-006`.
 */

/** The wire contract: unsigned, exactly two fraction digits. */
const WIRE_MONEY = /^\d+\.\d{2}$/;

const GROUPING = new Intl.NumberFormat('id-ID', { useGrouping: true, maximumFractionDigits: 0 });

/**
 * Format a wire money string for display.
 *
 * A malformed value is shown verbatim behind the `Rp` prefix instead of
 * throwing: this runs inside render, and a formatting slip must never blank the
 * page. The server is the authority on what a valid amount is.
 */
export function formatIdr(decimalString: string): string {
  if (typeof decimalString !== 'string' || !WIRE_MONEY.test(decimalString)) {
    return `Rp${String(decimalString)}`;
  }

  const dot = decimalString.indexOf('.');
  const whole = GROUPING.format(BigInt(decimalString.slice(0, dot)));
  const fraction = decimalString.slice(dot + 1);
  return `Rp${whole},${fraction}`;
}

/** `1468006` -> `1.4 MB`. Byte sizes are not money and never go through `formatIdr`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
