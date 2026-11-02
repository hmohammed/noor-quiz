import { instantFromIso, type IdGenerator } from '@noor/core';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encode(value: number, length: number): string {
  let out = '';
  let rest = value;
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[rest % 32] + out;
    rest = Math.floor(rest / 32);
  }
  return out;
}

/**
 * Deterministic ULIDs for tests: a fixed time prefix (2026-01-01T00:00:00Z) followed by
 * a 16-char counter starting at 1. Strictly increasing; fresh instances repeat the sequence.
 */
export class FakeIdGenerator implements IdGenerator {
  static readonly TIME_PREFIX = encode(instantFromIso('2026-01-01T00:00:00Z'), 10);

  #counter = 0;

  newId(): string {
    this.#counter += 1;
    return FakeIdGenerator.TIME_PREFIX + encode(this.#counter, 16);
  }
}
