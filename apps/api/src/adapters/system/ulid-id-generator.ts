import type { Clock, IdGenerator } from '@noor/core';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const MAX_TIME = 2 ** 48 - 1;
const RANDOM_BYTES = 10;

/**
 * ULID: 48-bit ms time from the Clock (10 chars) + 80 random bits (16 chars), uppercase
 * Crockford base32. Hand-written so no dependency is needed. Not monotonic within the
 * same millisecond; ids made in the same ms only differ by their random part.
 */
export class UlidIdGenerator implements IdGenerator {
  constructor(
    private readonly clock: Clock,
    private readonly fillRandom: (bytes: Uint8Array) => void = (bytes) => {
      crypto.getRandomValues(bytes);
    },
  ) {}

  newId(): string {
    const ms: number = this.clock.now();
    if (!Number.isInteger(ms) || ms < 0 || ms > MAX_TIME) {
      throw new RangeError('ULID time must be an integer in [0, 2^48 - 1]');
    }
    let time = '';
    let rest = ms;
    for (let i = 0; i < 10; i++) {
      time = CROCKFORD[rest % 32] + time;
      rest = Math.floor(rest / 32);
    }

    const bytes = new Uint8Array(RANDOM_BYTES);
    this.fillRandom(bytes);
    let random = '';
    let buffer = 0;
    let bits = 0;
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        random += CROCKFORD[(buffer >> bits) & 31];
      }
      buffer &= (1 << bits) - 1;
    }
    return time + random;
  }
}
