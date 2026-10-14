import type { Deps } from '@noor/core';
import { SystemClock } from './adapters/system/clock';
import { loadConfig, type Config } from './config';

/** Everything the HTTP app needs, built once per process. */
export interface AppRoot {
  config: Config;
  deps: Deps;
  version: string;
}

/**
 * The only place that chooses adapters. Validates config first, so an invalid
 * environment throws ConfigError before any adapter is built (fail fast at cold start).
 */
export function createComposition(
  env: Record<string, string | undefined>,
  opts: { version: string },
): AppRoot {
  const config = loadConfig(env);
  const deps: Deps = { clock: new SystemClock() };
  return { config, deps, version: opts.version };
}
