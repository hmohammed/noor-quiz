# Build — T031 (round 1)
Branch: factory/T031-create-season
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T031-create-season

## Changes
- packages/contracts/src/season.ts — request, patch, suggestion, list and view schemas. Strict objects reject tenantId, role, hijriYear, state and createdBy.
- packages/core/src/season/community-season.ts — stored CommunitySeason, season id, kinds and seasonRules projection onto the T030 Season.
- packages/core/src/usecases/create-season.ts, list-seasons.ts, update-season.ts, suggest-ramadan-start.ts — create stores the submitted dates, list sorts newest first and computes state from one clock read, update locks every field except closesAtLocal once day 1 has opened, suggestion calls nextRamadanSuggestion and writes nothing.
- packages/core/src/ports/repos.ts, deps.ts — SeasonRepo. Every read takes tenantId first.
- packages/testkit/src/in-memory-season-repo.ts — fake, separate from the community store. makeTestDeps grows a default seasons repo.
- apps/api/src/adapters/firebase/season-repo.ts — Firestore seasons collection. Converter and zod parse stay in the adapter. List is a single-field tenantId equality, no orderBy and no new index.
- apps/api/src/routes/seasons.ts — POST and PATCH for admin+, GET list for member+, GET ramadan-suggestion for admin+. Tenant and user come from the membership.
- firebase/rules.test.ts — seasons seed so the existing deny loop covers the collection. Rules file unchanged (blanket deny).
- apps/web seasons page at /communities/:tenantId/seasons, a Seasons link on each community, English strings, logical CSS. The suggest button fills start date and length only.

## Acceptance tests → test files
1. Submitted dates differ from the suggestion and one document is written → packages/core/src/usecases/create-season.test.ts "stores the submitted start and length..."
2. Invalid start, length, timezone or local time is VALIDATION and writes nothing → create-season.test.ts "throws VALIDATION for ..."
3. Name normalisation, including a trimmed Arabic name; a rejected name writes nothing → create-season.test.ts "accepts Ramadan 1448..." and "throws VALIDATION for a name..."
4. Tenant-scoped list, newest createdAt then id, state from the clock, empty list → packages/core/src/usecases/list-seasons.test.ts
5. Before day 1, start and length change; identity fields stay; updatedAt is the clock → update-season.test.ts "changes start and length before day 1 opens"
6. After start, a new start or length is CLOSED and the document is unchanged → update-season.test.ts "rejects a new start date or length..."
7. After start, name, kind, timezone and opensAtLocal are CLOSED; a new close saves and the next state uses it → update-season.test.ts "rejects a new %s..." and "saves a new close..."
8. A locked field plus a new close is CLOSED and the close is not written → update-season.test.ts "rejects a locked field together with a new close"
9. One minute before day 1 opens, a new start saves; at the open instant it is CLOSED → update-season.test.ts "still saves a new start one minute before..."
10. Unknown id and another tenant's id are NOT_FOUND and every document stays → update-season.test.ts "throws NOT_FOUND..."
11. Suggestion matches nextRamadanSuggestion and writes nothing; unknown and offset zones are VALIDATION → suggest-ramadan-start.test.ts
12. Zod accepts a real date, lengths 1 and 366, a canonical zone and 00:00; rejects the listed bad values and extra keys → packages/contracts/src/season.test.ts
13. POST 201 and GET lists the season with state → apps/api/src/routes/seasons.test.ts "returns 201 for an owner..."
14. POST 403 for editor, member and scholar-reviewer → seasons.test.ts "returns 403 FORBIDDEN for a %s"
15. POST 401 without a token → seasons.test.ts
16. POST 403 for an admin of another tenant → seasons.test.ts
17. POST 403 CONSENT_REQUIRED → seasons.test.ts
18. POST 400 for a bad date, non-integer length, bad time, and tenantId, role or hijriYear → seasons.test.ts
19. PATCH 200 before day 1 with the new start and length → seasons.test.ts
20. PATCH startDate after start is 409 and the stored start is unchanged → seasons.test.ts
21. PATCH lengthDays after start is 409 and the stored length is unchanged → seasons.test.ts
22. PATCH closesAtLocal after start is 200; start and length stay → seasons.test.ts
23. PATCH 403 for editor and member → seasons.test.ts
24. PATCH 401 without a token → seasons.test.ts
25. PATCH 403 for an admin of another tenant → seasons.test.ts
26. PATCH of another tenant's season id is 404 and that document is unchanged → seasons.test.ts
27. GET 200 for a member, including an empty list → seasons.test.ts
28. GET 401 without a token → seasons.test.ts
29. GET 403 for a member of another tenant → seasons.test.ts
30. Suggestion is advisory and creates nothing; a later POST lists the submitted dates → seasons.test.ts
31. Suggestion 403 for editor and member → seasons.test.ts
32. Suggestion 401 without a token → seasons.test.ts
33. Suggestion 403 for an admin of another tenant → seasons.test.ts
34. Suggestion 400 when timezone is missing or not an IANA zone → seasons.test.ts
35. Seeded seasons doc is denied for get, list, create, overwrite, update and delete → firebase/rules.test.ts (existing per-collection loop, seasons added to the seed)
36. Shared season repo contract on the in-memory repo and the Firestore repo → packages/testkit/src/contracts/season-repo.contract.ts, run from in-memory-season-repo.test.ts and apps/api/src/adapters/firebase/season-repo.contract.test.ts
37. Admin creates Ramadan 1448 and sees it listed as upcoming → apps/web/e2e/seasons.spec.ts
38. Suggestion fills the start field, the admin replaces it, and RTL keeps the heading, list item and name field visible and apart → apps/web/e2e/seasons.spec.ts
39. The view lists the name and upcoming state, shows the form only for admin and owner, and a suggestion fills start and length without submitting → apps/web/src/features/seasons/SeasonsView.test.tsx

## How I tested
| command | result |
| --- | --- |
| npx eslint . | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck | pass |
| npm test | 1189 passed. tooling/src/docs-commands.test.ts failed because AGENT.md is CRLF. Known Windows issue, not a product failure. |
| npm run test:emulator | pass (238 tests, including the season repo contract and the seasons rules seed) |
| npm run test:e2e | pass (13 tests, including both season specs). Ports 5001, 5173, 9099 and 8180 were free, so these servers were started here and then stopped. |

## Commits
- 0ab46eed0d5e74ba19215540e4a9e9600f21236c T031: add season use cases and contracts
- dc5fb496c91db661672521e8db18f6fceb2f551d T031: add the season repository and deny client access
- 7a9d0191921acf31632dca79709c1ee3a39c373e T031: add season HTTP routes
- 8256cdb2a9d004de05417e92b6558f11c8007338 T031: add the seasons page

## Notes for reviewers
- No new dependency. No question or answer route. firestore.rules and firestore.indexes.json are unchanged.
- Core use-case tests use a local MemorySeasonRepo. Testkit depends on core, so core cannot import the shared fake. The shared contract still runs on InMemorySeasonRepo and FirestoreSeasonRepo.
- On update, a different tenantId is a tenant mismatch and returns NOT_FOUND with no write. Changes to createdBy, createdAt or schemaVersion return VALIDATION with no write. A different id addresses a different document, so a missing id is NOT_FOUND. A successful update keeps id, tenantId, createdBy, createdAt and schemaVersion.
- The lock is decided from the stored season and one clock read before the patch is applied. closesAtLocal stays editable after the season has started, and the returned state is computed from the new close.
- Invites, join pages and the T021 worktree were not touched. Shared files (app.ts, composition.ts, router.tsx, en.json, styles.css) only gained the season additions.

## Round 2
- review-ux.md: a failed list after a successful create looked like a failed create → `list-error` in SeasonsPage.tsx and SeasonsView.tsx, with `season.error.created`, the empty line hidden, Create disabled, and Try again calling `listSeasons` only. Editing the form leaves that state in place (6e25ff43043c03a406eaf09ececcab9642070ea4).
- review-ux.md: an open season read as "Active" plus a bare number → `season.state.active` is now "Active, day", so the label is "Active, day 5" (6e25ff43043c03a406eaf09ececcab9642070ea4).
- review-ui.md: `dir="ltr"` on the season meta line put the date on the physical left → the line stays in the page direction and an inner `bdi` carries `dir="ltr"` around the date (6e25ff43043c03a406eaf09ececcab9642070ea4).
- Non-blocking nits, including the missing edit form, were left unchanged.

Checks: `npx eslint` on the season files (pass; `en.json` is ignored by the lint config), `npx prettier --check --end-of-line auto .` pass, `SeasonsView.test.tsx` 9 passed.

## Round 3
- review-ux.md / review-code.md: a suggestion started from `list-error` set `suggesting`, and a failed suggestion set `suggest-error`, which brought back the empty line and enabled Create → `handleSuggest` stays on `list-error` for the whole request, and the rejection path restores `list-error` the same way the success path does (`SeasonsPage.tsx`, 7f9b491df910b9097241461e58e16cc305bb532a).
- Non-blocking nits were left unchanged.

Checks: `npx eslint` on the season files pass, `npx prettier --check --end-of-line auto .` pass, `SeasonsView.test.tsx` 9 passed.

## Round 4
Rebase onto `origin/main` completed. New HEAD: `86a7ea4fc93735265dc03ac99f8514bbf615d4f9`. No extra commit: each conflict was resolved inside the replayed commit. Invite exports, routes, and UI from T021 stayed, and the season work stayed beside them.

Conflicted files:
- `packages/contracts/src/index.ts`
- `packages/core/src/deps.ts`
- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/core/src/ports/repos.ts`
- `packages/testkit/src/index.ts`
- `packages/testkit/src/make-test-deps.ts`
- `packages/testkit/src/make-test-deps.test.ts`
- `apps/api/src/composition.ts`
- `apps/api/src/composition.test.ts`
- `apps/api/src/app.ts`
- `firebase/rules.test.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/client.test.ts`
- `apps/web/src/features/auth/session-context.tsx`
- `apps/web/src/features/communities/CommunitiesView.tsx`
- `apps/web/src/i18n/en.json`
- `apps/web/src/router.tsx`
- `apps/web/src/styles.css`

Checks: `npx eslint .` pass, `npx prettier --check --end-of-line auto .` pass, `npm run typecheck` pass, season unit tests 222 passed. Shared-file tests for composition, makeTestDeps, the API client, communities view, and core exports also passed (119).
