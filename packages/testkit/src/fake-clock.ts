import {
  addDuration,
  durationToMs,
  instantFromIso,
  instantFromMs,
  type Clock,
  type Duration,
  type Instant,
} from '@noor/core';

/**
 * Deterministic Clock for tests. Starts at a fixed instant (never system time) and
 * only moves when the test calls `set()` or `advance()`.
 */
export class FakeClock implements Clock {
  static readonly DEFAULT_START: Instant = instantFromIso('2026-01-01T00:00:00.000Z');

  #current: Instant;

  constructor(start: Instant | string = FakeClock.DEFAULT_START) {
    this.#current = FakeClock.#toInstant(start);
  }

  now(): Instant {
    return this.#current;
  }

  /** Jump to an instant, given as an Instant or an ISO-8601 string ending in `Z`. */
  set(at: Instant | string): this {
    this.#current = FakeClock.#toInstant(at);
    return this;
  }

  /** Move forward by milliseconds or a Duration. Moving backwards throws. */
  advance(d: Duration): this {
    const ms = durationToMs(d);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError('FakeClock.advance() needs a finite, non-negative duration');
    }
    this.#current = addDuration(this.#current, ms);
    return this;
  }

  static #toInstant(at: Instant | string): Instant {
    return typeof at === 'string' ? instantFromIso(at) : instantFromMs(at);
  }
}
