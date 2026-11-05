VERDICT: PASS
# Code review — T021 round 4

## Findings
None.

## Acceptance tests
1. ok — `packages/core/src/usecases/create-invite.test.ts` "stores a ULID token, uses 0, the caller, maxUses 25 and expiry 7 days after one clock read"
2. ok — same file, bounds cases and "throws VALIDATION for … and writes nothing"
3. ok — same file, member / scholar-reviewer / editor forbidden; admin and owner allowed
4. ok — same file, "throws FORBIDDEN when the user has no membership and stores no invite"
5. ok — `packages/core/src/usecases/preview-invite.test.ts` "returns exactly the community name for a live invite"
6. ok — same file, unknown token `NOT_FOUND`; `expiresAt === now` and `uses >= maxUses` are `GONE` with no name
7. ok — same file, malformed token is `VALIDATION` and `getByToken` is not called
8. ok — `packages/core/src/usecases/accept-invite.test.ts` uses `makeTestDeps()`, one member row, second accept leaves `uses` at 1, `listMyCommunities` returns that community
9. ok — same file, existing owner stays owner and `uses` stays 0
10. ok — same file, filled link: the member accepts again; a different user is `GONE` with no membership
11. ok — same file, expired link: new user `GONE`; existing member still succeeds
12. ok — same file, unknown token `NOT_FOUND`; malformed token `VALIDATION` and `accept` is not called
13. ok — `packages/testkit/src/contracts/invite-repo.contract.ts` "gives the last remaining use…", run for the in-memory repo and from `apps/api/src/adapters/firebase/invite-repo.contract.test.ts`
14. ok — same contract, "round-trips create and getByToken, and a second create is CONFLICT"
15. ok — `apps/api/src/routes/invites.test.ts` 201 body is only `{ token, expiresAt, maxUses }`
16. ok — same file, create without a token is 401 `UNAUTHENTICATED`
17. ok — same file, create without current consent is 403 `CONSENT_REQUIRED`
18. ok — same file, member and editor of that tenant are 403 `FORBIDDEN` and `count()` stays 0
19. ok — same file, admin of another tenant is 403 and no invite is stored
20. ok — same file, `role`, `expiresAt`, `maxUses: 0`, unknown key, and a non-ULID `:tenantId` are 400 `VALIDATION`
21. ok — same file, GET with no `Authorization`, and with another tenant's member, is exactly `{ name }`
22. ok — same file, unknown token 404; expired and used-up 410 with no name
23. ok — same file, malformed preview token is 400 `VALIDATION`
24. ok — same file, `maxUses` 1: first accept 201, second 200, role `member`, one membership, `uses` is 1
25. ok — same file, a non-member gets 410 for an expired token and a used-up token, with no membership
26. ok — same file, accept without a token is 401; without consent is 403 and no membership
27. ok — same file, accepting B adds `member` in B and leaves the A membership unchanged
28. ok — same file, `{ role: "owner" }` is 400 and `uses` stays 0
29. ok — `apps/api/src/errors.test.ts` walks every `statusForCode` entry; `GONE` is 410, message `Gone`, and `ErrorResponse` is strict so `details` cannot be in the body
30. ok — `firebase/rules.test.ts` seeds `invites` into the existing deny matrix; `firestore.rules` has no new allow
31. ok — `InviteDialog.test.tsx` and `JoinView.test.tsx` require every `community.invite*` / `join.*` string from `en.json`; the community name is `dir="auto"`. Invite and join rules in `apps/web/src/styles.css` use logical properties
32. ok — `CommunitiesView.test.tsx` "shows Invite for admin and owner only"
33. ok — `InviteDialog.test.tsx` pathname `/join/{token}` and `src="data:` with `fetch` unused; `invite-qr.test.ts` unchanged
34. ok — `JoinView.test.tsx` loading, preview, not-found, gone without a name, signed-out, joined, and error, all under `dir="rtl"`
35. ok — `apps/web/e2e/invites.spec.ts` still uses two contexts: A creates, B opens `/join/:token`, joins, and sees the community; the QR locator is `.invite-dialog` and remote QR hosts stay empty. CI installs Chromium with `npm exec -w @noor/web -- playwright install --with-deps chromium` (`.github/workflows/ci.yml`), which follows this workspace pin
36. ok — `packages/contracts/src/invite.test.ts` strict create, response, and preview schemas; extra keys fail

## Hard rules
1. ok — `6e8bd7c` does not touch `packages/core`. Use cases and `inviteUnusable` still take `Clock`, `IdGenerator`, and repos only.
2. ok — create, preview, and accept stay on the existing `InviteRepo` port. No new port. Playwright is the existing e2e devDependency, not a product adapter.
3. ok — the browser still writes only through the API. The QR stays a `data:` URL from `invite-qr.ts`.
4. ok — create still uses the membership's `tenantId`. Accept still uses the invite document's tenant. The bump does not take a tenant or role from the client.
5. ok — no new `Date.now()` or `new Date()` for the current time. The e2e `Date.now()` remains only a unique email stamp.
6. ok — Invite stays on `admin` and `owner` rows. Accept still sends an empty body. New joins stay `member`.
7. ok — joining is not plan-gated. No plan-name check and no Stripe call.
8. ok — ids are unchanged app ULIDs. This round does not use a Firebase uid as a key.
9. ok — no new secret, no `.env` change, no token or `Authorization` logging. The lockfile resolves from `registry.npmjs.org` and records integrity hashes.
10. ok — no AI output in this slice.
11. ok — no question content is created or scheduled.

## Round 4
`6e8bd7c` changes only `apps/web/package.json` and `package-lock.json`. `@playwright/test` is pinned to `1.61.0` (`apps/web/package.json:25`). The lockfile matches that pin and the registry: `apps/web` devDependencies (`package-lock.json:60`), `node_modules/@playwright/test` `1.61.0` depending on `playwright` `1.61.0` (`package-lock.json:2638`), `node_modules/playwright` `1.61.0` depending on `playwright-core` `1.61.0` (`package-lock.json:10110`), and `node_modules/playwright-core` `1.61.0` (`package-lock.json:10129`). Resolved tarball names are `test-1.61.0.tgz`, `playwright-1.61.0.tgz`, and `playwright-core-1.61.0.tgz`. Integrity hashes match `npm view` for those three versions. No `1.51.1` remains. `playwright` `1.61.0` still optionally depends on `fsevents` `2.3.2`, which the lockfile already recorded. `playwright.config.ts` and `apps/web/e2e` are unchanged. `qrcode` stays the only product dependency added for this task.

`eb9e2aa` is the last product commit. Invite behaviour is the code round 3 passed. `08a8fe6` marks T021 done on `docs/tasks/BOARD.md`; that is factory bookkeeping, not a product change. The Windows `tooling/src/docs-commands.test.ts` CRLF failure is outside this diff and is not a product defect.

## Nits (non-blocking)
- `apps/web/src/features/invites/JoinPage.tsx:41` — the 400 → not-found mapping is not covered by a test. `JoinView.test.tsx` only renders the not-found state.
- `apps/web/src/features/invites/InviteDialog.tsx:51` — focus-on-ready, Escape, and focus restore run in effects. `renderToStaticMarkup` does not execute them, so those paths are untested.
- `apps/web/src/features/layout/AppLayout.tsx:44` — the site header and footer stay active. That matches an inline panel: the communities list and form are what a second Invite tap would use, and those are inert.
- `apps/web/src/features/communities/CommunitiesView.test.tsx:125` — the assertion checks class and sibling order, not the computed column direction. The rule is present in `styles.css`.
