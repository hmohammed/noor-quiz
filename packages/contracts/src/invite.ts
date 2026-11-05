import { z } from 'zod';
import { Ulid } from './me';

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

const NAME_MAX = 48;
/** A community name as a preview may show it: 1–48 Unicode code points. */
const PreviewName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 1 && length <= NAME_MAX;
});

/**
 * Body of `POST /v1/t/:tenantId/invites`. Both fields are optional; `{}` is valid.
 * Strict: `role`, `tenantId`, `createdBy`, `expiresAt`, `uses` and `token` are rejected.
 * Bounds match core: `expiresInDays` 1–30, `maxUses` 1–100.
 */
export const CreateInviteRequest = z.strictObject({
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(100).optional(),
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequest>;
export type CreateInviteRequestInput = z.input<typeof CreateInviteRequest>;

/** Body of `POST /v1/t/:tenantId/invites` (201). `token` is the invite document id. */
export const CreateInviteResponse = z.strictObject({
  token: Ulid,
  expiresAt: UtcIso,
  maxUses: z.number().int().min(1).max(100),
});
export type CreateInviteResponse = z.infer<typeof CreateInviteResponse>;

/** Body of `GET /v1/invites/:token`. The public preview is the community name only. */
export const InvitePreviewResponse = z.strictObject({
  name: PreviewName,
});
export type InvitePreviewResponse = z.infer<typeof InvitePreviewResponse>;

/**
 * Body of `POST /v1/invites/:token/accept`. Empty and strict: a `role` (or any other
 * key) is rejected. The route does not copy this body into the use case.
 */
export const AcceptInviteRequest = z.strictObject({});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequest>;
