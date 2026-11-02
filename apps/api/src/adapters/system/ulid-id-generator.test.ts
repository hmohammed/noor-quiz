import { describe, expect, it } from 'vitest';
import { instantFromMs, isUlid, type Clock } from '@noor/core';
import { UlidIdGenerator } from './ulid-id-generator';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MAX_TIME = 2 ** 48 - 1;

const clockAt = (ms: number): Clock => ({ now: () => instantFromMs(ms) });
const fill = (byte: number) => (bytes: Uint8Array) => {
  bytes.fill(byte);
};

function decodeTime(id: string): number {
  return [...id.slice(0, 10)].reduce((acc, ch) => acc * 32 + CROCKFORD.indexOf(ch), 0);
}

describe('UlidIdGenerator', () => {
  it('encodes time 0 with zero randomness as all zeros', () => {
    expect(new UlidIdGenerator(clockAt(0), fill(0)).newId()).toBe('0'.repeat(26));
  });

  it('encodes the max time with all-0xFF randomness as 7ZZZ…', () => {
    expect(new UlidIdGenerator(clockAt(MAX_TIME), fill(0xff)).newId()).toBe('7' + 'Z'.repeat(25));
  });

  it('puts the clock milliseconds in the first 10 characters', () => {
    const ms = Date.UTC(2026, 10, 2, 12, 0, 0, 123);
    expect(decodeTime(new UlidIdGenerator(clockAt(ms), fill(0x5a)).newId())).toBe(ms);
  });

  it('sorts an id made later after one made earlier', () => {
    const earlier = new UlidIdGenerator(clockAt(1_000), fill(0xff)).newId();
    const later = new UlidIdGenerator(clockAt(1_001), fill(0)).newId();
    expect(later > earlier).toBe(true);
  });

  it('gives 1 000 valid, unique ids with the real random source', () => {
    const gen = new UlidIdGenerator(clockAt(Date.UTC(2026, 0, 1)));
    const ids = Array.from({ length: 1_000 }, () => gen.newId());
    expect(ids.every((id) => isUlid(id))).toBe(true);
    expect(new Set(ids).size).toBe(1_000);
  });

  it.each([-1, MAX_TIME + 1, 1.5])('throws for clock time %d', (ms) => {
    expect(() => new UlidIdGenerator(clockAt(ms), fill(0)).newId()).toThrow(RangeError);
  });
});
