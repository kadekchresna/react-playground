/**
 * Money — integer minor units held in a `bigint` (ADR-006, LD-22).
 *
 * `1 IDR === 100n`. A `bigint` cannot hold a fractional value, so "never a
 * binary float" (PRD §4 fact 1) is enforced by the type system rather than by
 * convention. `BigInt` is also not JSON-serializable, which forces every money
 * value through `formatDecimalString` at the wire boundary — exactly what the
 * contract demands, since every monetary value on the wire is a decimal string
 * with 2 fraction digits.
 *
 * These two conversion functions are the ONLY decimal-string conversion points
 * in the system. No price, quota or limit is read here: this module knows how
 * to do arithmetic, never what the numbers mean (ADR-003).
 */

/** Integer minor units. 1 IDR === 100n, so `"5000.00"` is `500000n`. */
export type Minor = bigint;

/** Unsigned, exactly two fraction digits. Matches the `Money` wire schema. */
const DECIMAL_STRING = /^\d+\.\d{2}$/;

/**
 * Parse a wire money string into minor units.
 *
 * Strict by design: the contract says 2 fraction digits, so `"5000"` and
 * `"5000.0"` are malformed rather than "close enough". A lenient parser here
 * would be the one place a float-shaped value could slip in.
 *
 * @throws RangeError when `s` is not an unsigned 2-decimal string.
 */
export function parseDecimalString(s: string): Minor {
  if (typeof s !== 'string' || !DECIMAL_STRING.test(s)) {
    throw new RangeError(
      `Money must be an unsigned decimal string with 2 fraction digits, received ${JSON.stringify(s)}`,
    );
  }
  const dot = s.indexOf('.');
  const whole = s.slice(0, dot);
  const fraction = s.slice(dot + 1);
  return BigInt(whole) * 100n + BigInt(fraction);
}

/**
 * Render minor units as the wire money string: always 2 fraction digits.
 *
 * @throws TypeError when handed anything that is not a `bigint` — that guard is
 * what stops a stray `number` from being formatted as if it were exact.
 */
export function formatDecimalString(m: Minor): string {
  if (typeof m !== 'bigint') {
    throw new TypeError(`Money must be a bigint in minor units, received ${typeof m}`);
  }
  const negative = m < 0n;
  const absolute = negative ? -m : m;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? '-' : ''}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

/**
 * Multiply an amount by a whole count — a signature count, never a money value.
 * The count widens to `bigint` here so the product stays exact.
 *
 * @throws RangeError when `n` is not a non-negative safe integer.
 */
export function multiplyMinor(m: Minor, n: number): Minor {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`Multiplier must be a non-negative integer count, received ${String(n)}`);
  }
  return m * BigInt(n);
}

/** Exact sum of minor-unit amounts. An empty list sums to `0n`. */
export function sumMinor(xs: readonly Minor[]): Minor {
  let total = 0n;
  for (const x of xs) {
    total += x;
  }
  return total;
}
