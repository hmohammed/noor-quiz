APPROVE
Reason: Round 4 reviews pass after the rebase, all acceptance tests are in the diff, and checks are green with no escalation triggers.
# Decision — T031

## Checks
- Reviews (round 4): security PASS, code PASS, ux PASS, ui PASS
- Acceptance criteria → tests: 3/3 (editors, members, and scholar-reviewers 403 in seasons.test.ts; start and length 409 CLOSED in seasons.test.ts and update-season.test.ts; e2e create-and-list in seasons.spec.ts). Spec tests 1–39 are present in the diff.
- Checks green: lint, typecheck, unit tests (round 1: 1189 passed, plus the known Windows CRLF failure in tooling/src/docs-commands.test.ts outside this diff; round 4 after rebase: season unit tests 222 and shared-file tests 119), test:emulator, test:e2e
- Escalation triggers: none. Task is not human-owned. firestore.rules is unchanged (blanket deny; seasons only added to the deny-loop seed). No new dependency, no live billing, no production config, no reviewStatus approved. Season strings use i18n; the new screen is covered by the RTL e2e. No env or ADR change was required.
