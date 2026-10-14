ESCALATE
Reason: The committed `npm run test:emulator` has never been seen passing, because port 8080 was busy for the builder and is still busy now. Both reviewers ask for a re-run before merge, and I'm not sure enough to approve a `sec` task without it.
# Decision — T012

## Checks
- Reviews (round 1): security PASS, code PASS
- Acceptance criteria → tests: 2/2 task ACs, covered by 15/15 spec tests. Each test is listed in build.md and exists in the diff (`firebase/rules.test.ts`, `tooling/src/eslint-web-firestore-writes.test.ts`).
- Checks green: lint, typecheck, test (80 tests). test:emulator is **only partly verified**: it got 67/67 on a temporary, uncommitted firebase.json with the port changed to 8189, not with the committed script on port 8080. The mutation check (`allow ... if true`) failed 64/67 as expected.
- Definition of Done: i18n/RTL n/a (no UI). `.env.example` n/a (no config added). AGENT.md, README and E01 notes updated. No ADR needed (no architectural choice beyond the spec).
- Escalation triggers:
  - Owner/tag human: no (tag `sec`).
  - Billing live / prod config / DNS: no (only `demo-noor` emulator).
  - firestore.rules weaker: no. Only the comment changed; it is still a single `allow read, write: if false` (firebase/firestore.rules:5-10).
  - New dependency: `@firebase/rules-unit-testing`, `firebase` (root devDependencies). Justification and exit path are in build.md. All lockfile URLs are on registry.npmjs.org.
  - reviewStatus approved: no.
  - Unsure: **yes**. See below.

## For the human (ESCALATE only)
1. **Run the real script once.** On a machine where 127.0.0.1:8080 is free, run `npm run test:emulator` (package.json:18) on branch `factory/T012-rules-deny-writes` and expect 67/67. Right now the WSL host has something listening on `*:8080` that is outside this session, so neither the builder nor I could run it. If it passes, this can be approved as is.
2. **Optional P3 hardening (security review nit, not blocking).** The apps/web ban at eslint.config.js:34-40 covers only `firebase/firestore`, `firebase/firestore/lite` and `@firebase/firestore`. The compat SDK (`firebase/compat/*`, `.doc().set()`) and `@firebase/firestore/lite` are not covered. `firebase` is now a hoisted root devDependency, so apps/web could import them without declaring them. The deny-all rules still block the writes. Either accept this, or add a `patterns` group, or add it to the T012 follow-up note (docs/tasks/E01-identity-privacy.md:84).
3. **Optional P3.** tooling/src/eslint-web-firestore-writes.test.ts:23: `sources` does not include `@firebase/firestore`, so dropping that path from the config would not fail any test.
