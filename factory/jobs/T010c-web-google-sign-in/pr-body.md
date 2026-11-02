## Summary
- The home page header signs in with Google and shows the display name returned by `GET /v1/me`. Sign-out is included.
- Firebase Auth lives only in `apps/web/src/auth/session.ts`. The API client sends the ID token as a bearer header and does not import Firebase.
- An Auth emulator host is refused unless the Firebase project id starts with `demo-`.

## Acceptance criteria
- [x] End-to-end with the Auth emulator: sign in, see the name from `/v1/me`, then sign out. `apps/web/e2e/sign-in.spec.ts`
- [x] The shown name is the API display name, not Firebase's own name. `apps/web/e2e/sign-in.spec.ts`

## Checks
- `npm install` — pass
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — pass (43 files, 542 tests)
- `npm run test:emulator` — not relevant (no adapter or rules change)
- `npm run test:e2e` — pass (2 tests: home and sign-in)

## Reviews
- Round 1: security PASS, UX CHANGES (auth button under 44px), UI PASS, code PASS
- Round 2: security PASS, UX PASS, UI PASS, code PASS. The button is at least 44px tall and 6rem wide.
- Approver: APPROVE

## Needs a human
- Merge this pull request. It also marks the split parent T010 done, so T011 can start after the merge.
- No other human step. Follow-ups left for later: real Firebase web config for the dev deploy, and the Windows `dev:emulators` script, which uses shell syntax cmd.exe cannot run.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
