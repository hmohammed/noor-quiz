APPROVE
Reason: Round 3 reviews pass, the four acceptance criteria are tested in the diff, and checks are green with no escalation triggers.
# Decision — T021

## Checks
- Reviews (round 3): security PASS, code PASS, ux PASS, ui PASS
- Acceptance criteria → tests: 4/4 (idempotent accept in accept-invite.test.ts and invites.test.ts; 410 GONE in invites.test.ts; member create 403 in create-invite.test.ts and invites.test.ts; e2e in apps/web/e2e/invites.spec.ts)
- Checks green: lint, typecheck, test, test:emulator, test:e2e. The reported docs-commands CRLF failure is outside this diff.
- Escalation triggers: none. Rules stay default deny, qrcode has a justification and exit path, no live billing or prod config, no content marked approved.

## CI fix (round 4)
APPROVE
Reason: `6e8bd7c` only pins the existing devDependency `@playwright/test` (and lockfile `playwright` / `playwright-core`) to 1.61.0 so Chromium can install on Ubuntu 26.04. Invite behaviour is unchanged.

## Checks
- Reviews (round 4): security PASS, code PASS, ux PASS, ui PASS
- Acceptance criteria → tests: 4/4, same tests as the original decision; the pin does not add or drop a test
- Checks green: prettier and typecheck on the two JSON files. Lint, unit, emulator, and the earlier e2e run stay as recorded above. e2e was not re-run after the pin; CI had failed in the browser install, before any test.
- Escalation triggers: none. No new dependency, `firestore.rules` untouched, no live billing or prod config, no content marked approved. The task is not human-owned.
