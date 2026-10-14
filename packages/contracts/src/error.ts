import { z } from 'zod';

/** Machine-readable error code, e.g. `NOT_FOUND`. Clients localise by this code. */
export const ErrorCode = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
export type ErrorCode = z.infer<typeof ErrorCode>;

/**
 * Body of every API error response. Strict, so leaked extra keys (details, stack)
 * fail validation. `message` is a fixed English fallback, never user data.
 */
export const ErrorResponse = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string().min(1) }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
