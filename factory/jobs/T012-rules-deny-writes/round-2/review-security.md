VERDICT: PASS
# Security review — T012 round 2

Scope: `git diff main...factory/T012-rules-deny-writes` (951a41c, 3a8eca3, ac10c53, cb1745c), checked against spec.md, build.md and round-1/rework.md. Round 2 adds one commit, cb1745c, which changes 2 files with 2 lines added and 2 removed.

## Findings
None at P0–P2.

What I checked in the code:
- `firebase/firebase.json:7`: the Firestore emulator moved from 8080 to 8180 and still binds to `127.0.0.1`, so it is not exposed on all interfaces. Auth (9099), functions (5001) and UI (4000) are unchanged. `singleProjectMode` and the `firestore.rules` path are unchanged, so the emulator still loads the deny-all file that the tests check.
- `README.md:43`: the text now says 8180. On the branch, `git grep 8080` outside `factory/` finds nothing. `firebase/rules.test.ts` hard-codes no host or port. It relies on `FIRESTORE_EMULATOR_HOST`, which `emulators:exec` sets. Playwright and Vite only point at the functions emulator (5001), so nothing still points at the old Firestore port.
- `firebase/firestore.rules` on the branch is still a single `match /{document=**} { allow read, write: if false; }`. Since round 1, no `allow` was added and no rules or test logic changed.
- The round-1 security conclusions still hold, because those files did not change in round 2. Those conclusions are: deny-all is tested for unauthenticated, authenticated and forged-claims clients; `npm test` needs no emulator; project is `demo-noor` with no credentials; the apps/web write-import lint ban is in place; and the lockfile adds no registry other than registry.npmjs.org.
- build.md reports `npm run test:emulator` run unchanged as committed with 67/67 passing on 8180. I did not re-run it, because this review is read-only.

## Nits (non-blocking)
- [P3] eslint.config.js:35: carried over from round 1 and out of scope according to rework.md. The apps/web ban does not cover the compat SDK (`firebase/compat/*`, `@firebase/firestore-compat`) or `@firebase/firestore/lite`. The deny-all rules still block those writes. Fix: add them as `patterns`, or record the gap in the T012 follow-up note.
- [P3] tooling/src/eslint-web-firestore-writes.test.ts:23: carried over from round 1. The `@firebase/firestore` path is in the config, but no test covers it. Fix: add it to `sources`.

## Hard rules
1. core vendor-free — ok (no `packages/core` change)
2. ports + adapters + fakes — ok (no new runtime external system; test tooling only)
3. no client Firestore writes — ok (deny-all unchanged and tested; emulator port change does not affect rules)
4. tenant isolation — ok (no tenant-readable collection or read rule added)
5. time from Clock — ok (fixtures use fixed ISO strings)
6. roles server-side — ok (forged-claims suite unchanged)
7. entitlements not plan names — n/a
8. own IDs — ok (fixtures only; ULID-shaped userId separate from uid)
9. secrets — ok (`demo-noor`, no credentials, no `.env` touched; emulator bound to loopback)
10. AI output untrusted — n/a
11. religious content provenance — n/a
