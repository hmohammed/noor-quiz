VERDICT: PASS
# Security review — T012 round 1

Scope: `git diff main...factory/T012-rules-deny-writes` (commits 4da168b, ff544dc, 8d70445) checked against spec.md and build.md.

## Findings
None at P0–P2.

What I checked in the code:
- `firebase/firestore.rules`: only the comment changed. It still has a single `match /{document=**} { allow read, write: if false; }`, with no `allow` anywhere else. `firebase/firebase.json` points `firestore.rules` at this file, so the emulator and any later deploy use the same file the tests check.
- `firebase/rules.test.ts` loads the real rules file through `readFileSync(new URL('./firestore.rules', import.meta.url))`, not an inlined copy. It seeds docs with rules disabled and runs a sanity check that the seeds exist. It then asserts denial of get, list, create, overwrite, update, delete, addDoc, batch and transaction for three clients: unauthenticated, authenticated, and authenticated with forged claims `{ platformAdmin, tenantId, role }`. A final check confirms that a denied write leaves the data unchanged. This covers rule 3 and rule 6 (claims grant no client access).
- `firebase/vitest.config.ts` is not in the root `vitest.config.ts` projects (`packages/*`, `apps/*`, `tooling`), so `npm test` does not need the emulator.
- The `test:emulator` script uses `--project demo-noor` with `emulators:exec --only firestore`. It needs no credentials and no service account. It reads and writes no `.env` files and puts no secrets in tests or docs.
- `eslint.config.js`: the new apps/web block targets a glob that does not overlap the core block, and the core block is unchanged. `prettier` comes last and only turns off formatting rules, so it does not override `no-restricted-imports`.
- Dependencies: `@firebase/rules-unit-testing` and `firebase` are root devDependencies, with the justification and exit path given in build.md. Every resolved URL in the lockfile is on registry.npmjs.org. Nothing was added to `packages/core` or `apps/web`.
- `firebase/dist` is covered by the `dist/` entry in `.gitignore`.

## Nits (non-blocking)
- [P3] eslint.config.js:35 — The apps/web ban covers only `firebase/firestore`, `firebase/firestore/lite` and `@firebase/firestore`. The compat SDK (`firebase/compat/firestore`, `firebase/compat/app`) writes through method calls such as `db.collection('x').doc('y').set(...)`, so banning named imports does not stop it. `@firebase/firestore/lite` is also not listed. `firebase` is now a hoisted root devDependency, so apps/web could import these without declaring a dependency. The deny-all rules still block any such write, so this only weakens the defence-in-depth layer. Fix: add `patterns: [{ group: ['firebase/compat/*', '@firebase/firestore-compat', '@firebase/firestore/lite'], ... }]` (or add the lite path with the same `importNames`). Alternatively, record this in the existing T012 follow-up note, next to the dynamic-import and wrapper-package gap.
- [P3] tooling/src/eslint-web-firestore-writes.test.ts:23 — `@firebase/firestore` is in the lint config, but no test covers it. If it is dropped from the config, nothing fails. Fix: add `'@firebase/firestore'` to `sources`.

## Hard rules
1. core vendor-free — ok (no `packages/core` change; core lint block unchanged)
2. ports + adapters + fakes — ok (no new external system at runtime; the rules-testing package is test tooling only)
3. no client Firestore writes — ok (rules stay deny-all and are tested against the real file; apps/web lint ban added; see the P3 compat nit)
4. tenant isolation — ok (no tenant-readable collection or read rule added; deny-all covers every path)
5. time from Clock — ok (fixtures use fixed ISO strings; no `Date.now()` / `new Date()` added)
6. roles server-side — ok (test 7 shows forged `platformAdmin` / `tenantId` / `role` claims open nothing)
7. entitlements not plan names — n/a (no billing or feature gating touched)
8. own IDs — ok (fixture identity doc has a ULID-shaped `userId` separate from the Firebase uid; fixtures only)
9. secrets — ok (`demo-noor` emulator project, no credentials, no `.env` touched, nothing secret logged)
10. AI output untrusted — n/a (no AI code)
11. religious content provenance — n/a (no question content)
