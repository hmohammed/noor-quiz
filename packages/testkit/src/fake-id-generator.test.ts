import { describe, expect, it } from 'vitest';
import { isUlid } from '@noor/core';
import { FakeIdGenerator } from './fake-id-generator';

describe('FakeIdGenerator', () => {
  it('returns valid, strictly increasing ULIDs', () => {
    const ids = new FakeIdGenerator();
    let previous = '';
    for (let i = 0; i < 100; i++) {
      const id = ids.newId();
      expect(isUlid(id)).toBe(true);
      expect(id > previous).toBe(true);
      previous = id;
    }
  });

  it('starts with the 2026-01-01 time prefix and a counter of 1', () => {
    expect(new FakeIdGenerator().newId()).toBe(FakeIdGenerator.TIME_PREFIX + '0000000000000001');
  });

  it('produces the same sequence from two fresh instances', () => {
    const a = new FakeIdGenerator();
    const b = new FakeIdGenerator();
    const seqA = Array.from({ length: 5 }, () => a.newId());
    const seqB = Array.from({ length: 5 }, () => b.newId());
    expect(seqA).toEqual(seqB);
  });
});
