import { z } from 'zod';
import { CommunityRole } from './community';
import { Ulid } from './me';

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. Same pattern as `CommunitySummary`. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

/** A display name already stored for a member: 1–32 code points, or null when unknown. */
const MemberDisplayName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 1 && length <= 32;
});

/** Body of `PATCH /v1/t/:tenantId/members/:userId`. Strict: no `userId` or `tenantId`. */
export const ChangeMemberRoleRequest = z.strictObject({ role: CommunityRole });
export type ChangeMemberRoleRequest = z.infer<typeof ChangeMemberRoleRequest>;
export type ChangeMemberRoleRequestInput = z.input<typeof ChangeMemberRoleRequest>;

/** Body of `POST /v1/t/:tenantId/leave`. Strict and empty. */
export const LeaveCommunityRequest = z.strictObject({});
export type LeaveCommunityRequest = z.infer<typeof LeaveCommunityRequest>;
export type LeaveCommunityRequestInput = z.input<typeof LeaveCommunityRequest>;

/**
 * One member as an admin sees them. Strict, so `email`, `updatedAt` and
 * `schemaVersion` fail validation.
 */
export const MemberView = z.strictObject({
  userId: Ulid,
  displayName: MemberDisplayName.nullable(),
  role: CommunityRole,
  createdAt: UtcIso,
});
export type MemberView = z.infer<typeof MemberView>;

/** Body of `GET /v1/t/:tenantId/members`. */
export const MembersResponse = z.strictObject({ members: z.array(MemberView) });
export type MembersResponse = z.infer<typeof MembersResponse>;
