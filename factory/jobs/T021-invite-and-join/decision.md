APPROVE
Reason: Round 3 reviews pass, the four acceptance criteria are tested in the diff, and checks are green with no escalation triggers.
# Decision — T021

## Checks
- Reviews (round 3): security PASS, code PASS, ux PASS, ui PASS
- Acceptance criteria → tests: 4/4 (idempotent accept in accept-invite.test.ts and invites.test.ts; 410 GONE in invites.test.ts; member create 403 in create-invite.test.ts and invites.test.ts; e2e in apps/web/e2e/invites.spec.ts)
- Checks green: lint, typecheck, test, test:emulator, test:e2e. The reported docs-commands CRLF failure is outside this diff.
- Escalation triggers: none. Rules stay default deny, qrcode has a justification and exit path, no live billing or prod config, no content marked approved.
