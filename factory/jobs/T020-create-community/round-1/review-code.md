VERDICT: PASS
# Code review — T020 round 1

## Findings
None.

## Acceptance tests
1. ok — `packages/core/src/usecases/create-community.test.ts` "stores the caller as owner and createdBy, a suffix-free slug, the canonical timezone and clock timestamps" (one `Clock` read, `toIso`, role `owner`, no slug on the repo input).
2. ok — same file, "gives a second community with the same normalised name the slug suffix -2 and its own owner membership".
3. ok — `packages/core/src/communities/slug.test.ts`: `مسجد النور` → `community`; `chooseSlug` returns `-${tenantId.slice(-8).toLowerCase()}` once the base and `-2`…`-20` are taken.
4. ok — `packages/core/src/communities/name.test.ts`: Unicode letters, marks, digits, spaces, hyphens and apostrophes (2–48 code points, must start with a letter); emoji, markup, controls and a one-character name return null and are not stripped.
5. ok — `create-community.test.ts` "throws VALIDATION for %s and does not call the community repo" (bad name, emoji, timezone, user id).
6. ok — `packages/core/src/communities/role.test.ts` checks every pair of the five roles, plus unrecognised roles as false.
7. ok — `packages/core/src/usecases/list-my-communities.test.ts`: only the caller's memberships, sorted by `createdAt` then `tenantId`, missing community doc dropped, another user's tenant not requested.
8. ok — `packages/core/src/usecases/delete-account.test.ts`: memberships deleted before the user, other member kept, no `deleteByUser` when no user exists, unsafe subject `UNAUTHENTICATED` before any delete. Community and slug docs staying put is enforced by the store contract and the route test (see nit).
9. ok — `packages/testkit/src/contracts/community-store.contract.ts` run from `in-memory-community-store.test.ts` and `apps/api/src/adapters/firebase/community-repo.contract.test.ts`: owner create, `-2`, all-or-nothing validation/conflict, caller timestamps, `listByUser` / `get` scoping, idempotent `deleteByUser` past 400 rows that leaves communities, slugs and other users. Emulator harness refuses a missing `FIRESTORE_EMULATOR_HOST` and uses project `demo-noor`.
10. ok — `apps/api/src/routes/communities.test.ts` "returns 201 with role owner, and a second call with the same name ends in -2".
11. ok — same file: extra `role` / `tenantId` / `slug` / `createdBy`, bad name, bad timezone, invalid JSON, body over 4096 bytes → 400 `VALIDATION`.
12. ok — same file: 401 without a token; 403 `CONSENT_REQUIRED` when consent is missing and when it is stale.
13. ok — same file: two users see only their own communities, a third gets `[]`, 401 and 403, and the JSON has no `createdBy`, email, Firebase uid, or `communitySlugs`.
14. ok — same file: after `DELETE /v1/me` the same identity's next `GET /v1/me` is a new `userId`; after the new user accepts consent, `GET /v1/me/communities` is empty; the community doc, slug doc and the other member remain.
15. ok — `apps/api/src/middleware/require-member.test.ts`: probe `GET /v1/t/:tenantId/__member` is not mounted (`createApp` returns 404). 401, 403 `CONSENT_REQUIRED`, 403 `FORBIDDEN` for a non-member, a lower role and another tenant, 400 for a non-ULID. A sufficient stored role returns 200 with `c.var.membership` from the doc (`editor`, not the minimum). The handler counter stays 0 on failure. A forged `role` / `tenantId` on the verified identity does not grant `admin`.
16. ok — `firebase/rules.test.ts` seeds `communities`, `memberships` and `communitySlugs` into the existing matrix (unauthenticated, authenticated, forged claims × get, list, create, overwrite, update, delete). `firebase/firestore.rules` is still the wildcard deny and was not edited.
17. ok — `apps/web/src/features/communities/CommunitiesView.test.tsx`: loading, signed-out, unavailable, load-error, empty list, populated list, saving, save-error. Every `community.*` value in `en.json` is rendered, the name input and the name have `dir="auto"`, and `<b>` / apostrophe are escaped.
18. ok — `apps/web/e2e/communities.spec.ts`: emulator sign-in, consent, Communities link, `Masjid Al Noor` + `Europe/Stockholm`, 201, name visible in the list. No slug-suffix assertion.

Client parse of `CommunityResponse` / `MyCommunitiesResponse`, including a leaked `createdBy`, is in `apps/web/src/api/client.test.ts`.

## Hard rules
1. ok — new `packages/core` modules import only core. No `firebase`, `hono`, `zod`, or `fetch`.
2. ok — `CommunityRepo` and `MembershipRepo` in `ports/repos.ts`, one in-memory store, `FirestoreCommunityRepo` / `FirestoreMembershipRepo`, shared `runCommunityStoreContract`. No new dependency.
3. ok — the page calls the session API client. Rules file unchanged. The three collections are only added to the deny-matrix seeds.
4. ok — docs carry `tenantId`. `get` takes `tenantId` first. Create body is strict. List joins the caller's memberships. `requireMember` loads the path tenant for `c.var.user.id`. `listByUser` / `deleteByUser` are the documented account-scoped exceptions and take a server user id. No `setRole`.
5. ok — `createCommunity` uses one `toIso(clock.now())`. Repos persist that string. No `Date.now()` / `new Date()` in the new core or route code. The e2e unique email uses `Date.now()` the same way the existing Playwright specs do; it is not a domain clock.
6. ok — the only role written is `owner` inside `createWithOwner`. `requireMember` trusts the membership doc. Unknown stored roles fail the Firestore converter as `INTERNAL` (`corrupt-membership-doc`); `roleAtLeast` is false for an unrecognised string.
7. ok — no plan-name check, no `requireFeature`, no entitlements write.
8. ok — `tenantId` comes from `IdGenerator`; `userId` comes from `requireUser`. Firebase uid stays on the identity.
9. ok — no secrets. Emulator contract test bails without `FIRESTORE_EMULATOR_HOST`. Corrupt-doc errors carry a reason only.
10. ok — no AI output.
11. ok — no question content.

## Scope
The diff is the 48 files named in the spec. `docs/tasks/BOARD.md`, `factory/board.json`, `firebase/firestore.rules`, `firebase/firestore.indexes.json` and package manifests are untouched. `requireMember` is only mounted inside its test app.

## Nits (non-blocking)
- `packages/core/src/usecases/delete-account.test.ts:211` — the community and slug maps in "leaves community and slug docs" are never passed to `deleteAccount`, so that pair of expects cannot fail. The use case has no community port, and the store contract plus `communities.test.ts` already assert those docs survive `deleteByUser`.
