VERDICT: PASS
# Security review — T021 round 3

## Findings
None.

Round 3 (`eb9e2aa`) only adds `community__summary` as a column flex (`flex-direction`, `gap`, `min-inline-size`) and asserts the invite panel stays the next sibling. The summary stays `inert` while that panel is open; the panel itself is not. No route, use case, adapter, contract, or rules file changes in that commit.

On the full `origin/main...factory/T021-invite-and-join` diff: `POST /v1/t/:tenantId/invites` uses `requireUser`, `requireConsent`, and `requireMember('admin')`, then `createInvite` checks `roleAtLeast` on the stored membership. `tenantId` and `userId` come from `c.var.membership` and `c.var.user`. The create body is a strict object of optional `expiresInDays` and `maxUses`; `role`, `expiresAt`, `uses`, and `tenantId` are rejected. `GET /v1/invites/:token` has no auth and returns strict `{ name }`. Unknown tokens are `NOT_FOUND`; expired and used-up tokens are `GONE` with public message `Gone` and no `details`. Accept parses a strict empty body, does not copy it into the use case, and writes role `member` only for a new join. An existing membership is returned with no write and no extra use before the usability check. Both adapters take `now` from `Clock` and call `inviteUnusable`. `firestore.rules` is unchanged default deny; the invites seed is only so the existing deny matrix covers the collection. The join page previews with no auth header and calls accept only from Join. The QR is an in-browser `data:` URL.

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
