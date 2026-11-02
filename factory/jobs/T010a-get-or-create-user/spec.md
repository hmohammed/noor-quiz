# Spec — T010a Own user and identity records: getOrCreateUser with a transaction

Size check: no SPLIT. T010 was already split; this slice has no HTTP route and no UI. It adds two ports, but `IdGenerator` is one method with a ~20-line adapter and exists only so `UserRepo` can mint our own IDs (AGENT.md rule 8). It fits in about a day.

## Acceptance tests

Task criterion: "First call creates exactly one user + identity. Repeated and concurrent calls return the same `userId`. The contract suite runs 10 concurrent `getOrCreateUser` calls for one identity, checks there is one `userId`, 1 `users` doc and 1 `identities` doc, and runs against both `InMemoryUserRepo` and the Firestore emulator adapter." Tests 1–4 cover it directly. The rest cover the scope bullets.

**Shared `UserRepo` contract** (`packages/testkit/src/contracts/user-repo.contract.ts`). It runs in two places: the in-memory run in `packages/testkit/src/in-memory-user-repo.test.ts`, and the emulator run in `apps/api/src/adapters/firebase/user-repo.contract.test.ts`.

1. Calling `getOrCreateUser` once for a new identity returns a `User` whose `id` is a valid ULID. Afterwards `counts()` is `{ users: 1, identities: 1 }`, `getById(user.id)` deep-equals the returned user, and `getByIdentity(key)` deep-equals it too. — adapter (contract) — both files above
2. Calling it a second time for the same identity (even after the FakeClock has moved and with a different `name`) returns the same `id`, `displayName` and `createdAt`, and the counts stay `{ 1, 1 }`. — adapter (contract)
3. **Concurrency.** 10 `getOrCreateUser` calls for one identity under `Promise.all` all resolve, all with the same `userId`, and the counts are `{ users: 1, identities: 1 }`. — adapter (contract)
4. Two different subjects give two different `userId`s, and the counts are `{ 2, 2 }`. — adapter (contract)
5. Calling `createWithIdentity(userB, identity)` directly for an identity that already links to user A returns user A and writes nothing: the counts are unchanged and `getById(userB.id)` is `null`. — adapter (contract)
6. `getByIdentity` returns `null` for an unknown subject, and `getById` returns `null` for an unknown ULID. — adapter (contract)
7. `getByIdentity` / `createWithIdentity` with an invalid subject (`''`, `'a/b'`, `'..'`, `'a b'`, 129 chars, `'ü'`) reject with `DomainError('UNAUTHENTICATED')`, and the counts stay `{ 0, 0 }`. — adapter (contract)
8. `createWithIdentity` rejects with `DomainError('VALIDATION')` and writes nothing when `identity.userId !== user.id` or when `identity.id !== identityId(identity)`. — adapter (contract)

**Core** (`packages/core/src/usecases/get-or-create-user.test.ts`, plus `packages/core/src/users/user.test.ts` for tests 13–15). Core cannot import testkit because that would be a workspace cycle, so these tests use small inline stubs: a fixed `Clock` object, a sequence `IdGenerator`, and a Map-based `UserRepo`.

9. On creation, `createdAt === updatedAt === toIso(clock.now())`, `schemaVersion === 1`, and the identity gets `email`, `emailVerified`, `provider`, `subject`, `userId = user.id`, and `id = 'firebase_<subject>'`. — core
10. If the identity already exists, the use case does not call `ids.newId()` and does not call `createWithIdentity`, and it returns the stored user unchanged. Email and name changes are not synced. — core
11. If `createWithIdentity` returns a different user than the one built (the use case lost a race), that returned user is what the use case returns. — core
12. An invalid subject throws `UNAUTHENTICATED` before any repo or id call. A `provider` other than `'firebase'` at runtime also throws `UNAUTHENTICATED`. The thrown error's `details` never contains the subject or the email. — core
13. `normaliseDisplayName` cases. — core
    - `'  Alice  '` gives `'Alice'`.
    - A decomposed `'e\u0301'` + `'mma'` gives NFC `'émma'`.
    - `'عبد الله'` and `'ዮሐንስ'` are kept as-is.
    - 40 Arabic letters are cut to 32 code points.
    - 31 letters followed by a space and then 5 letters are cut and trimmed again, leaving 31 code points with no trailing space.
    - An emoji at the 32/33 boundary is never split into a lone surrogate.
    - `'A'`, `' '`, `''` and `null` give `null`.
    - A name with control characters (`'Al\u0000i\u0007ce'`) has them removed and gives `'Alice'`.
14. `identityId({ provider: 'firebase', subject: 'abc_-1' })` gives `'firebase_abc_-1'`. Every invalid subject from test 7 throws `UNAUTHENTICATED`. — core
15. `isUlid` / `asUserId`: they accept `'01ARZ3NDEKTSV4RRFFQ69G5FAV'` and reject lowercase, the letters I, L, O and U, 25 or 27 characters, and a first character above `7`. `asUserId` throws `VALIDATION` on a bad value. — core

**IdGenerator**

16. `FakeIdGenerator`: each `newId()` is a valid ULID and strictly greater (lexicographically) than the previous one. Two fresh instances produce the same sequence. — core (testkit) — `packages/testkit/src/fake-id-generator.test.ts`
17. `UlidIdGenerator`: — adapter (unit) — `apps/api/src/adapters/system/ulid-id-generator.test.ts`
    - It takes a `Clock` and an injectable `fillRandom(bytes: Uint8Array)` that defaults to `crypto.getRandomValues`.
    - Clock at 0 with all-zero bytes gives `'00000000000000000000000000'`.
    - Clock at `2**48 - 1` with all-`0xFF` bytes gives `'7ZZZZZZZZZZZZZZZZZZZZZZZZZ'`.
    - The first 10 characters decode back to the clock's milliseconds.
    - An id made at a later clock time sorts after one made earlier.
    - With the real random source, 1 000 ids are all valid and all unique.
    - A clock time below 0 or above `2**48 - 1` throws.

**Testkit and Deps wiring**

18. `makeTestDeps()` returns a `FakeIdGenerator` as `ids` and an `InMemoryUserRepo` as `users`, and fresh instances on each call. Overrides are respected, and the result is still assignable to `Deps`. — core (testkit) — `packages/testkit/src/make-test-deps.test.ts` (extend)
19. `InMemoryUserRepo` returns copies: changing a returned `User` does not change the stored one. — core (testkit) — `packages/testkit/src/in-memory-user-repo.test.ts`

**Firestore adapter only** (`apps/api/src/adapters/firebase/user-repo.contract.test.ts`, emulator, after the shared contract)

20. Stored docs have exactly the shapes in "Contracts and data shapes": `users/{ulid}` and `identities/firebase_<subject>`, ISO-string timestamps (no Firestore `Timestamp`), and no extra fields. Read them back with the raw admin SDK to check. — adapter
21. If an identity doc points to a missing user doc, `getByIdentity` and `createWithIdentity` reject with `DomainError('INTERNAL')` and write no new user. — adapter
22. If a `users` doc has the wrong shape (for example `schemaVersion: 2` or a missing `createdAt`), the converter makes `getById` reject with `DomainError('INTERNAL')`. — adapter
23. If `FIRESTORE_EMULATOR_HOST` is not set, the test file fails in `beforeAll` before it builds a Firestore client. It never touches a real project. — adapter

**Composition**

24. With a valid env, `createComposition` wires `deps.ids` as a `UlidIdGenerator` and `deps.users` as a `FirestoreUserRepo`. It does no network I/O. — api — `apps/api/src/composition.test.ts` (extend)
25. With an invalid config, no Firestore client and no admin app are created. Check this with a counting mock of `./adapters/firebase/firestore`, the same way as the existing SystemClock counter. — api — `apps/api/src/composition.test.ts`
26. Calling `createComposition` twice in one process does not throw: the admin app is reused, not initialised twice. — api — `apps/api/src/composition.test.ts`

**Rules**

27. `firebase/rules.test.ts` seeds use the real shapes: `users/{ULID}` and `identities/firebase_uid-alice` with the fields from this spec. All existing deny tests still pass for every client: no get, list, create, overwrite, update, delete, batch or transaction. The batched-write and "writes really were denied" tests target the ULID user doc. — rules — `firebase/rules.test.ts`

No new route, so there are no unauthorised or wrong-tenant route tests in this slice (T010b adds `requireUser`).

## Files and modules to touch

- `packages/core/src/users/user.ts` (+ `user.test.ts`): new. Domain types and pure helpers:
  - the types `UserId`, `User`, `Identity`, `IdentityKey`, `VerifiedIdentity`
  - `ULID_PATTERN`, `isUlid`, `asUserId`
  - `SUBJECT_PATTERN` and `identityId(key)`, which validates and throws `UNAUTHENTICATED`
  - `normaliseDisplayName(name)`
  - `USER_SCHEMA_VERSION = 1`
- `packages/core/src/ports/id-generator.ts`: new. `IdGenerator { newId(): string }` (JSDoc says it returns a ULID).
- `packages/core/src/ports/repos.ts`: new. `UserRepo`, with JSDoc covering:
  - the doc shapes
  - atomicity
  - "users and identities are global, not tenant-owned, so they have no `tenantId` (deliberate, AGENT.md rule 4 does not apply)"
- `packages/core/src/usecases/get-or-create-user.ts` (+ `.test.ts`): new. The use case.
- `packages/core/src/deps.ts`: add `ids: IdGenerator; users: UserRepo`.
- `packages/core/src/index.ts`: export the new types, helpers and use case (types with `export type *`, values with `export *`).
- `packages/testkit/src/fake-id-generator.ts` (+ `.test.ts`): new.
- `packages/testkit/src/in-memory-user-repo.ts` (+ `.test.ts`, which runs the shared contract plus the copy test). It also exposes `counts()` for the contract harness.
- `packages/testkit/src/contracts/user-repo.contract.ts`: new. `runUserRepoContract(makeImpl)`.
- `packages/testkit/src/make-test-deps.ts` (+ extend the test): add `ids` and `users`. `TestDeps` narrows them to `FakeIdGenerator` and `InMemoryUserRepo`.
- `packages/testkit/src/index.ts`: export the new fakes and the contract.
- `apps/api/src/adapters/system/ulid-id-generator.ts` (+ `.test.ts`): new. A hand-written Crockford base32 ULID with no new dependency.
- `apps/api/src/adapters/firebase/firestore.ts`: new. `getAdminFirestore()` returns `getFirestore(getApps()[0] ?? initializeApp())`. It is the only place that initialises the admin app, it is idempotent, and it does no I/O.
- `apps/api/src/adapters/firebase/user-repo.ts`: new. `FirestoreUserRepo` with zod-validated converters.
- `apps/api/src/adapters/firebase/user-repo.contract.test.ts`: new. Emulator run of the contract plus tests 20–23.
- `apps/api/src/composition.ts` (+ extend the test): wire `ids: new UlidIdGenerator(clock)` and `users: new FirestoreUserRepo(getAdminFirestore())`. The order stays: config first, then adapters.
- `apps/api/vitest.config.ts`: add `exclude: ['src/**/*.contract.test.ts', ...defaults]` so `npm test` stays emulator-free.
- `apps/api/vitest.emulator.config.ts`: new. Project `api-emulator`, include `src/**/*.contract.test.ts`, with the same timeouts as `firebase/vitest.config.ts` and `fileParallelism: false`.
- `vitest.emulator.config.ts` (repo root): new. `projects: ['firebase/vitest.config.ts', 'apps/api/vitest.emulator.config.ts']`.
- `package.json` (root): change `test:emulator` to run `vitest run --config vitest.emulator.config.ts` inside the same `firebase emulators:exec --only firestore ...` wrapper. No new script name, so the docs-commands test stays green.
- `firebase/rules.test.ts`: real seed shapes, and remove the "Fixtures only" comment.
- `docs/tasks/BOARD.md`: set the row to `done` in the PR, which the builder does per the Definition of Done.

Do not touch: `firebase/firestore.rules` (it stays deny-all), `firebase/firestore.indexes.json` (only doc-id lookups, so no composite index), `packages/contracts` (no HTTP in this slice), and `.env.example` (no new config, because the admin SDK reads `FIRESTORE_EMULATOR_HOST` and the project from the runtime).

## Contracts and data shapes

### Core types (`packages/core/src/users/user.ts`)

```ts
export type UserId = string & { readonly __brand: 'UserId' };
export const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const USER_SCHEMA_VERSION = 1 as const;

export type IdentityProvider = 'firebase';
export interface VerifiedIdentity {
  provider: IdentityProvider; subject: string;
  email: string | null; emailVerified: boolean; name: string | null;
}
export interface IdentityKey { provider: IdentityProvider; subject: string }
export interface User {
  id: UserId; displayName: string | null;
  createdAt: string; updatedAt: string;      // UTC ISO from Clock via toIso()
  schemaVersion: typeof USER_SCHEMA_VERSION;
}
export interface Identity {
  id: string;                                // `${provider}_${subject}`
  provider: IdentityProvider; subject: string; userId: UserId;
  email: string | null; emailVerified: boolean;
  createdAt: string; schemaVersion: typeof USER_SCHEMA_VERSION;
}

export function isUlid(s: unknown): s is UserId;
export function asUserId(s: string): UserId;            // DomainError('VALIDATION') if not a ULID
export function identityId(key: IdentityKey): string;   // DomainError('UNAUTHENTICATED', { reason: 'invalid-subject' | 'invalid-provider' })
export function normaliseDisplayName(name: string | null): string | null;
```

`normaliseDisplayName` steps:

1. `null` gives `null`.
2. Apply `.normalize('NFC')`.
3. Remove `\p{Cc}` control characters.
4. Trim.
5. Keep the first 32 code points (`Array.from`, never `.slice` on UTF-16 units).
6. Trim the end again.
7. If fewer than 2 code points remain, return `null`.

### Ports

```ts
// packages/core/src/ports/id-generator.ts
export interface IdGenerator { /** A new ULID (26 chars, Crockford base32). */ newId(): string }

// packages/core/src/ports/repos.ts
/** Global (not tenant-owned) collections `users` and `identities`: no tenantId, by design. */
export interface UserRepo {
  getByIdentity(key: IdentityKey): Promise<User | null>;
  /** Atomic. If identities/{identity.id} exists: write nothing, return its linked user. */
  createWithIdentity(user: User, identity: Identity): Promise<User>;
  getById(userId: UserId): Promise<User | null>;
}
```

Every implementation calls `identityId(key)` first, so a bad subject never reaches a doc path, even if a future caller skips the use case.

### Use case

```ts
export async function getOrCreateUser(
  deps: { clock: Clock; ids: IdGenerator; users: UserRepo },
  input: VerifiedIdentity,
): Promise<User>
```

Flow:

1. `const id = identityId(input)`. This validates the identity first.
2. `await users.getByIdentity(key)`. If it finds a user, return it.
3. Otherwise:
   - `now = toIso(clock.now())`
   - `userId = asUserId(ids.newId())`
   - build `User` (with `normaliseDisplayName(input.name)`) and `Identity`
4. `return users.createWithIdentity(user, identity)`. If another call won the race, this returns the existing user.

### Firestore docs (no `tenantId`, global collections)

```
users/{userId}                       // doc id = ULID
  { id: UserId, displayName: string|null, createdAt: ISO, updatedAt: ISO, schemaVersion: 1 }

identities/{provider}_{subject}      // e.g. identities/firebase_Xy9...; deterministic id = uniqueness
  { id, provider: 'firebase', subject, userId: UserId, email: string|null,
    emailVerified: boolean, createdAt: ISO, schemaVersion: 1 }
```

### Firestore adapter

The converters are `FirestoreDataConverter`s that live inside the adapter. Their `fromFirestore` parses with zod strict objects:

- `users`: `id` must match ULID, `schemaVersion` is the literal 1, and ISO strings are checked with `instantFromIso` refinement.
- `identities`: the same idea for the identity fields.

Shape failure throws `DomainError('INTERNAL', { reason: 'corrupt-user-doc' | 'corrupt-identity-doc' })`, with no field values in `details`.

`createWithIdentity` works like this:

1. Validate: check `identityId(identity) === identity.id` and `identity.userId === user.id`. If either fails, throw `VALIDATION`.
2. Run `db.runTransaction(async tx => ...)`:
   - `tx.get(identityRef)`.
   - If it exists: `tx.get(usersRef(existing.userId))`. If that user is missing, throw `INTERNAL` (`identity-without-user`). Otherwise return that user.
   - Otherwise: `tx.create(userRef, user)` and `tx.create(identityRef, identity)`, then return `user`. Use `create`, not `set`, so a ULID collision can never overwrite an existing user.
3. If the transaction rejects (contention exhausted retries, or `ALREADY_EXISTS`), do one `getByIdentity(key)`. Return it if found. Otherwise rethrow as `DomainError('INTERNAL')`. This keeps test 3 deterministic on the emulator.

`getByIdentity` reads the identity doc, then the user doc. A dangling link throws `INTERNAL`.

No Firestore type appears in any exported signature.

### FakeIdGenerator

`newId()` returns a fixed 10-char time prefix (from a constant epoch, e.g. `2026-01-01T00:00:00Z`) followed by a 16-char Crockford counter, zero-padded and starting at 1. Ids are deterministic and strictly increasing.

### InMemoryUserRepo

- It stores data in `Map`s keyed by user id and identity id.
- `createWithIdentity` does its check-and-insert synchronously, with no `await` between the check and the insert, so it is atomic under `Promise.all`.
- It returns `structuredClone` copies.
- It has a `counts()` helper.

### Contract harness

```ts
export interface UserRepoHarness {
  repo: UserRepo;
  counts(): Promise<{ users: number; identities: number }>;
}
export function runUserRepoContract(name: string, makeImpl: () => Promise<UserRepoHarness>): void
```

Every test gets a fresh harness. The emulator `makeImpl` clears `users` and `identities` with `db.recursiveDelete` first. The suite builds the use case with `new FakeClock()` and `new FakeIdGenerator()` from testkit.

### Error codes → HTTP status

No new codes. The existing mapping in `apps/api/src/errors.ts` applies when T010b exposes them: `UNAUTHENTICATED` → 401, `VALIDATION` → 400, `INTERNAL` → 500.

## Hard rules that apply here

- **Rule 1 (core has no vendors).**
  - Core gets only types, regexes, `String.prototype.normalize` and `toIso`.
  - ULID building, which needs `crypto`, and everything Firestore-related live in `apps/api/src/adapters/*`.
  - Core's `tsconfig` has `types: []`, so a stray `crypto` or `firebase` use fails typecheck as well as lint.
- **Rule 2 (port + adapter + fake).** `IdGenerator` has `UlidIdGenerator` + `FakeIdGenerator`. `UserRepo` has `FirestoreUserRepo` + `InMemoryUserRepo`, and both pass the shared contract. Only `composition.ts` picks the adapters.
- **Rule 3 (browser never writes).** `firestore.rules` stays deny-all. The rules tests now prove that with real `users`/`identities` shapes.
- **Rule 4 (tenant isolation).** `users` and `identities` are platform-global by design, and the `UserRepo` JSDoc says so explicitly so reviewers do not flag a missing `tenantId`. No tenant-owned data is touched.
- **Rule 5 (Clock).**
  - Timestamps come from `deps.clock` through `toIso`.
  - `UlidIdGenerator` takes its time from the injected `Clock`, never from `Date.now()`.
  - There is no `new Date()` in core or the use case.
- **Rule 8 (own IDs).** `userId` is our ULID. The Firebase uid appears only as `Identity.subject` and in the identity doc id, never as a primary key of `users`.
- **Rule 9 / PII.** No logging of `subject`, `email` or names. `DomainError.details` carries only a `reason`. The emulator test refuses to run without `FIRESTORE_EMULATOR_HOST`, so it never touches a real project.
- **Path injection (`sec` tag).**
  - `SUBJECT_PATTERN` is enforced in core (`identityId`) and again in both repo implementations before any doc path is built.
  - `userId` is ULID-checked with `asUserId` before `users/{id}` is used.
  - Docs are created with `create` inside a transaction, so nothing is overwritten.
- **Dependencies.** None added: the ULID is hand-written, and `firebase-admin` is already a dependency of `apps/api`.

## Out of scope

- `AuthVerifier`, token parsing, `requireUser` middleware, `GET /v1/me`, `MeResponse` contract, Auth emulator (T010b).
- Any web UI, sign-in button or i18n strings (T010c).
- Updating `email`, `emailVerified` or `displayName` on later sign-ins, or any profile editing (T011). Repeat calls return the stored user unchanged.
- Locale, timezone, consent, or account deletion fields on `User` (T011/T013).
- Linking several providers to one user, merging accounts, or providers other than `'firebase'`.
- Custom claims (`noorUserId`) or the platform-admin flag.
- Any `allow` rule in `firestore.rules`, and any composite index.
- A monotonic-within-the-same-millisecond ULID factory. Plain time + random is enough here.
- A migration script (these are new collections, `schemaVersion: 1`).
- An ADR. No new vendor or architectural choice: firebase-admin and Firestore are already decided.
