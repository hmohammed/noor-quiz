import { z } from 'zod';

/**
 * Environment variables the API reads at startup. Non-strict on input, so the
 * rest of `process.env` is ignored. Secrets never go here: they come from
 * Secret Manager / function secrets (AGENT.md rule 9).
 */
export const ConfigSchema = z.object({
  NOOR_ENV: z.enum(['local', 'dev', 'staging', 'prod']),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export interface Config {
  env: z.infer<typeof ConfigSchema>['NOOR_ENV'];
  logLevel: z.infer<typeof ConfigSchema>['LOG_LEVEL'];
}

/** Startup config is missing or invalid. The message names keys, never values. */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

type Env = Record<string, string | undefined>;

/**
 * Validates `env` and returns a typed config, or throws ConfigError. Takes env as a
 * parameter (never reads `process.env` itself) so tests and composition control it.
 */
export function loadConfig(env: Env): Config {
  const keys = Object.keys(ConfigSchema.shape) as (keyof typeof ConfigSchema.shape)[];
  // Copy only known keys; an empty string counts as missing.
  const input: Partial<Record<string, string>> = {};
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value !== '') input[key] = value;
  }

  const result = ConfigSchema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = issue.path.map(String).join('.') || '(root)';
      if (input[key] === undefined) return `${key} is required`;
      if (issue.code === 'invalid_value') {
        return `${key} must be one of: ${issue.values.map(String).join(', ')}`;
      }
      return `${key} is invalid (${issue.code})`;
    });
    throw new ConfigError(`Invalid API config: ${problems.join('; ')}`);
  }

  return { env: result.data.NOOR_ENV, logLevel: result.data.LOG_LEVEL };
}
