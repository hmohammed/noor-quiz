APPROVE
Reason: All four round-2 reviews pass. Every acceptance criterion is covered by tests in the diff and the checks are green. No escalation triggers.
# Decision — T011

## Checks
- Reviews (round 2): security PASS, ux PASS, ui PASS, code PASS. Round 2 fixed all three round-1 UX must-fixes in b30b82d.
- Acceptance criteria → tests: 3/3 task criteria, covered by spec tests 1–25. Each one is listed in build.md and present in the diff:
  - Amharic, Arabic and Swedish names are accepted; empty, emoji-only and over-32-character names are rejected. Covered by `packages/core/src/users/profile.test.ts`, `packages/contracts/src/me.test.ts`, `apps/api/src/profile-parity.test.ts` and `apps/api/src/routes/me.test.ts:271` plus the 400 cases.
  - An invalid timezone or unsupported locale returns 400. Covered by `apps/api/src/routes/me.test.ts:333` and the matching core and contract tables.
  - e2e: changing the name shows it in the header. Covered by `apps/web/e2e/profile.spec.ts:33`, which also checks the name after a reload. The scope item "timezone defaulted from the browser" is covered by e2e test 11 and the unit test `timezone-default.test.ts`.
- Checks green:
  - typecheck and eslint pass.
  - `prettier --check --end-of-line auto` passes.
  - Unit tests: 769 pass. The one failing suite, `tooling/src/docs-commands.test.ts`, fails only because this checkout has a CRLF `AGENT.md`, which the diff does not touch. The code reviewer confirmed this on their own run.
  - Emulator tests: 107 pass in round 1. They were not re-run in round 2 because no adapter or rules file changed.
  - e2e: 5/5 pass.
- Definition of Done:
  - i18n: all new strings are in `en.json` and go through `t()`.
  - RTL: the CSS uses logical properties and the name input and display use `dir="auto"`. The Arabic RTL Playwright check is scoped to T080/T081 by the spec.
  - Docs: the T011 notes in `docs/tasks/E01-identity-privacy.md` are updated.
  - No `.env.example` change and no ADR were needed. There is no new port and no new architectural choice.
- Escalation triggers: none.
  - The task is tagged "—", not `human`.
  - `firebase/firestore.rules` is unchanged. The only change in `rules.test.ts` adds two null fields to the seed data.
  - No `package.json` or lockfile changes, so no new dependency. `hono/body-limit` is built into hono.
  - Nothing touches billing, `noor-prod`, prod secrets or DNS.
  - Nothing sets `reviewStatus`.

## Follow-ups (non-blocking, from reviewers)
- Add a BOARD task for rate limiting `PATCH /v1/me` before public launch. It is already in the epic notes.
- `session-context.tsx:124-127`: re-check `generation` right after `getIdToken()` in `updateMe`.
- `routes/me.ts:30`: write `{ ...patch, userId: c.var.user.id }` so the route stays safe if the contract is loosened later.
