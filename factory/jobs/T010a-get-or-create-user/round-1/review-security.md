VERDICT: PASS
# Security review — T010a round 1

Scope: `git diff main...factory/T010a-get-or-create-user` (28 files). No route, no rules change, no UI.

## Findings
None at P0–P2.

Verified:
- **Path injection:** `identityId()` enforces `provider === 'firebase'` and `SUBJECT_PATTERN` (`^[A-Za-z0-9_-]{1,128}$`) before any doc path is built, in core (`packages/core/src/users/user.ts:159`) and again in both repos (`apps/api/src/adapters/firebase/user-repo.ts:326,334`, `packages/testkit/src/in-memory-user-repo.ts:1501,1506`). `/`, `..`, spaces and non-ASCII are rejected; `firebase_` prefix means a subject can never form a reserved `__x__` id. User ids go through `asUserId` (ULID regex) before `users/{id}` (`user-repo.ts:328,345,363`).
- **No overwrite / takeover:** `createWithIdentity` uses `runTransaction` + `tx.create` for both docs (`user-repo.ts:341-352`), so a ULID collision or race cannot overwrite an existing user or re-point an identity. Existing identity → returns the linked user, writes nothing. Mismatched `identity.id` / `identity.userId` → `VALIDATION` before any I/O.
- **Error swallowing:** the catch rethrows `DomainError`s unchanged and only falls back to a read for SDK errors; an unresolved failure becomes `INTERNAL('create-user-failed')` with no raw SDK message.
- **PII:** every `DomainError.details` carries only a `reason`; converters never echo field values (`user-repo.ts:293-309`). No logging added. Test 12 asserts subject/email are absent from details.
- **Untrusted stored data:** zod `strictObject` converters with ULID, ISO and `schemaVersion: 1` checks; dangling identity → `INTERNAL`.
- **Firestore rules:** `firebase/firestore.rules` untouched (deny-all). `rules.test.ts` now seeds real `users/{ULID}` and `identities/firebase_uid-alice` shapes; batch and "really denied" tests target the ULID doc.
- **Emulator safety:** the contract test refuses to run without `FIRESTORE_EMULATOR_HOST` in `beforeAll` and uses its own named `demo-noor` app; `test:emulator` still wraps in `firebase emulators:exec --project demo-noor`. `npm test` excludes `*.contract.test.ts`.
- **Composition:** config is validated before `getAdminFirestore()` is called (test 25 proves no admin app on bad config); `getAdminFirestore` is idempotent and does no I/O.
- **ID randomness:** `UlidIdGenerator` uses `crypto.getRandomValues` for 80 random bits, time from the injected `Clock`; no `Date.now()`.
- **Tenant data:** `users` / `identities` are global by design and documented as such on the `UserRepo` port; no tenant-owned collection touched.

## Nits (non-blocking)
- [P3] packages/core/src/users/user.ts:1176 — `normaliseDisplayName` strips only `\p{Cc}`; Unicode format characters (`\p{Cf}`: bidi overrides U+202A–U+202E / U+2066–U+2069, zero-width U+200B–U+200D, U+FEFF) survive. In an RTL-heavy app these let a display name spoof or reorder adjacent text on leaderboards. Spec-conformant today (names are not displayed until T010c/T011); consider stripping bidi overrides/isolates and zero-width chars (keeping ZWJ/ZWNJ only if needed for scripts) when the name is first shown, or in T011.
- [P3] apps/api/src/adapters/firebase/user-repo.ts:260-262 — `IdentityDoc` accepts any `id` / `subject` string; it does not check `subject` against `SUBJECT_PATTERN` or that `id === identityId(...)` matches the doc id. Docs are only reachable by validated id and only the API writes them, so impact is nil; tightening keeps the converter consistent with the users converter.
- [P3] `identities` stores `email` and `emailVerified` for every user. That is per spec, but there is no reader for them yet; make sure T013 (account deletion) removes `identities/*` alongside `users/*`.

## Hard rules
1. core vendor-free — ok (core adds only types, regex, `normalize`, `toIso`; no `crypto`/firebase)
2. ports + adapters + fakes — ok (`IdGenerator`: `UlidIdGenerator` + `FakeIdGenerator`; `UserRepo`: `FirestoreUserRepo` + `InMemoryUserRepo`, shared contract on both; only `composition.ts` picks adapters)
3. no client Firestore writes — ok (rules unchanged deny-all; rules tests cover the real `users`/`identities` shapes)
4. tenant isolation — ok (n/a: global collections, documented on the port; no tenant data)
5. time from Clock — ok (timestamps via `deps.clock` + `toIso`; ULID time from injected `Clock`; no client clock path)
6. roles server-side — ok (no roles/claims introduced; identity comes only from a server-verified `VerifiedIdentity`, wired in T010b)
7. entitlements not plan name — ok (n/a)
8. own IDs — ok (`userId` is our ULID; Firebase uid only as `Identity.subject` / identity doc id)
9. secrets — ok (none added; no logging; emulator-only tests with `demo-noor`)
10. AI output untrusted — ok (n/a)
11. religious content provenance — ok (n/a)
