import { z } from 'zod';

/** Body of `GET /v1/health`. Strict, so any extra (leaked) key fails validation. */
export const HealthResponse = z.strictObject({
  status: z.literal('ok'),
  version: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
