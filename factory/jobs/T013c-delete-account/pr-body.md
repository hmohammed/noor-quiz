## Summary
- A signed-in person can delete their own account from the profile page. `DELETE /v1/me` removes that user and every linked identity, and signing in again starts from scratch, including consent.
- The delete does not create a user on a repeat call, works without consent, and returns 401 when the token is missing or rejected. Firebase Auth is not revoked.
- Agreeing to consent starts a timezone save on the same cancellation as a profile save, so that save cannot recreate the account after delete.
- In this repository the orchestrator merges the pull requests it opens. `AGENT.md` records that. The factory skill is unchanged.

## Acceptance criteria
- [x] After delete, the same Google account signing in gets a new userId and no old data. `packages/core/src/usecases/delete-account.test.ts`, `apps/api/src/routes/me.test.ts`, `packages/testkit/src/contracts/user-repo.contract.ts`, `apps/web/e2e/delete-account.spec.ts`
- [x] Deletion is idempotent. Two DELETEs return 204, and the second writes nothing and creates no user. `apps/api/src/routes/me.test.ts`, the user-repo contract
- [x] `DELETE /v1/me` returns 401 without a token or with a rejected token, and works without consent. `apps/api/src/routes/me.test.ts`

## Checks
- ESLint — pass
- `prettier --check --end-of-line auto` — pass. Plain `prettier --check` fails on this Windows checkout because of CRLF on untouched files
- `npm run typecheck` — pass
- `npm test` — 917 passed. `tooling/src/docs-commands.test.ts` fails only because `AGENT.md` is CRLF here
- `npm run test:emulator` — pass (127 tests)
- `npm run test:e2e` — 10 passed. Servers were started by hand because `dev:emulators` uses POSIX syntax that cmd.exe cannot run

## Reviews
- Round 1: security PASS, UX CHANGES, UI CHANGES, code PASS
- Round 2: security PASS, UX PASS, UI PASS, code PASS
- Round 3 (rebase onto the merged consent screen): security CHANGES, UX CHANGES, UI PASS, code CHANGES
- Human rework, round 4: security PASS, UX PASS, UI PASS, code PASS
- Approver: APPROVE

## Needs a human
- The `identities where userId ==` query is a single-field equality. No composite index was added.
- Firebase Auth accounts and tokens are not revoked. That needs an auth-port change.
- Memberships (T020) and answers (T040) do not exist yet, so this delete does not remove them.
- T013 and T013c are marked `done` in this pull request. T020 can start after it is merged.

Co-authored-by: Grok 4.7 <cursoragent@cursor.com>
