/**
 * Written BEFORE `money.ts`. Every expected value below is derived by hand from
 * PRD §6 (`"5000.00"` per signature, no tax, no discount, no intermediate
 * rounding) and from the definition `1 IDR === 100n` — never copied from an
 * implementation run.
 *
 * Hand derivation of the minor-unit expectations used here:
 *   "5000.00"  -> 5000 * 100 +  0 =   500000
 *   "10000.10" -> 10000 * 100 + 10 =  1000010
 *   "15000.00" -> 15000 * 100 +  0 =  1500000
 *   "20000.20" -> 20000 * 100 + 20 =  2000020
 *   "25000.10" -> 25000 * 100 + 10 =  2500010
 *   "45000.30" -> 45000 * 100 + 30 =  4500030
 *
 * The two sum assertions are deliberate float traps: in IEEE-754,
 * `25000.1 + 20000.2` is 45000.299999999996, so an implementation that ever
 * touches a binary float fails here instead of silently shipping.
 */
import { describe, expect, it } from 'vitest';

import {
  formatDecimalString,
  multiplyMinor,
  parseDecimalString,
  sumMinor,
  type Minor,
} from '../money.js';

describe('parseDecimalString', () => {
  it('converts a 2-decimal string to integer minor units', () => {
    expect(parseDecimalString('5000.00')).toBe(500000n);
    expect(parseDecimalString('10000.10')).toBe(1000010n);
    expect(parseDecimalString('0.00')).toBe(0n);
    expect(parseDecimalString('0.01')).toBe(1n);
    expect(parseDecimalString('0.99')).toBe(99n);
    expect(parseDecimalString('1.00')).toBe(100n);
  });

  it('keeps precision far beyond Number.MAX_SAFE_INTEGER', () => {
    // 99999999999999999.99 has 19 significant digits; a float would round it.
    expect(parseDecimalString('99999999999999999.99')).toBe(9999999999999999999n);
  });

  const malformed = [
    '5000', // no fraction part
    '5000.0', // one fraction digit
    '5000.000', // three fraction digits
    '-1.00', // signed
    '+1.00',
    'abc',
    '',
    ' 5000.00', // untrimmed
    '5000.00 ',
    '5,000.00', // grouped
    '5e3.00',
    '.00',
    '5000.', // trailing dot
    '5000.0a',
  ];

  for (const input of malformed) {
    it(`rejects ${JSON.stringify(input)} with a RangeError`, () => {
      expect(() => parseDecimalString(input)).toThrow(RangeError);
    });
  }

  it('rejects non-string input with a RangeError', () => {
    expect(() => parseDecimalString(5000 as unknown as string)).toThrow(RangeError);
    expect(() => parseDecimalString(null as unknown as string)).toThrow(RangeError);
    expect(() => parseDecimalString(undefined as unknown as string)).toThrow(RangeError);
  });
});

describe('formatDecimalString', () => {
  it('always renders exactly two fraction digits', () => {
    expect(formatDecimalString(0n)).toBe('0.00');
    expect(formatDecimalString(1n)).toBe('0.01');
    expect(formatDecimalString(50n)).toBe('0.50');
    expect(formatDecimalString(99n)).toBe('0.99');
    expect(formatDecimalString(100n)).toBe('1.00');
    expect(formatDecimalString(500000n)).toBe('5000.00');
    expect(formatDecimalString(1500000n)).toBe('15000.00');
  });

  it('rejects anything that is not a bigint, so a float can never be formatted', () => {
    expect(() => formatDecimalString(1.5 as unknown as Minor)).toThrow(TypeError);
    expect(() => formatDecimalString('100' as unknown as Minor)).toThrow(TypeError);
  });
});

describe('round trip', () => {
  const table = ['0.00', '0.05', '1.00', '5000.00', '10000.10', '15000.00', '45000.30'];

  for (const value of table) {
    it(`${value} survives parse -> format unchanged`, () => {
      expect(formatDecimalString(parseDecimalString(value))).toBe(value);
    });
  }
});

describe('multiplyMinor', () => {
  it('multiplies by an integer count exactly', () => {
    // PRD §6: 3 signatures at "5000.00" is "15000.00" (PRD §10 Rina + Budi row).
    expect(formatDecimalString(multiplyMinor(parseDecimalString('5000.00'), 3))).toBe('15000.00');
    expect(formatDecimalString(multiplyMinor(parseDecimalString('5000.00'), 20))).toBe('100000.00');
    expect(formatDecimalString(multiplyMinor(parseDecimalString('5000.00'), 0))).toBe('0.00');
    // A fractional price multiplied out stays exact: 10000.10 * 3 = 30000.30
    expect(formatDecimalString(multiplyMinor(parseDecimalString('10000.10'), 3))).toBe('30000.30');
  });

  it('refuses a non-integer or negative multiplier', () => {
    const price = parseDecimalString('5000.00');
    expect(() => multiplyMinor(price, 2.5)).toThrow(RangeError);
    expect(() => multiplyMinor(price, -1)).toThrow(RangeError);
    expect(() => multiplyMinor(price, Number.NaN)).toThrow(RangeError);
    expect(() => multiplyMinor(price, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => multiplyMinor(price, '3' as unknown as number)).toThrow(RangeError);
  });
});

describe('sumMinor', () => {
  it('sums an empty list to zero', () => {
    expect(formatDecimalString(sumMinor([]))).toBe('0.00');
  });

  it('adds fractional amounts with no float drift', () => {
    // 10000.10 + 15000.00 = 25000.10 exactly.
    expect(
      formatDecimalString(sumMinor([parseDecimalString('10000.10'), parseDecimalString('15000.00')])),
    ).toBe('25000.10');

    // 25000.10 + 20000.20 = 45000.30 exactly.
    // IEEE-754 would give 45000.299999999996 here.
    expect(
      formatDecimalString(sumMinor([parseDecimalString('25000.10'), parseDecimalString('20000.20')])),
    ).toBe('45000.30');
  });

  it('sums a per-recipient breakdown the way charge preview does', () => {
    // Rina 2 signatures + Budi 1 signature at "5000.00" => "15000.00".
    const unit = parseDecimalString('5000.00');
    const rows = [multiplyMinor(unit, 2), multiplyMinor(unit, 1)];
    expect(formatDecimalString(sumMinor(rows))).toBe('15000.00');
  });
});
