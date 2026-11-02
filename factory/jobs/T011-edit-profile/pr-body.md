## Summary
- Members can edit their display name, language, and timezone on `/profile`. The page saves through `PATCH /v1/me`.
- Names are normalised (NFC, trimmed, single spaces) and limited to Unicode letters and marks, 2–32 characters. Locale must be one of `en`, `sv`, `ar`, `am`, `so`. Timezone must be a real IANA name.
- On first sign-in, if no timezone is stored, the app saves the browser timezone once. A later sign-in does not overwrite an edited name.

## Acceptance criteria
- [x] Amharic (ሀሰን), Arabic (حسن), and Swedish (Åsa) names are accepted. Empty, emoji-only, and over-32-character names are rejected. `packages/core/src/users/profile.test.ts`, `packages/contracts/src/me.test.ts`, `apps/api/src/routes/me.test.ts`
- [x] An invalid timezone or unsupported locale returns 400 and writes nothing. `apps/api/src/routes/me.test.ts`
- [x] End-to-end: change the name to ሀሰን and see it in the header, including after reload. `apps/web/e2e/profile.spec.ts`

## Checks
- `npm install` — pass
- `npm run lint` — ESLint passes. `prettier --check` fails on this Windows checkout because `core.autocrlf=true` rewrites untouched files to CRLF. `prettier --check --end-of-line auto .` passes
- `npm run typecheck` — pass
- `npm test` — 769 passed. `tooling/src/docs-commands.test.ts` fails only because `AGENT.md` is CRLF here. The diff does not touch that file
- `npm run test:emulator` — pass (107 tests)
- `npm run test:e2e` — 5 passed. `dev:emulators` uses POSIX env syntax that cmd.exe cannot run, so the same servers were started by hand and Playwright reused them

## Reviews
- Round 1: security PASS, UX CHANGES (draft leaked across users, load error used the save message, sign-in unavailable was a dead end), UI PASS, code PASS
- Round 2: security PASS, UX PASS, UI PASS, code PASS. The form resets per user, a load failure has its own message and retry, and sign-in unavailable is its own state
- Approver: APPROVE

## Needs a human
- Merge this pull request. T013 waits until this is merged.
- Before public launch, add a board task to rate-limit `PATCH /v1/me`. The epic notes already mention it.
- Non-blocking reviewer notes, left as-is: re-check the session generation after `getIdToken()` in `updateMe`, and write the token user id after the body spread in `routes/me.ts`.

Co-authored-by: Grok 4.7 <cursoragent@cursor.com>
