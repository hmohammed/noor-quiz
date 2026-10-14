# Build — T012 (round 1)
Branch: factory/T012-rules-deny-writes
Worktree: /mnt/c/Users/hassen.mohammed/Downloads/noor-quiz/.claude/worktrees/agent-a352c4d8fdeda16fa

## Changes
- firebase/firestore.rules — comment only. It marks this as the T012 baseline: any future allow must be narrow (named collection, no wildcard), read-only, member-scoped and come with rules tests. The rule is still `allow read, write: if false`, so nothing changes functionally.
- firebase/rules.test.ts (new) — rules tests via `@firebase/rules-unit-testing`. They read the real `firestore.rules` (no inlined copy). Host and port come from `FIRESTORE_EMULATOR_HOST`. `clearFirestore()` + seeding run in `beforeEach` and `cleanup()` runs in `afterAll`. The tests use the modular `firebase/firestore` API on `context.firestore()`. SDK logging is set to `silent` because every denial would otherwise log PERMISSION_DENIED.
- firebase/vitest.config.ts (new) — standalone `rules` project with the timeouts from the spec. It is NOT in the root `vitest.config.ts`, so `npm test` stays emulator-free. It sets `root: import.meta.dirname` so `include: ['rules.test.ts']` resolves when run from the repo root.
- firebase/tsconfig.json (new) + root tsconfig.json reference — `npm run typecheck` covers the rules test. `firebase/dist` is ignored by the existing `dist/` pattern (checked).
- package.json — new `test:emulator` script, exactly as specified. New devDependencies `@firebase/rules-unit-testing@^5.0.2` and `firebase@^12.19.0` (required peer). Justification: this is the official emulator client for rules tests. Exit path: only `firebase/rules.test.ts` uses them, so removing that file removes them. `firebase` was NOT added to apps/web.
- package-lock.json — lockfile for the two devDependencies.
- eslint.config.js — new block for `apps/web/**/*.{ts,tsx}`: `no-restricted-imports` with `paths` for `firebase/firestore`, `firebase/firestore/lite` and `@firebase/firestore`, each with `importNames` setDoc/addDoc/updateDoc/deleteDoc/writeBatch/runTransaction. Message: "The browser never writes to Firestore (AGENT.md rule 3). Call the API." The core block is unchanged and the two globs are disjoint.
- tooling/src/eslint-web-firestore-writes.test.ts (new) — lint tests on virtual fixtures, same structure as eslint-core-boundary.test.ts.
- AGENT.md — removed `# not yet — T004` from the `npm run test:emulator` line. The `deploy:staging` marker stays.
- README.md — added a `npm run test:emulator` line (needs Java 21; port 8080 must be free).
- docs/tasks/E01-identity-privacy.md — T012 Notes: test:emulator exists and T004 only wires it into CI; add rules tests per collection; possible follow-up to ban dynamic imports and wrapper packages.

## Acceptance tests → test files
1. Unauth getDoc denied on users/identities/anything → firebase/rules.test.ts "unauthenticated client > cannot get a doc in %s"
2. Unauth list denied → firebase/rules.test.ts "unauthenticated client > cannot list %s"
3. Unauth setDoc (new) / updateDoc / deleteDoc denied → firebase/rules.test.ts "unauthenticated client > cannot create a new doc in %s", "cannot update the existing doc in %s", "cannot delete the existing doc in %s" (plus "cannot overwrite the existing doc in %s")
4. Authenticated getDoc on own users/uid-alice, identities/uid-alice, anything/x denied → firebase/rules.test.ts "authenticated client > cannot get a doc in %s"
5. Authenticated list denied → "authenticated client > cannot list %s"
6. Authenticated set/update/delete on own docs and addDoc to anything denied → "authenticated client > cannot create/overwrite/update/delete ... in %s", "cannot addDoc to anything"
7. Forged claims `{ platformAdmin: true, tenantId: 'x', role: 'owner' }` open nothing → "authenticated with forged claims client > *" (the full read/write/batch/transaction suite runs for this context)
8. writeBatch and runTransaction denied → "%s client > cannot commit a batched write", "cannot run a transaction" (all three contexts)
9. Sanity: the seeds exist with rules disabled → "seeded docs exist (denials come from rules, not missing docs) > %s seed is readable with rules disabled". Extra check: "writes really were denied > seeded docs are unchanged and no new docs exist after a denied write attempt"
10. Lint error (severity 2) on `import { setDoc } from 'firebase/firestore'` in apps/web/src/__lint_fixture__.ts → tooling/src/eslint-web-firestore-writes.test.ts "flags `import { setDoc } from 'firebase/firestore'` in apps/web"
11. Each of the six write APIs from both firebase/firestore and firebase/firestore/lite → same file "flags %s imported from %s in apps/web" (12 cases)
12. .tsx fixture, aliased import, namespace import, re-export → same file "flags the import in a .tsx file", "flags an aliased import", "flags a namespace import", "flags a re-export"
13. Read APIs allowed → same file "allows Firestore read APIs in apps/web"
14. No ban outside apps/web → same file "does not apply the ban outside apps/web". tooling/src/eslint-core-boundary.test.ts passes unchanged (29 tests).
15. docs-commands test still passes → tooling/src/docs-commands.test.ts (8 tests pass)

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (13 files, 80 tests; the rules project is not included) |
| npm run test:emulator | script verified, but it could not bind in this environment: port 8080 on 127.0.0.1 is held by a process outside this session (not a visible WSL process), and I did not touch it. I ran the identical command against a temporary, uncommitted copy of firebase.json with the Firestore port changed to 8189: `firebase emulators:exec --only firestore --config firebase/tmp-verify.firebase.json --project demo-noor "vitest run --config firebase/vitest.config.ts"` → 67/67 pass. The temp file was deleted afterwards. |
| mutation check (temp `allow read, write: if true`) | 64/67 fail as expected (only the 3 seed sanity tests pass); rules file restored |
| npm run test:e2e | not relevant (no UI flows touched) |

## Commits
- 4da168b T012: ban Firestore write API imports in apps/web
- ff544dc T012: Firestore rules tests on the emulator and test:emulator script
- 8d70445 T012: document test:emulator and add notes for T004

## Notes for reviewers
- Emulator port: `npm run test:emulator` uses the committed firebase.json (port 8080), as the spec requires. Please re-run it on a machine where 8080 is free. Changing ports was out of scope.
- `ctx.firestore()` returns the compat type, so the test casts it to the modular `Firestore` (`as unknown as Firestore`). This is the documented usage pattern; it works at runtime against the emulator.
- The namespace import (`import * as fs`) produces exactly one `no-restricted-imports` error with this ESLint version, so all tests assert exactly one severity-2 message that contains "AGENT.md rule 3".
- The identities seed uses the fixed ULID-shaped placeholder `01JAAAAAAAAAAAAAAAAAAAAAAA` for "01J...". All dates are fixed ISO strings; there is no `new Date()`.
- npm printed one EBADENGINE warning (a transitive package wants Node ^20.19 || ^22.13; the local Node is 20.18.3). It is harmless here because CI and engines target Node 22.

## Round 2
- round-1/rework.md: move the Firestore emulator port 8080 → 8180 → fixed in firebase/firebase.json (Firestore only; auth 9099, functions 5001 and ui 4000 unchanged) (cb1745c)
- round-1/rework.md: update other hard-coded 8080 references → fixed in README.md line 43 ("port 8180 must be free") (cb1745c). `git grep 8080` outside `factory/` now finds nothing. The remaining hits are historical factory records (T002 spec, T012 decision and reviews, and the round-1 text of this file), which I left unchanged. No e2e config, script or test hard-codes the Firestore port: rules.test.ts reads `FIRESTORE_EMULATOR_HOST`.
- round-1/rework.md: run `npm run test:emulator` unchanged, as committed → 67/67 pass on 127.0.0.1:8180, "Script exited successfully (code 0)". This replaces the alternate-port verification from round 1.

| command | result |
| --- | --- |
| npm run test:emulator | pass (67/67, committed script, port 8180) |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (13 files, 80 tests) |

Commits (after rebase onto ef1c7d2): 951a41c, 3a8eca3, ac10c53 (round 1), cb1745c T012: move Firestore emulator port from 8080 to 8180.
The P3 lint nits from the security review were not changed: the rework note puts them out of scope.

## Round 3
- merge.md (Merge attempt 2): rebase conflict in eslint.config.js against T003 (2bf37d9) → rebased onto main (now on 779cace) and resolved in eslint.config.js (727ffe0). I kept both blocks: T003's `no-restricted-syntax` Date.now()/new Date() rule for `packages/core/**` + `apps/api/src/routes/**`, and T012's `no-restricted-imports` Firestore-write ban for `apps/web/**`. They use different rules on different globs, so neither overrides the other. The core `no-restricted-imports` block is unchanged. The only text change in the T012 block is its comment, which now says "core blocks" (plural).
- merge.md: package.json / package-lock.json → git merged both without conflicts. package.json keeps both sides: T003's `dev:emulators` (ensure-env-local.mjs) and workspace changes, plus T012's `test:emulator` script and the `@firebase/rules-unit-testing` / `firebase` devDependencies. `npm install` on the merged lockfile reported "up to date" and changed nothing, so I made no lockfile edit.
- `apps/api/.env.example` came in from main; I did not open or touch it.

| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (25 files, 190 tests; includes tooling/src/eslint-clock-rule.test.ts 4/4 and tooling/src/eslint-web-firestore-writes.test.ts 19/19, eslint-core-boundary 29/29) |
| npm run test:emulator | pass (67/67, committed script, port 8180) |

Commits after rebase: 727ffe0 T012: ban Firestore write API imports in apps/web · 2e95ac4 T012: Firestore rules tests on the emulator and test:emulator script · 2eb5429 T012: document test:emulator and add notes for T004 · ee39dfc T012: move Firestore emulator port from 8080 to 8180
