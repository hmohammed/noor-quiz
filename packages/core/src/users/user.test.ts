import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  asUserId,
  identityId,
  isUlid,
  normaliseDisplayName,
  SUBJECT_PATTERN,
  ULID_PATTERN,
  type IdentityKey,
} from './user';

const INVALID_SUBJECTS = ['', 'a/b', '..', 'a b', 'x'.repeat(129), 'ü'];

describe('normaliseDisplayName', () => {
  it('trims surrounding whitespace', () => {
    expect(normaliseDisplayName('  Alice  ')).toBe('Alice');
  });

  it('normalises to NFC', () => {
    const result = normaliseDisplayName('e\u0301' + 'mma');
    expect(result).toBe('\u00e9mma');
    expect(result).toBe(result?.normalize('NFC'));
  });

  it.each(['عبد الله', 'ዮሐንስ'])('keeps %s as-is', (name) => {
    expect(normaliseDisplayName(name)).toBe(name);
  });

  it('cuts 40 Arabic letters to 32 code points', () => {
    const result = normaliseDisplayName('ب'.repeat(40));
    expect(Array.from(result ?? '')).toHaveLength(32);
  });

  it('trims again after cutting', () => {
    const result = normaliseDisplayName('a'.repeat(31) + ' ' + 'b'.repeat(5));
    expect(result).toBe('a'.repeat(31));
    expect(Array.from(result ?? '')).toHaveLength(31);
  });

  it('never splits an emoji at the 32/33 boundary', () => {
    const result = normaliseDisplayName('a'.repeat(31) + '😀' + 'b');
    expect(result).toBe('a'.repeat(31) + '😀');
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(result).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it.each([['A'], [' '], [''], [null]])('returns null for %j', (name) => {
    expect(normaliseDisplayName(name)).toBeNull();
  });

  it('removes control characters', () => {
    expect(normaliseDisplayName('Al\u0000i\u0007ce')).toBe('Alice');
  });
});

describe('identityId', () => {
  it('joins provider and subject', () => {
    expect(identityId({ provider: 'firebase', subject: 'abc_-1' })).toBe('firebase_abc_-1');
  });

  it.each(INVALID_SUBJECTS)('throws UNAUTHENTICATED for subject %j', (subject) => {
    try {
      identityId({ provider: 'firebase', subject });
      expect.fail('expected identityId to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('UNAUTHENTICATED');
      expect((e as DomainError).details).toEqual({ reason: 'invalid-subject' });
    }
  });

  it('throws UNAUTHENTICATED for a provider other than firebase', () => {
    const key = { provider: 'google', subject: 'abc' } as unknown as IdentityKey;
    expect(() => identityId(key)).toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED', details: { reason: 'invalid-provider' } }),
    );
  });

  it('exposes the subject pattern', () => {
    expect(SUBJECT_PATTERN.test('abc')).toBe(true);
  });
});

describe('isUlid / asUserId', () => {
  const valid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

  it('accepts a valid ULID', () => {
    expect(isUlid(valid)).toBe(true);
    expect(ULID_PATTERN.test(valid)).toBe(true);
    expect(asUserId(valid)).toBe(valid);
  });

  it.each([
    ['lowercase', valid.toLowerCase()],
    ['I', '01ARZ3NDEKTSV4RRFFQ69G5FAI'],
    ['L', '01ARZ3NDEKTSV4RRFFQ69G5FAL'],
    ['O', '01ARZ3NDEKTSV4RRFFQ69G5FAO'],
    ['U', '01ARZ3NDEKTSV4RRFFQ69G5FAU'],
    ['25 chars', valid.slice(0, 25)],
    ['27 chars', valid + 'A'],
    ['first char above 7', '81ARZ3NDEKTSV4RRFFQ69G5FAV'],
  ])('rejects %s', (_label, value) => {
    expect(isUlid(value)).toBe(false);
    expect(() => asUserId(value)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('rejects non-strings', () => {
    expect(isUlid(42)).toBe(false);
    expect(isUlid(null)).toBe(false);
  });
});
