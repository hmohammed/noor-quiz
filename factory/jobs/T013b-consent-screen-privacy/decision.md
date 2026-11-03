APPROVE
Reason: All four round-1 reviews PASS, every acceptance criterion maps to a test in the diff, checks are green, and no escalation trigger applies.
# Decision — T013b

## Checks
- Reviews (round 1): security PASS, code PASS, ux PASS, ui PASS. No must-fix findings, only non-blocking nits.
- Acceptance criteria → tests: 3/3 task criteria (20/20 spec tests), and each one is present in the diff:
  - Criterion 1 (gate after sign-in, reaches app after agreeing, no gate after reload): `apps/web/e2e/consent.spec.ts` "a new user sees the consent screen…", plus `profile.spec.ts` (timezone PATCH only after accept), with unit tests in `client.test.ts` and `accept-consent.test.ts`.
  - Criterion 2 (`/privacy` reachable signed out and while pending): `PrivacyPage.test.tsx` (renders with no providers), `consent-gate-rule.test.ts` (`/privacy` and `/privacy/` exempt), and `consent.spec.ts` "signed out: /privacy is public…" plus the gate → privacy → Home path in the main test.
  - Criterion 3 (loading, error and outdated states, all strings are i18n keys): `ConsentGateView.test.tsx` covers idle, accepting, error and outdated, checks for raw keys and checks that the keys exist. `PrivacyPage.test.tsx` does the same for `privacy.*`.
- Checks green: eslint (max-warnings 0), prettier on changed files, typecheck, web unit tests (13 files, 98 tests), Playwright e2e 8/8. The code reviewer re-ran eslint, typecheck and the web unit tests. `npm run lint` (full) and `tooling/src/docs-commands.test.ts` fail only because of the known CRLF checkout issue, not because of this branch. `test:emulator` does not apply because no adapters or rules changed.
- Definition of Done: every new string goes through `t()` and is in `en.json` (`nav.privacy`, `consent.*`, `privacy.*`). The new CSS uses logical properties only, and an RTL e2e check forces `dir=rtl` until T080. `.env.example` needs no change (no new config). An ADR is not needed (no architectural choice was made). Epic notes for T013c and T080 were added. The BOARD.md row is left to the orchestrator.
- Escalation triggers: none.
  - The task is tagged `sec`, not `human`, and has no human owner.
  - There are no billing, `noor-prod`, prod secrets or DNS changes.
  - `firebase/firestore.rules` is unchanged. The diff touches only `apps/web/**` and `docs/tasks/E01-identity-privacy.md`.
  - No new dependency.
  - Nothing sets `reviewStatus: approved`.
  - Consent stays enforced on the server through `requireConsent()`. The client sends only `{ version }`, taken from the server's `currentVersion`.

## Follow-ups (non-blocking, from reviewers)
- `privacy.rights.body` promises account deletion before T013c ships. Reword it if T013c slips, and do not ship this copy to prod before T013c.
- The final privacy policy should cover religious-belief special-category data, the lawful basis and the controller contact (security P3).
- Accessibility polish for later: while accepting, the status text is announced twice, and focus is not restored after an error.
