VERDICT: PASS
# Security review — T020 round 3

## Findings
None.

Rechecked `origin/main...factory/T020-create-community` (through `4d877de`). Round 3 changes only `CommunitiesPage.tsx`, `CommunitiesView.tsx`, and `CommunitiesView.test.tsx`. While `status === 'list-error'`, `handleSubmit` returns before `createCommunity`, the submit button is `disabled`, and `community.empty` is not rendered. Try again stays `type="button"` and still calls `listMyCommunities` only. Community name, slug, and role are still React text. No route, middleware, repository, contract, rules file, or session method changed in this commit.

`POST /v1/communities` and `GET /v1/me/communities` still run `requireUser()` then `requireConsent()`. The user id is `c.var.user.id` from the verified token. `CreateCommunityRequest` is a strict object of `name` and `timezone`. `createCommunity` mints the tenant id, sets `createdBy` to that user, and writes role `owner`. Both adapters force `role: 'owner'`. The response is a strict `CommunitySummary`.

`listMyCommunities` loads memberships with `listByUser` of that server user id, then loads only those tenant ids. `requireMember` is not mounted in `createApp`. `DELETE /v1/me` still deletes memberships for the identity's user id only and leaves community and slug docs. `firestore.rules` and `firestore.indexes.json` are unchanged (`allow read, write: if false` on `/{document=**}`). No new secret, log of a token or document body, client Firestore write, or client-controlled clock. The disabled button is a client guard against a second submit; the API remains the authority, and rate limiting stays out of scope for this task.

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
