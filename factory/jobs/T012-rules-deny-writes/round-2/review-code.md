VERDICT: PASS
# Code review — T012 round 2

Scope of round 2: commit cb1745c only (firebase/firebase.json Firestore port 8080 -> 8180, README.md line 43). Round-1 content re-checked in the full diff.

## Findings
None.

## Acceptance tests
1-9. ok — firebase/rules.test.ts: describe.each over unauthenticated / authenticated / forged-claims clients covers get, list, create, overwrite, update, delete, addDoc, writeBatch, runTransaction on users, identities, anything; seed sanity test plus "writes really were denied". Reads the real firestore.rules; the rules are deny-all, so the tests would fail under allow (round-1 mutation check: 64/67 failed).
10-14. ok — tooling/src/eslint-web-firestore-writes.test.ts; eslint.config.js block for apps/web/**/*.{ts,tsx} is disjoint from the core block.
15. ok — docs-commands test passes (npm test in the worktree: 13 files, 80 tests pass, re-run by me).
Not re-run by me: npm run test:emulator (build.md reports 67/67 on 127.0.0.1:8180, committed script unchanged).

## Hard rules
1. ok (nothing in packages/core touched)
2. ok (no new vendor call path)
3. ok (rules stay deny-all; lint ban in apps/web)
4. ok (no tenant data; no allow added)
5. ok (no Date.now/new Date in firebase/ or tooling/; fixed ISO strings)
6. ok (forged-claims test)
7. ok (n/a)
8. ok (n/a; seed uid-alice is a fixture only)
9. ok (demo-noor project, no secrets, no .env)
10. ok (n/a)
11. ok (n/a)

## Scope
Round 2 diff is 2 lines in 2 files, exactly as round-1/rework.md asks. Auth 9099, functions 5001 and ui 4000 unchanged. `git grep 8080` outside factory/ on the branch finds nothing. rules.test.ts reads FIRESTORE_EMULATOR_HOST, so no other port reference exists. P3 lint nits correctly left alone.

## Nits (non-blocking)
- Remaining 8080 mentions are only historical factory records; fine to leave.
- build.md "Round 1" section still says 8080 / 8189; it is accurate history and is superseded by "Round 2".
