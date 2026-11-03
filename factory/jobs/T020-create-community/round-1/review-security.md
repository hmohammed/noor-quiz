VERDICT: PASS
# Security review — T020 round 1

## Findings
None.

Checked the branch against the spec. `POST /v1/communities` and `GET /v1/me/communities` run `requireUser()` then `requireConsent()`. The user id is the server user from the verified bearer token. `CreateCommunityRequest` is a strict object of `name` and `timezone`, so `role`, `tenantId`, `slug`, and `createdBy` are rejected before the use case. `createCommunity` mints the tenant id, sets `createdBy` to that user, and writes role `owner`. Both adapters force `role: 'owner'` and `validateCreateWithOwner` refuses any other role. The response is a strict `CommunitySummary` (no `createdBy`, email, Firebase uid, or slug-reservation fields).

`listMyCommunities` loads memberships with `listByUser` of that same server user id, then loads only those tenant ids. Both repositories filter `userId` again. There is no list-all path and no query parameter for another user. `requireMember` is not mounted in `createApp`. On the test-only probe it loads `memberships.get(pathTenant, c.var.user.id)`, returns the same `FORBIDDEN` for a missing membership, a lower role, and another tenant, and never reads auth claims.

`deleteAccount` still resolves the verified identity first (`identityId` rejects an unsafe subject with `UNAUTHENTICATED` before any delete). It then `deleteByUser` for that user id only, in membership batches, and does not delete `communities` or `communitySlugs` or any other member. `firestore.rules` is unchanged (`allow read, write: if false` on `/{document=**}`). Rules tests seed `communities`, `memberships`, and `communitySlugs` and deny get, list, create, update, and delete for unauthenticated, authenticated, and forged-claim clients. The web page calls the API with the current ID token and renders the name as text. No new secret, log of token or document body, or client-controlled clock.

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
