VERDICT: CHANGES
# Code review — T020 round 2

## Findings
- [must-fix] apps/web/src/features/communities/CommunitiesPage.tsx:145 — After `createCommunity` resolves, the name is cleared and a failed `listMyCommunities` sets `list-error`, but `handleSubmit` only returns early for `saving`. Create stays enabled (`CommunitiesView.tsx:183`), and an empty list still renders `community.empty` (`CommunitiesView.tsx:116`, "You don't belong to a community yet.") next to `community.error.created`. Submitting the cleared name sets `invalid-name` and removes the created alert; typing the name again calls `createCommunity` a second time. That is the duplicate this round was meant to stop. Disable the submit button while `status === 'list-error'`, return immediately from `handleSubmit` in that status, and do not render `community.empty` during `list-error`. In `CommunitiesView.test.tsx`, assert the empty copy is absent and the submit button is disabled for `ready('list-error', [])`. Leave Try again calling `listMyCommunities` only.

## Acceptance tests
1. ok — `packages/core/src/usecases/create-community.test.ts` "stores the caller as owner and createdBy, a suffix-free slug, the canonical timezone and clock timestamps".
2. ok — same file, "gives a second community with the same normalised name the slug suffix -2 and its own owner membership".
3. ok — `packages/core/src/communities/slug.test.ts`: non-Latin base `community`, and `chooseSlug` uses `-${tenantId.slice(-8).toLowerCase()}` after `-2`…`-20`.
4. ok — `packages/core/src/communities/name.test.ts`: Unicode letters, marks, digits, spaces, hyphens and apostrophes; emoji, markup, controls and a one-character name return null.
5. ok — `create-community.test.ts` "throws VALIDATION for %s and does not call the community repo".
6. ok — `packages/core/src/communities/role.test.ts`: every pair of the five roles, unrecognised role false.
7. ok — `packages/core/src/usecases/list-my-communities.test.ts`: caller memberships only, sort by `createdAt` then `tenantId`, missing community doc dropped.
8. ok — `packages/core/src/usecases/delete-account.test.ts`: memberships deleted before the user, other member kept, no `deleteByUser` when no user exists, unsafe subject `UNAUTHENTICATED` before any delete. Community and slug survival is in the store contract and the route test (see nit).
9. ok — `packages/testkit/src/contracts/community-store.contract.ts`, run from the in-memory test and `apps/api/src/adapters/firebase/community-repo.contract.test.ts`.
10. ok — `apps/api/src/routes/communities.test.ts` "returns 201 with role owner, and a second call with the same name ends in -2".
11. ok — same file: extra keys, bad name, bad timezone, invalid JSON, body over 4096 bytes → 400 `VALIDATION`.
12. ok — same file: 401 without a token; 403 `CONSENT_REQUIRED` when consent is missing or stale.
13. ok — same file: two users see only their own communities, empty list, 401, 403, and no `createdBy`, email, Firebase uid, or slug-reservation field.
14. ok — same file: after `DELETE /v1/me` the same identity gets a new `userId` and, once that user accepts consent, an empty community list; the community doc, slug doc and other member remain.
15. ok — `apps/api/src/middleware/require-member.test.ts`: probe route is not mounted in `createApp`; 401, 403 `CONSENT_REQUIRED`, 403 `FORBIDDEN`, 400 for a non-ULID; a stored role returns 200 with `c.var.membership`; the handler is not called on failure; a forged claim does not grant a role.
16. ok — `firebase/rules.test.ts` seeds `communities`, `memberships` and `communitySlugs` into the existing deny matrix. `firebase/firestore.rules` was not edited.
17. ok — `apps/web/src/features/communities/CommunitiesView.test.tsx`: loading, signed-out, unavailable, load-error, empty list, populated list, saving, save-error, plus `list-error`. Every `community.*` value in `en.json` is rendered, the name input and the name have `dir="auto"`, and `<b>` / apostrophe are escaped. The `list-error` case does not yet lock the duplicate-submit behaviour above.
18. ok — `apps/web/e2e/communities.spec.ts`: emulator sign-in, consent, Communities link, `Masjid Al Noor` + `Europe/Stockholm`, name visible in the list.

Client parse of `CommunityResponse` / `MyCommunitiesResponse`, including a leaked `createdBy`, is in `apps/web/src/api/client.test.ts`.

## Hard rules
1. ok — `packages/core` community modules import only core. No `firebase`, `hono`, `zod`, or `fetch`. Round 2 does not touch core.
2. ok — `CommunityRepo` and `MembershipRepo` have one in-memory store, Firestore adapters, and `runCommunityStoreContract`. No new dependency.
3. ok — the page calls the session API client. Rules file unchanged. The three collections are only added to the deny-matrix seeds.
4. ok — docs carry `tenantId`. `get` takes `tenantId` first. Create body is strict. List joins the caller's memberships. `requireMember` loads the path tenant for `c.var.user.id`. `listByUser` / `deleteByUser` are the documented account-scoped exceptions. No `setRole`.
5. ok — `createCommunity` uses one `toIso(clock.now())`. Repos persist that string. No `Date.now()` / `new Date()` in the new core or route code. The e2e unique email uses `Date.now()` the same way the existing Playwright specs do.
6. ok — the only role written is `owner` inside `createWithOwner`. `requireMember` trusts the membership doc.
7. ok — no plan-name check, no `requireFeature`, no entitlements write.
8. ok — `tenantId` comes from `IdGenerator`; `userId` comes from `requireUser`. Firebase uid stays on the identity.
9. ok — no secrets. Emulator contract test bails without `FIRESTORE_EMULATOR_HOST`. Corrupt-doc errors carry a reason only.
10. ok — no AI output.
11. ok — no question content.

## Scope
`ac1e1c6` changes only `CommunitiesPage.tsx`, `CommunitiesView.tsx`, `CommunitiesView.test.tsx`, `en.json` and `styles.css`, all named in the spec. The branch does not touch `docs/tasks/BOARD.md`, `factory/board.json`, `firebase/firestore.rules`, `firebase/firestore.indexes.json`, or package manifests. `requireMember` is only mounted inside its test app. The new `community.error.created` string goes through `t()`. New CSS uses logical properties (`min-inline-size`, `max-inline-size`, `text-align: start`) and `var(--color-error)`.

## Nits (non-blocking)
- `apps/web/src/features/communities/CommunitiesPage.tsx:134` — `refreshList` always applies whichever request settles last. A slower failed Try again can set `list-error` after a newer success, or the reverse. Ignore a stale generation before writing `communities` or `status`.
- `apps/web/src/styles.css:385` — `.community__name` and `.community__slug` are column-flex items with `overflow-wrap: break-word` and no `min-inline-size: 0`. `break-word` does not shrink min-content, so a 48-character name with no spaces can still widen the page. Add `min-inline-size: 0` and `max-inline-size: 100%` on those two selectors (or `overflow-wrap: anywhere`). `text-align: start` and `dir="auto"` are already in place.
- `packages/core/src/usecases/delete-account.test.ts:211` — the community and slug maps in "leaves community and slug docs" are never passed to `deleteAccount`, so that pair of expects cannot fail. The use case has no community port, and the store contract plus `communities.test.ts` already assert those docs survive `deleteByUser`.
