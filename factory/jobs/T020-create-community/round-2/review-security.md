VERDICT: PASS
# Security review — T020 round 2

## Findings
None.

Rechecked `origin/main...factory/T020-create-community` (through `ac1e1c6`). Round 2 only changes the communities page: long names wrap, a failed list reload uses its own alert and a Try again button, and invalid controls get an error border. That button is `type="button"` and calls `listMyCommunities` with the current ID token. It does not send another create. Community name, slug, and role are still React text. The role string is a contract enum, so it cannot change the i18n key path.

`POST /v1/communities` and `GET /v1/me/communities` still run `requireUser()` then `requireConsent()`. The user id is the server user from the verified bearer token. `CreateCommunityRequest` is a strict object of `name` and `timezone`, so `role`, `tenantId`, `slug`, and `createdBy` are rejected before the use case. `createCommunity` mints the tenant id, sets `createdBy` to that user, and writes role `owner`. Both adapters force `role: 'owner'`, and `validateCreateWithOwner` refuses any other role before a write. The response is a strict `CommunitySummary` (no `createdBy`, email, Firebase uid, or slug-reservation fields).

`listMyCommunities` loads memberships with `listByUser` of that same server user id, then loads only those tenant ids. Both repositories filter `userId` again. There is no list-all path and no query parameter for another user. `requireMember` is not mounted in `createApp`. On the test-only probe it loads `memberships.get(pathTenant, c.var.user.id)`, returns the same `FORBIDDEN` for a missing membership, a lower role, and another tenant, and never reads auth claims.

`DELETE /v1/me` still uses `requireIdentity()` and passes only `{ provider, subject }`. `deleteAccount` resolves that identity first. `identityId` throws `UNAUTHENTICATED` for an unsafe subject before any read or delete. It then `deleteByUser` for that user id only, in membership batches, and does not delete `communities` or `communitySlugs` or any other member. `firestore.rules` and `firestore.indexes.json` are unchanged (`allow read, write: if false` on `/{document=**}`). Rules tests seed `communities`, `memberships`, and `communitySlugs` and deny get, list, create, update, and delete for unauthenticated, authenticated, and forged-claim clients. No new secret, log of a token or document body, client Firestore write, or client-controlled clock.

## Hard rules
1. core vendor-free — ok
2. ports + adapters + fakes — ok
3. no client Firestore writes — ok
4. tenant isolation — ok
5. time from Clock — ok
6. roles server-side — ok
7. entitlements, not plan name — ok
8. our own IDs — ok
9. secrets via Secret Manager — ok
10. AI output untrusted — ok
11. religious content provenance — ok
