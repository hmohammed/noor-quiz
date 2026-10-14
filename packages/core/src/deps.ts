import type { Clock } from './ports/clock';

/**
 * Ports available to use cases. Routes get real adapters from
 * apps/api/src/composition.ts; tests get fakes from `makeTestDeps()` in testkit.
 * Later tasks add repositories and other ports here.
 */
export interface Deps {
  clock: Clock;
}
