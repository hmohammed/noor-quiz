## Summary
- A signed-in user who has not accepted the current terms sees a consent screen before the rest of the app. Agreeing sends the server's current version to `POST /v1/me/consent`.
- `/privacy` is public, including while consent is still required, and the footer links to it.
- The browser timezone is saved only after consent is recorded.

## Acceptance criteria
- [x] A new user sees the consent screen after sign-in. After agreeing they reach the app, and a reload does not show the screen again. `apps/web/e2e/consent.spec.ts`
- [x] `/privacy` is reachable signed out and while consent is pending. `apps/web/src/features/privacy/PrivacyPage.test.tsx`, `apps/web/src/features/consent/consent-gate-rule.test.ts`, `apps/web/e2e/consent.spec.ts`
- [x] View tests cover the loading, error and outdated-terms states, and every string is an i18n key. `apps/web/src/features/consent/ConsentGateView.test.tsx`, `apps/web/src/features/privacy/PrivacyPage.test.tsx`

## Checks
- ESLint — pass
- `prettier --check --end-of-line auto` — pass. Plain `prettier --check` fails on this Windows checkout because of CRLF on untouched files
- `npm run typecheck` — pass
- `npm test` — 874 passed. `tooling/src/docs-commands.test.ts` fails only because `AGENT.md` is CRLF here. The diff does not touch that file
- `npm run test:emulator` — not run. No adapters or rules changed
- `npm run test:e2e` — 8 passed. Servers were started by hand because `dev:emulators` uses POSIX syntax that cmd.exe cannot run

## Reviews
- Round 1: security PASS, UX PASS, UI PASS, code PASS
- Approver: APPROVE

## Needs a human
- Merge this pull request. T013 stays `split` until T013c, the last sub-task, is merged.
- The privacy page says users will be able to delete their account. That arrives in T013c, so do not ship this copy to production if T013c slips.
- Follow-ups left for later: the final privacy policy should name religious-belief data, the lawful basis and a controller contact. While agreeing, the status text is announced twice, and focus is not restored after an error.

Co-authored-by: Grok 4.7 <cursoragent@cursor.com>
