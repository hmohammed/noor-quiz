VERDICT: PASS
# Security review — T021 round 1

## Findings
None.

Create is limited to a stored admin or owner: `POST /v1/t/:tenantId/invites` uses `requireUser`, `requireConsent`, and `requireMember('admin')`, then `createInvite` checks `roleAtLeast` on the membership document. `tenantId` and `userId` come from that membership and `c.var.user`, not from the body. A member, editor, or scholar-reviewer is `FORBIDDEN`. `GET /v1/invites/:token` has no auth and `InvitePreviewResponse` is strict `{ name }`; unknown tokens are `NOT_FOUND`, and expired or used-up tokens are `GONE` with no name. Accept ignores the body after the empty strict schema, always writes role `member` for a new join, and returns an existing membership with no write and no extra use before the usability check. Expired and used-up tokens are `GONE` for a user who is not already a member. `firestore.rules` is still default deny; the invites seed is covered by the existing deny matrix for unauthenticated, authenticated, and forged-claims clients.

## Hard rules
1. core vendor-free — ok
2. ports + adapters + fakes — ok
3. no client Firestore writes — ok
4. tenant isolation — ok
5. time from Clock — ok
6. roles server-side — ok
7. entitlements, not plan name — ok
8. our own IDs — ok
9. secrets — ok
10. AI output untrusted — ok
11. religious content provenance — ok
