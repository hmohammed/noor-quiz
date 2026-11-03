# Build — T020 (round 1)
Branch: factory/T020-create-community
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T020-create-community

## Changes
- packages/contracts/src/community.ts — strict create and list schemas. Names and timezones are normalised; role, tenantId, slug and createdBy cannot be sent.
- packages/core/src/communities — name, slug and role rules, plus community, membership and slug-lock shapes. Time comes from Clock. packages/core stays vendor-free.
- packages/core/src/usecases/create-community.ts — the caller becomes owner. The slug is chosen by the repository, not the client.
- packages/core/src/usecases/list-my-communities.ts — only the caller's memberships, missing community docs dropped, sorted by createdAt then tenantId.
- packages/core/src/usecases/delete-account.ts — deletes that user's memberships first and leaves community and slug docs in place.
- packages/testkit — one in-memory store shared by CommunityRepo and MembershipRepo, plus the shared contract. makeTestDeps wires both from that store.
- apps/api/src/adapters/firebase/community-repo.ts — Firestore repos. Corrupt docs throw INTERNAL with a reason only. deleteByUser repeats in batches of 400 and does not delete communities.
- apps/api/src/routes/communities.ts — POST /v1/communities and GET /v1/me/communities, behind requireUser and requireConsent. No requireMember on these routes.
- apps/api/src/middleware/require-member.ts — tested on GET /v1/t/:tenantId/__member, which is not mounted in createApp. A forged claim does not grant a role.
- firebase/rules.test.ts — communities, memberships and communitySlugs are seeded so the existing deny matrix covers them. firestore.rules and firestore.indexes.json were not edited.
- apps/web — /communities page, nav link, API client methods, and English copy. Delete-account copy now says memberships are removed and created communities are not deleted. No new dependency.

## Acceptance tests → test files
1. Owner, suffix-free slug, canonical timezone, clock timestamps → packages/core/src/usecases/create-community.test.ts "stores the caller as owner…"
2. Second community gets -2 and its own owner membership → packages/core/src/usecases/create-community.test.ts "gives a second community…"
3. Non-Latin base and tenant-id suffix → packages/core/src/communities/slug.test.ts
4. Unicode name rules → packages/core/src/communities/name.test.ts
5. Invalid name, timezone or user id does not call the repo → packages/core/src/usecases/create-community.test.ts
6. roleAtLeast for every role pair → packages/core/src/communities/role.test.ts
7. List scoping, sort, missing doc → packages/core/src/usecases/list-my-communities.test.ts
8. deleteAccount removes memberships, leaves communities, refuses an unsafe subject first → packages/core/src/usecases/delete-account.test.ts
9. Shared store contract → packages/testkit/src/contracts/community-store.contract.ts, run from packages/testkit/src/in-memory-community-store.test.ts and apps/api/src/adapters/firebase/community-repo.contract.test.ts
10–14. HTTP create, validation, consent, list isolation, account deletion → apps/api/src/routes/communities.test.ts
15. requireMember probe, not mounted in createApp → apps/api/src/middleware/require-member.test.ts
16. Client deny matrix for the three collections → firebase/rules.test.ts
17. View states, en.json copy, dir="auto", escaped name → apps/web/src/features/communities/CommunitiesView.test.tsx
18. Signed-in create shows in the list → apps/web/e2e/communities.spec.ts

The API client parses CommunityResponse and MyCommunitiesResponse and rejects a leaked createdBy → apps/web/src/api/client.test.ts

## How I tested
| command | result |
| --- | --- |
| npx eslint . | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck | pass |
| npm test | 1077 tests passed. tooling/src/docs-commands.test.ts failed to load ("AGENT.md has no fenced block under ## Commands"). I did not edit AGENT.md. This is the known Windows checkout failure, not a product failure. |
| npm run test:emulator | pass (209 tests: community store, user repo, auth verifier, rules) |
| npm run test:e2e | pass (11 tests, including communities). Emulators were started with FUNCTIONS_DISCOVERY_TIMEOUT=60 because dev:emulators cannot set it on Windows. Vite and the emulators were stopped afterwards. |

## Commits
- 6503f1d T020: create a community and list mine through the API
- 6a6becb T020: add the communities page

## Notes for reviewers
- No new dependency. No production config, Stripe, secrets, rules allow, or index change.
- requireMember is covered by a test-only route. createApp does not mount /v1/t/:tenantId/__member.
- After DELETE /v1/me the same Firebase identity gets a new user with no consent. The route test accepts consent again before asserting that GET /v1/me/communities is empty. requireConsent is unchanged.
- A corrupt communitySlugs doc fails create with INTERNAL rather than being treated as a free slug.
- Needs-human: none.

## Round 2
- review-ux.md / review-ui.md: long names overflow at 360px → `.community__item` stretches and `.community__name` / `.community__slug` wrap (`apps/web/src/styles.css`, ac1e1c6). `text-align: start` and `dir="auto"` stay.
- review-ux.md: a failed list after a successful create used the create-error copy → `list-error` says the community was created but the list could not be loaded, and Try again calls `listMyCommunities` only (`CommunitiesPage.tsx`, `CommunitiesView.tsx`, `en.json`, ac1e1c6).
- review-ui.md: invalid controls had no error border → `.community__control[aria-invalid='true']` uses `var(--color-error)` (ac1e1c6).
- Slug-label wording, a live-region success message, and autocomplete were left as non-blocking nits.

Checks: `npx eslint .` pass, `npx prettier --check --end-of-line auto .` pass, `npm run typecheck` pass, communities view tests pass (11), `npm run test:e2e` pass (11). Emulators and Vite were stopped afterwards.

## Round 3
- review-code.md: after a successful create, a failed list left Create enabled and still showed the empty-list line, so a second submit could create another community → Create is disabled while `status === 'list-error'`, `handleSubmit` returns immediately, and `community.empty` is not rendered (`CommunitiesPage.tsx`, `CommunitiesView.tsx`, `CommunitiesView.test.tsx`, 4d877de). Try again still calls `listMyCommunities` only.
- Stale list-request ordering and the name/slug `min-inline-size` nit were left as non-blocking.

Checks: `npx eslint` on the three files pass, `npx prettier --check --end-of-line auto` pass, `CommunitiesView.test.tsx` 11 tests pass.
