## T010a

**Own user and identity records: getOrCreateUser with a transaction**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T003](E00-foundation.md#t003) · Tags: `sec`
Skills: `port-adapter`, `firestore-data`, `vertical-slice`

**Goal.** Given an identity that has already been verified (`provider`, `subject`, `email`, `emailVerified`, optional `name`), core returns our own ULID `userId`. On the first call it creates exactly one `users` doc and one `identities` doc in a single transaction. No HTTP and no auth yet.

**Scope**

- Port `IdGenerator` (`packages/core/src/ports/id-generator.ts`): `newId(): string`, which returns a ULID. Adapter `apps/api/src/adapters/system/ulid-id-generator.ts` builds the ULID from the `Clock` plus `crypto.getRandomValues`, written by hand in about 20 lines with Crockford base32, so no new dependency. The testkit fake `FakeIdGenerator` returns deterministic, increasing ULIDs.
- Port `UserRepo` (`packages/core/src/ports/repos.ts`):
  - `getByIdentity(key): Promise<User | null>`
  - `createWithIdentity(user, identity): Promise<User>`. This is atomic. If the identity already exists, it creates nothing and returns the existing user.
  - `getById(userId): Promise<User | null>`
  
  `users` and `identities` are global, not tenant-owned, so they have no `tenantId`. Write that in the port JSDoc so reviewers know it is deliberate.
- Domain types in core: `VerifiedIdentity = { provider: 'firebase'; subject: string; email: string | null; emailVerified: boolean; name: string | null }` (defined here; T010b's `AuthVerifier` returns it), `UserId` (branded ULID string), `IdentityKey = { provider: 'firebase'; subject: string }`, `User = { id, displayName: string | null, createdAt, updatedAt, schemaVersion: 1 }`, `Identity = { id: '<provider>_<subject>', provider, subject, userId, email: string | null, emailVerified, createdAt, schemaVersion: 1 }`. `subject` must match `/^[A-Za-z0-9_-]{1,128}$/`. Anything else throws `DomainError('UNAUTHENTICATED')`, so a doc-id path can never be injected.
- Use case `packages/core/src/usecases/get-or-create-user.ts`: `getOrCreateUser(deps: { clock, ids, users }, input: VerifiedIdentity): Promise<User>`. On creation, `displayName` comes from `input.name`: NFC-normalised, trimmed, and truncated to 32 code points. If fewer than 2 characters remain, store `null`. Timestamps are UTC ISO strings from `Clock`.
- Testkit: `InMemoryUserRepo` (the check-and-create is atomic, so it holds under concurrent `Promise.all`). Shared contract `packages/testkit/src/contracts/user-repo.contract.ts` with `runUserRepoContract(makeImpl)`. Add both new fakes to `makeTestDeps()`, and `ids` + `users` to `Deps`.
- Firestore adapter `apps/api/src/adapters/firebase/user-repo.ts`. `createWithIdentity` runs in `runTransaction`: it reads `identities/{provider}_{subject}`, returns the linked user if the doc exists, and otherwise sets `users/{ulid}` and `identities/{id}`. A converter maps Firestore to domain, so no Firestore types leak out. Wire it in `composition.ts` with the `firebase-admin` Firestore.
- Contract test on the emulator: `apps/api/src/adapters/firebase/user-repo.contract.test.ts`. Extend `npm run test:emulator` so it also runs this file (the Firestore emulator is already started).
- `firebase/rules.test.ts`: replace the placeholder `users`/`identities` seeds with the real shapes. All client reads and writes stay denied.

**Acceptance criteria**

- [ ] First call creates exactly one user + identity; repeated and concurrent calls return the same `userId` (transaction test). The contract suite runs 10 concurrent `getOrCreateUser` calls for one identity and checks they return one `userId`, with 1 `users` doc and 1 `identities` doc. It runs against both `InMemoryUserRepo` and the Firestore emulator adapter.

Tags: sec
Phase: P1
