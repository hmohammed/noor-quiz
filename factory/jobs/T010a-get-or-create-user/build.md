# Build — T010a (round 1)
Branch: factory/T010a-get-or-create-user
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T010a-get-or-create-user

## Changes
- packages/core/src/users/user.ts — domain types (`UserId`, `User`, `Identity`, `IdentityKey`, `VerifiedIdentity`), `ULID_PATTERN`, `isUlid`, `asUserId`, `SUBJECT_PATTERN`, `identityId` (UNAUTHENTICATED with `reason` only), `normaliseDisplayName`, `USER_SCHEMA_VERSION`.
- packages/core/src/ports/id-generator.ts — `IdGenerator` port.
- packages/core/src/ports/repos.ts — `UserRepo` port; JSDoc documents doc shapes, atomicity and that users/identities are global (no `tenantId`, rule 4 deliberately not applicable).
- packages/core/src/usecases/get-or-create-user.ts — the use case: validate identity → lookup → mint ULID + build docs from Clock → `createWithIdentity` (returns race winner).
- packages/core/src/deps.ts, index.ts — `ids` + `users` on `Deps`; exports.
- packages/testkit/src/fake-id-generator.ts — deterministic increasing ULIDs (2026-01-01 prefix + 16-char counter).
- packages/testkit/src/in-memory-user-repo.ts — synchronous check-and-insert (atomic under `Promise.all`), returns copies, `counts()`.
- packages/testkit/src/contracts/user-repo.contract.ts — `runUserRepoContract(name, makeImpl)` (spec tests 1–8).
- packages/testkit/src/make-test-deps.ts — adds `ids`/`users`; `TestDeps` narrows to the fakes.
- apps/api/src/adapters/system/ulid-id-generator.ts — hand-written ULID from injected `Clock` + injectable `fillRandom` (defaults to `crypto.getRandomValues`); RangeError outside [0, 2^48-1].
- apps/api/src/adapters/firebase/firestore.ts — `getAdminFirestore()`: the only admin-app init, idempotent, no I/O.
- apps/api/src/adapters/firebase/user-repo.ts — `FirestoreUserRepo`: zod strict converters (INTERNAL `corrupt-user-doc` / `corrupt-identity-doc`), `runTransaction` with `tx.create` for both docs, dangling link → INTERNAL `identity-without-user`, post-failure `getByIdentity` fallback.
- apps/api/src/adapters/firebase/user-repo.contract.test.ts — shared contract on the emulator + tests 20–23.
- apps/api/src/composition.ts — wires `UlidIdGenerator(clock)` and `FirestoreUserRepo(getAdminFirestore())` after config validation.
- apps/api/vitest.config.ts — excludes `*.contract.test.ts` so `npm test` stays emulator-free.
- apps/api/vitest.emulator.config.ts, vitest.emulator.config.ts (root) — `api-emulator` project + root config running rules and api-emulator projects, `fileParallelism: false` (both share the `demo-noor` emulator data; the rules suite calls `clearFirestore`).
- package.json — `test:emulator` now runs `vitest run --config vitest.emulator.config.ts` in the same `emulators:exec` wrapper (script name unchanged).
- firebase/rules.test.ts — seeds use the real shapes (`users/01JAAA…`, `identities/firebase_uid-alice`); batch and "really denied" tests target the ULID user doc; "Fixtures only" comment removed.

## Acceptance tests → test files
1. First call creates 1 user + 1 identity, getById/getByIdentity equal → packages/testkit/src/contracts/user-repo.contract.ts "creates one user and one identity on the first call" (run by packages/testkit/src/in-memory-user-repo.test.ts and apps/api/src/adapters/firebase/user-repo.contract.test.ts)
2. Second call later with new name returns same user → contract "returns the same user on a later call, even with a new name and time"
3. 10 concurrent calls → one userId, {1,1} → contract "10 concurrent calls for one identity give one userId, 1 user and 1 identity"
4. Two subjects → two users {2,2} → contract "gives two different subjects two different users"
5. createWithIdentity on existing identity returns A, writes nothing → contract "createWithIdentity for an existing identity returns the linked user and writes nothing"
6. Unknown subject / ULID → null → contract "returns null for an unknown identity or user id"
7. Invalid subjects → UNAUTHENTICATED, {0,0} → contract "rejects subject %j with UNAUTHENTICATED and writes nothing"
8. Mismatched userId / id → VALIDATION → contract "rejects an identity whose userId does not match the user", "rejects an identity whose id does not match provider and subject"
9. Creation timestamps, schemaVersion, identity fields → packages/core/src/usecases/get-or-create-user.test.ts "creates a user and identity with clock timestamps and schema version 1"
10. Existing identity: no newId, no create, unchanged → get-or-create-user.test.ts "returns the stored user unchanged and mints no id when the identity exists"
11. Lost race returns winner → get-or-create-user.test.ts "returns the winner when createWithIdentity reports another user (lost race)"
12. Invalid subject / provider → UNAUTHENTICATED before repo/id calls, no PII in details → get-or-create-user.test.ts "throws UNAUTHENTICATED for %s before any repo or id call"
13. normaliseDisplayName cases → packages/core/src/users/user.test.ts describe "normaliseDisplayName"
14. identityId → user.test.ts describe "identityId"
15. isUlid / asUserId → user.test.ts describe "isUlid / asUserId"
16. FakeIdGenerator → packages/testkit/src/fake-id-generator.test.ts
17. UlidIdGenerator → apps/api/src/adapters/system/ulid-id-generator.test.ts
18. makeTestDeps → packages/testkit/src/make-test-deps.test.ts
19. InMemoryUserRepo returns copies → packages/testkit/src/in-memory-user-repo.test.ts "returns copies…"
20. Exact stored shapes → user-repo.contract.test.ts "stores exactly the documented doc shapes with ISO string timestamps" (raw admin SDK, `toStrictEqual`)
21. Dangling identity → INTERNAL, no user written → user-repo.contract.test.ts "rejects an identity that links to a missing user with INTERNAL and writes no user"
22. Corrupt users doc → INTERNAL → user-repo.contract.test.ts "rejects a users doc with %s as INTERNAL"
23. No FIRESTORE_EMULATOR_HOST → fails in beforeAll before building a client → user-repo.contract.test.ts `requireEmulator` in `beforeAll` + "refuses to run without FIRESTORE_EMULATOR_HOST"
24. Composition wires UlidIdGenerator + FirestoreUserRepo → apps/api/src/composition.test.ts "wires the system adapters, Firestore repo and typed config with a valid env"
25. Invalid config: no Firestore / admin app → composition.test.ts "throws ConfigError before building any deps" (counting mock of `./adapters/firebase/firestore` + `getApps()` unchanged)
26. Twice in one process → composition.test.ts "reuses the admin app when called twice in one process"
27. Rules seeds use real shapes, all denials hold → firebase/rules.test.ts (67 tests)

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass (see note on line endings) |
| npm run typecheck | pass |
| npm test | pass — 32 files, 267 tests |
| npm run test:emulator | pass — 86 tests (rules 67, api-emulator 19); ran 3 times, concurrency test stable (~3.6 s) |
| npm run test:e2e | not relevant (no UI) |

## Commits
- 9b45e59 T010a: core user domain, IdGenerator/UserRepo ports and getOrCreateUser
- 603d971 T010a: testkit FakeIdGenerator, InMemoryUserRepo and shared UserRepo contract
- 8e36675 T010a: prettier formatting for core and testkit
- 7314ac4 T010a: UlidIdGenerator adapter (hand-written Crockford ULID from Clock)
- 998a6f7 T010a: FirestoreUserRepo with transactional createWithIdentity and emulator contract test
- 4909f4e T010a: wire UlidIdGenerator and FirestoreUserRepo in composition
- 59737d8 T010a: rules tests seed real users and identities shapes

## Notes for reviewers
- No new dependency. ULID is hand-written; `firebase-admin` and `zod` were already in apps/api.
- BOARD.md row not touched: builder instructions forbid editing `docs/tasks/BOARD.md`; the orchestrator should set it to `done` in the PR as the spec's Definition of Done expects.
- `InMemoryUserRepo` copies with object spread rather than `structuredClone` (spec wording): testkit compiles with `types: []` / ES2023 lib where `structuredClone` is not declared, and the docs are flat so a shallow copy is a full copy. Test 19 covers it.
- `InMemoryUserRepo.createWithIdentity` also throws `INTERNAL` (`user-id-collision`) if the user id already exists, mirroring Firestore's `tx.create` behaviour.
- Validation order in both repos' `createWithIdentity`: `identityId(identity)` first (UNAUTHENTICATED for a bad subject/provider, before any path is built), then `asUserId(user.id)` and the id/userId match (VALIDATION).
- `FirestoreUserRepo`'s constructor takes a `Firestore`; no Firestore type appears in any `UserRepo` method signature. Composition is the only caller.
- The emulator contract test creates its own named admin app (`initializeApp({ projectId: 'demo-noor' }, 'user-repo-contract')`) instead of `getAdminFirestore()`, so it never depends on ambient project env, and deletes it in `afterAll`.
- Root `vitest.emulator.config.ts` sets `fileParallelism: false` globally: the rules suite's `clearFirestore()` would otherwise wipe the api-emulator data mid-run (same `demo-noor` project).
- Local Windows note: this checkout has `core.autocrlf=true`, which checks files out as CRLF; `prettier --check` and `tooling/src/docs-commands.test.ts` then fail on untouched files. The repo stores LF. I re-checked out this worktree's working copy with `-c core.autocrlf=false` (no config change) and all checks pass; CI on Linux is unaffected.
