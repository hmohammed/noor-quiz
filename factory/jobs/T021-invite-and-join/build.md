# Build — T021 (round 1)
Branch: factory/T021-invite-and-join
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T021-invite-and-join

## Changes
- packages/contracts/src/invite.ts — strict create, preview, and empty accept schemas. Contracts do not import core.
- packages/core/src/communities/invite.ts — `Invite`, limits, `asInviteToken`, `inviteUnusable`, `validateNewInvite`. `GONE` added to domain codes.
- packages/core/src/usecases/create-invite.ts, preview-invite.ts, accept-invite.ts — one clock read each. Create uses the stored membership role. Accept passes `now` into the repo and does not set a role.
- packages/core/src/ports/repos.ts — `InviteRepo` on the existing community port surface. No second port and no public membership create.
- packages/testkit — invites share the in-memory membership map. `accept` does not await between read and write. The shared contract covers the last-use race, round-trip, and conflict.
- packages/core/tsconfig.tests.json — typechecks `accept-invite.test.ts`, which calls `makeTestDeps()`. Core cannot project-reference testkit (testkit already references core).
- apps/api — `FirestoreInviteRepo` reuses the exported membership converter. Routes: create (admin+), public preview, accept. `GONE` maps to 410 and public message `Gone`. Rules stay default deny; the invites seed is only so the existing deny matrix covers the collection.
- apps/web — Invite on admin and owner rows, dialog with a `/join/{token}` link and an in-browser QR, and `/join/:token`. Preview uses the API client with no auth header. New copy is in `en.json`. New CSS uses logical properties.
- apps/web dependency `qrcode` — encodes the join URL as a QR image in the browser and does not contact a QR service. Exit: replace `inviteQrDataUrl`. A local `qrcode.d.ts` supplies the types because the package does not ship any. Not added to core or the API.

## Acceptance tests → test files
1. Default invite (ULID, uses 0, caller, maxUses 25, expiry 7 × 86 400 000 ms, one clock read) → packages/core/src/usecases/create-invite.test.ts "stores a ULID token, uses 0, the caller, maxUses 25 and expiry 7 days after one clock read"
2. Bounds, defaults, and rejected caller fields → create-invite.test.ts "stores expiresInDays…" and "throws VALIDATION for … and writes nothing"
3. member / scholar-reviewer / editor forbidden; admin and owner allowed → create-invite.test.ts role cases
4. No membership is FORBIDDEN and writes nothing → create-invite.test.ts "throws FORBIDDEN when the user has no membership…"
5. Live preview is exactly `{ name }` → packages/core/src/usecases/preview-invite.test.ts "returns exactly the community name…"
6. Unknown token NOT_FOUND; expired and used-up GONE, no name → preview-invite.test.ts
7. Malformed token VALIDATION and the repo is not read → preview-invite.test.ts
8. First accept creates member; second is the same membership; uses unchanged; listMyCommunities returns one community → packages/core/src/usecases/accept-invite.test.ts (uses `makeTestDeps()`)
9. Existing owner stays owner and does not consume a use → accept-invite.test.ts
10. Filled link: existing member accepts again; a different user is GONE with no membership → accept-invite.test.ts
11. Expired link: new user GONE; existing member still succeeds → accept-invite.test.ts
12. Unknown token NOT_FOUND; malformed token VALIDATION and no write → accept-invite.test.ts
13. Two new users, one use left: one membership, uses equals maxUses, the other call is GONE → packages/testkit/src/contracts/invite-repo.contract.ts (also apps/api/src/adapters/firebase/invite-repo.contract.test.ts)
14. create/getByToken round-trip; second create is CONFLICT and does not change the stored invite → invite-repo.contract.ts
15. POST create 201 strict `{ token, expiresAt, maxUses }` → apps/api/src/routes/invites.test.ts
16. POST create without a token is 401 → invites.test.ts
17. POST create without current consent is 403 CONSENT_REQUIRED → invites.test.ts
18. POST create as member and as editor is 403 FORBIDDEN → invites.test.ts
19. Admin of another tenant is 403 and stores no invite → invites.test.ts
20. role, expiresAt, maxUses 0, unknown key, non-ULID tenant id are 400 → invites.test.ts
21. GET preview with no Authorization, and for a member of another tenant, is exactly `{ name }` → invites.test.ts
22. GET unknown 404, expired and used-up 410, no name → invites.test.ts
23. GET malformed token 400 → invites.test.ts
24. maxUses 1: first accept 201, second 200, role member, one membership, uses 1 → invites.test.ts
25. A non-member gets 410 for expired and used-up tokens → invites.test.ts
26. Accept without a token is 401; without consent is 403 → invites.test.ts
27. Accepting tenant B leaves the tenant A membership unchanged and adds member in B → invites.test.ts
28. Accept body `{ role: owner }` is 400 and creates no membership → invites.test.ts
29. GONE is HTTP 410, message Gone, details omitted → apps/api/src/errors.test.ts exhaustive table (code mapped in errors.ts)
30. Unauthenticated, authenticated, and forged-claims clients cannot read or write invites → firebase/rules.test.ts deny matrix, with an invites seed and no new allow rule
31. Invite and join copy from en.json; name uses dir="auto"; logical CSS → InviteDialog.test.tsx and JoinView.test.tsx
32. Invite control for admin and owner only → CommunitiesView.test.tsx
33. Link pathname `/join/{token}` and a data-URL QR; no fetch and no remote QR host → InviteDialog.test.tsx and invite-qr.test.ts
34. Join view: loading, preview, not-found, gone without a name, sign-in, joined, under dir="rtl" → JoinView.test.tsx
35. User A creates an invite, user B joins and sees the community; QR is not requested from another origin → apps/web/e2e/invites.spec.ts
36. CreateInviteRequest, CreateInviteResponse, and InvitePreviewResponse are strict → packages/contracts/src/invite.test.ts

## How I tested
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck (`tsc -b`) | pass |
| npm test | 1202 tests passed. `tooling/src/docs-commands.test.ts` failed because AGENT.md is CRLF. Known Windows issue; not treated as a product failure. |
| npm run test:emulator | pass (239 tests, including the invite repo contract and the invites deny-matrix seed) |
| npm run test:e2e | pass (12 tests, including invites). Servers were started in this worktree on free ports 5001, 5173, 9099, and 8180, then stopped. |

## Commits
- ee6bd37 T021: add invite use cases and the shared repo contract
- 7df5ea3 T021: add invite routes and the Firestore adapter
- 3153a98 T021: add the invite dialog and join page
- 5241c40 T021: drop a placeholder assertion in the invite emulator test

## Notes for reviewers
- `inviteUnusable` is the only expiry and maxUses comparison. Preview and both adapters call it. Expired and used-up are both `GONE`.
- Accept checks an existing membership before usability, inside one transaction. The in-memory adapter does that read and write with no await between them.
- The browser never writes Firestore. The QR is drawn from `qrcode`'s `create` in process. `GET /v1/invites/:token` sends no Authorization header.
- `packages/core/src/usecases/accept-invite.test.ts` is excluded from the core library tsconfig and typechecked by `packages/core/tsconfig.tests.json`, which references core and testkit. That avoids a project-reference cycle.
- Seasons, `delete-account`, `BOARD.md`, and `factory/board.json` were not changed.

## Round 2
- review-ux.md: invite panel was below the page and a second tap could create another link → inline panel in that community row, focus moves to the link when it is ready, Escape closes and restores focus, the rest of the page is inert (`CommunitiesView.tsx`, `InviteDialog.tsx`, `CommunitiesPage.tsx`) (f597029)
- review-ui.md: panel sat outside `.page` and Close/Retry stretched to the card width → same column and inline inset as the list; buttons use `align-self: start` (`styles.css`) (f597029)
- review-ux.md: sign-in hid the community name, and a failed sign-in only refetched the preview → name stays, "Signing in…" disables Join, Try again calls `signIn()` (`JoinPage.tsx`, `JoinView.tsx`) (f597029)
- review-ux.md: HTTP 400 showed a retryable error → not-found copy, no Join button, no retry (`JoinPage.tsx`) (f597029)
- review-security.md / review-code.md: passed, no changes
- Nits left as written (next-step copy, joined-page link, link touch size, copy status, expiry margin, link colour, duplicated joining label)

## Round 3
- review-ui.md: the inert row wrapper was not a flex column, so the name, address, role, and Invite button ran on one line → `.community__summary` is a column flex with `gap: var(--space-2)` and `min-inline-size: 0`; the invite panel stays the next sibling (`CommunitiesView.tsx`, `styles.css`) (eb9e2aa)
- review-security.md / review-ux.md / review-code.md: passed, no changes
- Nits left as written (invite link colour, duplicated joining label, join name margin)
