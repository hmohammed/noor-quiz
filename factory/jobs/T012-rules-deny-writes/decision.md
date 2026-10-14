APPROVE
Reason: Round 3 is a clean rebase onto main (779cace, with T003). eslint.config.js keeps T003's clock rule and T012's apps/web write ban on separate globs, both reviewers PASS, all checks are green including test:emulator 67/67, and no escalation trigger applies.
# Decision — T012

## Checks
- Reviews (round 3): security PASS, code PASS. Neither has P0–P2 findings. The two P3 lint nits carried over from earlier rounds are still out of scope (round-1/rework.md).
- Acceptance criteria → tests: 2/2 task ACs, covered by spec tests 1–15. Each is listed in build.md and exists in the diff:
  - Rules AC → `firebase/rules.test.ts`. It runs describe.each over unauthenticated, authenticated and forged-claims clients for get, list, create, overwrite, update, delete, addDoc, batch and transaction on users, identities and anything. It also has the seed sanity check and the "writes really were denied" check.
  - Lint AC → `tooling/src/eslint-web-firestore-writes.test.ts` (19 tests). It flags setDoc and the other five write APIs from firebase/firestore and /lite, plus .tsx, aliased, namespace and re-export imports. It allows read APIs and does not apply outside apps/web.
- Checks green (build.md, Round 3, after the rebase): lint, typecheck, test (25 files, 190 tests: eslint-clock-rule 4/4, eslint-web-firestore-writes 19/19, eslint-core-boundary 29/29) and test:emulator (67/67, committed script on 127.0.0.1:8180). e2e: n/a, no UI.
- Rebase verification (by me):
  - The merge-base of the branch equals the `main` tip 779cace. The branch has 4 commits: 727ffe0, 2e95ac4, 2eb5429, ee39dfc.
  - eslint.config.js on the branch has 4 blocks. Lines 66-67 hold the core `no-restricted-imports` (coreBanned), unchanged. Lines 70-80 hold T003's `no-restricted-syntax` clock rule for `packages/core/**` and `apps/api/src/routes/**`, unchanged. Lines 86-89 hold T012's `no-restricted-imports` for `apps/web/**/*.{ts,tsx}`. Compared with main, the diff only adds lines (+23).
  - package.json keeps T003's `dev:emulators` and adds only `test:emulator` and the two devDependencies. The package-lock.json diff only adds entries; its one removed line is an `"optional": true` flag, which goes because `firebase` now pulls that package in. All added `resolved` URLs are on registry.npmjs.org.
- Definition of Done:
  - i18n/RTL: n/a (no UI).
  - `.env.example`: n/a (no config added). `apps/api/.env.example` came in from main and was not opened.
  - Docs: the AGENT.md `not yet` marker is removed, the README command is added with port 8180, and the E01 T012 notes are filled in.
  - ADR: none needed.
- Escalation triggers: none.
  - Owner/tag human: no (tag `sec`).
  - Billing live / prod config / DNS: no. Only the `demo-noor` emulator port changed (firebase/firebase.json:7, loopback).
  - firestore.rules weaker: no. Only the comment changed, and it is still a single `match /{document=**} { allow read, write: if false; }`.
  - New dependency: `@firebase/rules-unit-testing` and `firebase` as root devDependencies, with justification and exit path in spec.md and build.md. Neither is new since round 2.
  - reviewStatus approved: no.
  - Unsure: no.

## For the merge queue (not blocking approval)
- The previous squash-merge blocker (an uncommitted, human-owned change to package-lock.json on `main`) no longer shows: `git diff main -- package-lock.json` in the main checkout is empty. Run the merge-queue checks again before the squash merge.
- Optional P3 follow-ups (security review): the compat SDK is not covered by the eslint ban (eslint.config.js:36), and no test covers the `@firebase/firestore` path (tooling/src/eslint-web-firestore-writes.test.ts:23).

## For the human (ESCALATE only)
n/a

---

## Round 2 (superseded)

APPROVE
Reason: Round 2 does exactly what the human rework asked (Firestore emulator 8080 -> 8180, plus the README). The committed `npm run test:emulator` now passes 67/67, both reviewers PASS, and no escalation trigger applies.
# Decision — T012

## Checks
- Reviews (round 2): security PASS, code PASS. Both have no P0–P2 findings. The two P3 lint nits from round 1 are carried over, and rework.md puts them out of scope.
- Acceptance criteria → tests: 2/2 task ACs, covered by spec tests 1–15. Each is listed in build.md and exists in the diff:
  - Rules AC → `firebase/rules.test.ts`. It runs describe.each over the unauthenticated, authenticated and forged-claims clients for get, list, create, overwrite, update, delete, addDoc, batch and transaction on users, identities and anything. It also has a seed sanity check and a "writes really were denied" check.
  - Lint AC → `tooling/src/eslint-web-firestore-writes.test.ts`, which flags setDoc and the other five write APIs from firebase/firestore and /lite, plus .tsx, aliased, namespace and re-export imports. It allows read APIs and does not apply outside apps/web.
- Checks green (build.md, Round 2): lint, typecheck, test (13 files, 80 tests), test:emulator (67/67, committed script run unchanged on 127.0.0.1:8180, exit code 0). This resolves the round-1 escalation, which was that the committed script had never been seen passing. Round 1 also had a mutation check (`allow ... if true` made 64/67 fail). e2e: n/a, no UI.
- Definition of Done:
  - i18n/RTL: n/a (no UI).
  - `.env.example`: n/a (no config added).
  - Docs: AGENT.md `not yet` marker removed, README command added with port 8180, E01 T012 notes filled in.
  - ADR: none needed. The port move is a local dev setting that the human ordered.
- Escalation triggers: none.
  - Owner/tag human: no (tag `sec`).
  - Billing live / prod config / DNS: no. The change is only the `demo-noor` emulator port in firebase/firebase.json:7, still bound to 127.0.0.1.
  - firestore.rules weaker: no. Only the comment changed, and it is still a single `match /{document=**} { allow read, write: if false; }` (firebase/firestore.rules:7-13).
  - New dependency: `@firebase/rules-unit-testing` and `firebase` as root devDependencies. Justification and exit path are in build.md and spec.md. All 41 added lockfile `resolved` URLs are on registry.npmjs.org.
  - reviewStatus approved: no.
  - Unsure: no.
- Scope note: spec.md listed firebase.json emulator ports as out of scope, but the human asked for this change explicitly in round-1/rework.md. Outside `factory/`, `git grep 8080` on the branch finds nothing.

## For the merge queue (not blocking approval)
- merge.md: the previous squash merge paused because `main` had an uncommitted, human-owned change to package-lock.json, and this branch also changes package-lock.json. A human needs to clear that before the merge can go ahead.
- Optional P3 follow-ups (security review):
  - eslint.config.js:35 does not cover the compat SDK (`firebase/compat/*`, `@firebase/firestore-compat`) or `@firebase/firestore/lite`.
  - tooling/src/eslint-web-firestore-writes.test.ts:23 has no test for the `@firebase/firestore` path.
  - The deny-all rules still block those writes. Consider adding this to the T012 follow-up note in docs/tasks/E01-identity-privacy.md.

## For the human (ESCALATE only)
n/a

---

## Round 1 (superseded)

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

---
Approved by human (hmohammed) via `/factory approve T012` on 2026-10-14T09:34:47Z.
