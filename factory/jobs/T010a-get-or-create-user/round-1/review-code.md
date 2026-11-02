VERDICT: PASS
# Code review — T010a round 1

Reviewed `git diff main...factory/T010a-get-or-create-user` (28 files) against spec.md and build.md. I re-ran `npm test` in the worktree: 32 files, 267 tests, all pass. I did not re-run `npm run test:emulator`, which needs the Firebase emulator. I read the emulator-only tests (20–23) and the Firestore adapter instead.

## Findings
No must-fix findings.

## Acceptance tests
1. ok — `packages/testkit/src/contracts/user-repo.contract.ts` "creates one user and one identity on the first call". It is run by `in-memory-user-repo.test.ts` and `apps/api/src/adapters/firebase/user-repo.contract.test.ts`.
2. ok — contract "returns the same user on a later call, even with a new name and time". It advances the FakeClock and changes the name.
3. ok — contract "10 concurrent calls … one userId, 1 user and 1 identity", using `Promise.all`. `InMemoryUserRepo.createWithIdentity` has no `await` between the check and the insert. The Firestore adapter uses `runTransaction` with `tx.create`.
4. ok — contract "gives two different subjects two different users", counts `{2,2}`.
5. ok — contract "createWithIdentity for an existing identity returns the linked user and writes nothing". It checks the counts and that `getById(ULID_B)` is null.
6. ok — contract "returns null for an unknown identity or user id".
7. ok — contract `it.each(INVALID_SUBJECTS)` covers all six subjects from the spec. It calls both `getByIdentity` and `createWithIdentity` and checks the counts are `{0,0}`.
8. ok — contract has two tests, one for a `userId` mismatch and one for an `id` mismatch. Both expect `VALIDATION` and `{0,0}`.
9. ok — `get-or-create-user.test.ts` "creates a user and identity with clock timestamps and schema version 1". It uses a fixed clock and an exact `toEqual` on both docs.
10. ok — "returns the stored user unchanged and mints no id when the identity exists". It asserts `newId` and `createWithIdentity` are not called.
11. ok — "returns the winner when createWithIdentity reports another user (lost race)". It uses `toBe(winner)`.
12. ok — `it.each` over an invalid subject and a non-firebase provider. It checks the error code and `details`, that the subject and email are absent from the serialised details, and that no repo or id call was made.
13. ok — `user.test.ts` "normaliseDisplayName". It covers trim, NFC, Arabic and Amharic, the 32 code-point cut, trim after the cut, the emoji boundary, null for `'A'`, `' '`, `''` and `null`, and control characters. The implementation follows spec steps 1–7 in order (`user.ts:79-84`).
14. ok — `user.test.ts` "identityId". It covers the happy path, all six invalid subjects with `UNAUTHENTICATED`, and a bad provider.
15. ok — `user.test.ts` "isUlid / asUserId". It covers lowercase, I, L, O, U, 25 and 27 characters, and a first character of `8`. `asUserId` throws `VALIDATION`.
16. ok — `fake-id-generator.test.ts`. It covers valid and strictly increasing ids, the prefix plus counter 1, and identical sequences from two fresh instances.
17. ok — `ulid-id-generator.test.ts`. It covers time 0 with zero bytes, max time with `0xFF` giving `7ZZZ…`, time decode, ordering, 1 000 unique ids with the real random source, and `RangeError` for -1, 2^48 and 1.5. I checked the bit-packing loop (`ulid-id-generator.ts:30-42`): 80 bits give 16 characters, and the time part gives a leading `7` at max.
18. ok — `make-test-deps.test.ts` is extended. It checks types, fresh instances and overrides.
19. ok — `in-memory-user-repo.test.ts` "returns copies…". It mutates results from create, `getById` and `getByIdentity`.
20. ok — `user-repo.contract.test.ts` "stores exactly the documented doc shapes…". It reads the raw admin SDK docs with `toStrictEqual`.
21. ok — "rejects an identity that links to a missing user with INTERNAL and writes no user". It covers `getByIdentity` and `createWithIdentity`, and checks the counts are `{0,1}`.
22. ok — `it.each` for `schemaVersion: 2` and a missing `createdAt`, both giving `INTERNAL` via the zod strict converter.
23. ok — `requireEmulator` runs first in `beforeAll`, before any client is built, plus a unit test of the guard.
24. ok — `composition.test.ts` asserts `UlidIdGenerator` and `FirestoreUserRepo` instances.
25. ok — the counting mock of `./adapters/firebase/firestore` stays at 0 and `getApps()` is unchanged when config is invalid.
26. ok — a second `createComposition` does not throw and `getApps()` has length 1.
27. ok — `firebase/rules.test.ts` seeds use a ULID user and `identities/firebase_uid-alice` with the spec fields. The batch and "really denied" tests target the ULID doc. `firestore.rules` is untouched.

## Hard rules
1. ok — core imports only `../errors` and its own modules. Crypto and Firestore live in `apps/api/src/adapters`.
2. ok — `firestore.rules` is untouched and stays deny-all. The only Firestore writes are server-side, in `FirestoreUserRepo`.
3. ok — no client write path was added. The rules tests prove the denials with the real doc shapes.
4. ok — `users` and `identities` are global by design, and the `UserRepo` JSDoc says so. No tenant-owned data is touched.
5. ok — no `Date.now()` in the new code. `UlidIdGenerator` reads the injected `Clock`. The only `Date.now()` in `apps/api` is still `SystemClock`. The `new Date()` in `instant.ts` is pre-existing.
6. ok — no plan-name checks in this diff.
7. ok — no client-trusted roles, scores or dates.
8. ok — `userId` is our ULID from `IdGenerator`. The Firebase uid is only `Identity.subject` and part of the identity doc id.
9. ok — no secrets or logging. `DomainError.details` carries only a `reason`, and a test proves the subject and email are absent.
10. ok — no AI in this slice.
11. ok — no content scheduling in this slice.

## Scope
- Files match the spec's "files to touch" list. The only differences are the root `vitest.emulator.config.ts` setting `fileParallelism: false` (spec-compatible, and explained in build.md) and `InMemoryUserRepo` using object spread instead of `structuredClone` (explained in build.md; the docs are flat and test 19 covers it).
- `docs/tasks/BOARD.md` is not touched. build.md says the orchestrator will set it to `done`.

## Dependencies
No new packages. `zod` and `firebase-admin` were already in `apps/api/package.json`, and the ULID is hand-written.

## Nits (non-blocking)
- `apps/api/src/adapters/firebase/user-repo.ts:134-136` — the catch path calls `this.getByIdentity(identity)`. If that read throws a non-`DomainError` (for example a network error), the raw SDK error leaks instead of an `INTERNAL`. It could be wrapped, but the spec only asks for a single fallback read.
- `user-repo.ts` fallback — if every retried transaction aborts before the winner commits, the fallback read can return null and throw `INTERNAL create-user-failed`. This is the behaviour the spec prescribes, and build.md reports 3 stable emulator runs. Watch for flakes in CI.
- `user-repo.ts:41-51` — `IdentityDoc.id` and `IdentityDoc.subject` are plain `z.string()`. They could be checked against `SUBJECT_PATTERN` and `identityId` to catch a corrupt identity doc.
- `user.test.ts` emoji test puts the emoji at position 32 (code points 1–31 are `a`, the emoji is the 32nd). That is the spec boundary, but a case with the emoji straddling the cut (a surrogate pair at units 31/32) would be stronger. `Array.from` makes the code safe either way.
