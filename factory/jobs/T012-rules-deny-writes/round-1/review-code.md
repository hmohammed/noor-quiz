VERDICT: PASS
# Code review — T012 round 1

## Findings
None must-fix.

## Acceptance tests
1. ok — firebase/rules.test.ts "unauthenticated client > cannot get a doc in %s"
2. ok — "unauthenticated client > cannot list %s"
3. ok — unauthenticated create / overwrite / update / delete cases
4. ok — "authenticated client > cannot get a doc in %s" (own users/identities doc, anything/x)
5. ok — "authenticated client > cannot list %s"
6. ok — authenticated create / overwrite / update / delete plus "cannot addDoc to anything"
7. ok — forged-claims context runs the full suite (read, write, batch, transaction)
8. ok — "cannot commit a batched write" / "cannot run a transaction" for all 3 contexts
9. ok — seed sanity test, plus the "writes really were denied" check
10-14. ok — tooling/src/eslint-web-firestore-writes.test.ts (19 tests); re-run by me, pass, core-boundary (29) unchanged and passing
15. ok — docs-commands.test.ts passes (8)
Would the tests fail without the change? Rules tests: build.md reports a mutation check (`allow ... if true` fails 64/67). Lint tests: they fail without the eslint block, since no restricted-imports rule exists for apps/web. Not independently re-run: the emulator tests (port 8080 busy in the builder's environment; builder ran them on a temporary port, 67/67).

## Hard rules
1. ok — nothing in packages/core
2. ok — no new vendor call outside tests (firebase is used only in the rules test)
3. ok — rules remain deny-all; web import ban added
4. ok — no tenant data; no read rules pre-created
5. ok — no Date.now()/new Date() in the new files (fixed ISO strings)
6. ok — forged-claims test
7. ok — n/a
8. ok — uid-alice is only a fixture key; real schema out of scope
9. ok — demo-noor, no credentials, no .env touched
10. ok — n/a
11. ok — n/a

## Scope
Within spec. The files touched match the spec's list, including the AGENT.md, README and E01 notes. The lockfile diff is large but comes only from the two specified devDependencies.

## Correctness / Tests
- Rules are read from the real file; FIRESTORE_EMULATOR_HOST is used; clearFirestore runs in beforeEach and cleanup in afterAll; no sleeps; no real network.
- firebase project is not in the root vitest projects, so `npm test` stays emulator-free.

## i18n/RTL
n/a (no UI).

## Dependencies
@firebase/rules-unit-testing and firebase are root devDependencies only, used in firebase/rules.test.ts. The justification and exit path are in build.md.

## Nits (non-blocking)
- firebase/rules.test.ts uses the `as unknown as Firestore` cast (documented in build.md).
- The test-only "testkit" fakes do not apply here.
- Please re-run `npm run test:emulator` on a machine where port 8080 is free before merge.
