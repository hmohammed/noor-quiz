import type { Context } from 'hono';
import { DomainError } from '@noor/core';

interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/**
 * Reads the JSON body and parses it with a contract schema. Bad JSON or a schema
 * failure throws `VALIDATION`; `details` carry a reason only, never body values.
 */
export async function parseJsonBody<T>(c: Context, schema: Schema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new DomainError('VALIDATION', { reason: 'invalid-json' });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new DomainError('VALIDATION', { reason: 'invalid-body' });
  return parsed.data;
}
