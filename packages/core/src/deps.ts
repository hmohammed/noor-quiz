import type { Clock } from './ports/clock';
import type { IdGenerator } from './ports/id-generator';
import type { UserRepo } from './ports/repos';

/**
 * Ports available to use cases. Routes get real adapters from
 * apps/api/src/composition.ts; tests get fakes from `makeTestDeps()` in testkit.
 * Later tasks add repositories and other ports here.
 */
export interface Deps {
  clock: Clock;
  ids: IdGenerator;
  users: UserRepo;
}
