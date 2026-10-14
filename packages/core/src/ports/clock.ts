import type { Instant } from '../time/instant';

/** The only source of "now" for core and routes (AGENT.md rule 5). */
export interface Clock {
  now(): Instant;
}
