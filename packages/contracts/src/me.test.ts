import { describe, expect, it } from 'vitest';
import { MeResponse } from './me';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const GEEZ_32 = 'ሀ'.repeat(32);
const EMOJI_32 = '😀'.repeat(32);

describe('MeResponse', () => {
  it.each([
    ['null', null],
    ['Latin with a diacritic', 'Åsa'],
    ['Arabic', 'حسن'],
    ["Ge'ez", 'ሀሰን'],
    ["32 Ge'ez code points", GEEZ_32],
    ['32 emoji (64 UTF-16 units)', EMOJI_32],
  ])('accepts a ULID with displayName %s', (_label, displayName) => {
    expect(MeResponse.parse({ userId: ULID, displayName })).toEqual({
      userId: ULID,
      displayName,
    });
  });

  it('counts 32 emoji as 64 UTF-16 units, so the cap is in code points', () => {
    expect(EMOJI_32.length).toBe(64);
  });

  it.each([
    ['a non-ULID userId', { userId: 'uid-alice', displayName: null }],
    ['a lowercase ULID', { userId: ULID.toLowerCase(), displayName: null }],
    ['a 1-code-point name', { userId: ULID, displayName: 'A' }],
    ['a 1-emoji name', { userId: ULID, displayName: '😀' }],
    ['a 33-code-point name', { userId: ULID, displayName: 'ሀ'.repeat(33) }],
    ['a missing displayName', { userId: ULID }],
  ])('rejects %s', (_label, body) => {
    expect(MeResponse.safeParse(body).success).toBe(false);
  });

  it.each([
    ['uid', { userId: ULID, displayName: null, uid: 'x' }],
    ['subject', { userId: ULID, displayName: null, subject: 'x' }],
    ['email', { userId: ULID, displayName: null, email: 'a@example.com' }],
  ])('throws on an extra %s key (strict)', (_label, body) => {
    expect(() => MeResponse.parse(body)).toThrow();
  });
});
