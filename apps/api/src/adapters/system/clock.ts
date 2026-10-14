import { instantFromMs, type Clock, type Instant } from '@noor/core';

/** Real wall clock. The only place in apps/api that reads `Date.now()` (AGENT.md rule 5). */
export class SystemClock implements Clock {
  now(): Instant {
    return instantFromMs(Date.now());
  }
}
