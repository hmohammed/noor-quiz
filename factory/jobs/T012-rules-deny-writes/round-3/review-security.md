VERDICT: PASS
# Security review — T012 round 3

Scope: `git diff main...factory/T012-rules-deny-writes` (727ffe0, 2e95ac4, 2eb5429, ee39dfc), checked against spec.md, build.md (Round 3) and merge.md (Merge attempt 2). I used `git range-diff` to compare the round-2 commits (951a41c..cb1745c) with the rebased commits.

## Findings
None at P0–P2.

What I checked in the code:
- `eslint.config.js` on the branch is main's file plus T012's additions, with nothing else changed. Main's T003 content is all still there and unchanged: `clockMessage`, and the `no-restricted-syntax` block for `packages/core/**` and `apps/api/src/routes/**` that bans `Date.now()` and zero-argument `new Date()`. The core `no-restricted-imports` block (`coreBanned`) is also unchanged. T012 adds `webFirestoreWrites` and a separate `apps/web/**/*.{ts,tsx}` block. That block uses `no-restricted-imports` to ban `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch` and `runTransaction` from `firebase/firestore`, `firebase/firestore/lite` and `@firebase/firestore`.
- Flat config does not merge rule options across blocks. A later block sets the same rule again and replaces the earlier one for any file both blocks match. That is not a problem here because the globs do not overlap. `apps/web/**` matches none of the T003 files (`packages/core/**` or `apps/api/src/routes/**`), and the web block uses a different rule from the clock block. So neither rule overrides the other. `prettier` is still last and only turns off formatting rules.
- The range-diff shows the only change to 727ffe0 compared with round-2 951a41c is the conflict context and the comment going from "block" to "blocks". 2eb5429 and ee39dfc are identical (`=`). 2e95ac4 differs only in package.json and package-lock.json context, because main's `dev:emulators` change came in through the rebase. `firebase/firestore.rules` (one deny-all `match /{document=**}`), `firebase/rules.test.ts` and `firebase/firebase.json` (emulator on 127.0.0.1:8180) are unchanged since round 2. So the round-2 security conclusions still apply.
- All three tests exist on the branch: `tooling/src/eslint-clock-rule.test.ts`, `tooling/src/eslint-web-firestore-writes.test.ts` and `tooling/src/eslint-core-boundary.test.ts`. build.md reports that they pass (4/4, 19/19 and 29/29), along with lint, typecheck and `test:emulator` (67/67). I did not re-run them, because this review is read-only.
- `package.json` keeps both sides: main's `dev:emulators` (which runs `ensure-env-local.mjs`), and T012's `test:emulator` (project `demo-noor`, `--only firestore`) plus its two devDependencies. I did not open `apps/api/.env.example`, which came in from main.

## Nits (non-blocking)
- [P3] eslint.config.js:36: carried over from earlier rounds. The apps/web ban does not cover the compat SDK (`firebase/compat/firestore`, `@firebase/firestore-compat`). Deny-all rules still block those writes at runtime. Fix: add them as `patterns`, or record the gap in the T012 follow-up note.
- [P3] tooling/src/eslint-web-firestore-writes.test.ts: carried over. `@firebase/firestore` is in the config, but no test covers it. Fix: add it to the test sources.

## Hard rules
1. core vendor-free — ok (`coreBanned` block unchanged after the merge)
2. ports + adapters + fakes — ok (test tooling only; no new runtime external system)
3. no client Firestore writes — ok (deny-all rules unchanged and tested; apps/web write-import ban kept through the conflict resolution)
4. tenant isolation — ok (no read rule or tenant collection added)
5. time from Clock — ok (T003 clock lint rule kept unchanged for core and api routes; rules-test fixtures use fixed ISO strings)
6. roles server-side — ok (forged-claims rules tests unchanged)
7. entitlements not plan names — n/a
8. own IDs — ok (fixtures only)
9. secrets — ok (`demo-noor`, no credentials, no `.env*` touched or read; emulator on loopback)
10. AI output untrusted — n/a
11. religious content provenance — n/a
