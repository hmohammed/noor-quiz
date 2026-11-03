VERDICT: PASS
# Code review — T013a round 1

Reviewed `git diff main...factory/T013a-record-consent` (4 commits, 32 files) against spec.md and build.md. I re-ran `npm test` in the worktree: 840/840 tests pass. The one failing suite is `tooling/src/docs-commands.test.ts`. It fails because AGENT.md has CRLF line endings in this Windows checkout, and the branch does not touch AGENT.md or tooling, as build.md says. I did not re-run the emulator or e2e suites; I relied on build.md for those and checked their tests by reading them.

## Findings
No must-fix findings.

## Acceptance tests
1. ok — `packages/core/src/users/consent.test.ts` ("is true only for the current version", "is false for %s")
2. ok — `consent.test.ts` ("is a non-empty string of at most 32 chars")
3. ok — `accept-consent.test.ts:79`
4. ok — `accept-consent.test.ts:95` (checks that `recordConsent` is not called again)
5. ok — `accept-consent.test.ts:108`
6. ok — `accept-consent.test.ts:123` (it.each for CONFLICT, covering an older string and `''`)
7. ok — `accept-consent.test.ts:136` (NOT_FOUND) and `:144` (VALIDATION)
8. ok — `get-or-create-user.test.ts` (`consent: null` on create, stored consent unchanged on a later sign-in)
9. ok — `CONSENT_REQUIRED` is in `DOMAIN_ERROR_CODES` (`errors.ts`), and the existing `it.each` tables cover it
10–15. ok — the `recordConsent` block in `packages/testkit/src/contracts/user-repo.contract.ts` runs against both repos. `userDoc()` gains `consent: null`.
16–18. ok — `apps/api/src/adapters/firebase/user-repo.contract.test.ts` (doc shape at :75, legacy read at :178, `recordConsent` on a legacy doc at :210, strict INTERNAL cases at :161-163)
19. ok — `apps/api/src/middleware/require-consent.test.ts` (4 tests)
20. ok — `require-user.test.ts` ("sets c.var.user to exactly…", "sets consentVersion … never acceptedAt")
21. ok — `errors.ts` maps 403 and "Consent required", and the exhaustive tables cover it
22–35. ok — `apps/api/src/routes/me.test.ts`:
   - 22 → :142
   - 23 → :535
   - 24 → :559
   - 25 and 26 → :493 and :502
   - 27 → :519
   - 28 → :574
   - 29 → :596 (8 cases)
   - 30 → :623
   - 31 → :640
   - 32 → :651
   - 33 → :279
   - 34 → :668 and :317
   - 35 → the PATCH block uses the consent-by-default `signedIn`, and the VanishingRepo test seeds consent first
36–37. ok — `packages/contracts/src/me.test.ts`
38. ok — `apps/web/src/features/auth/timezone-default.test.ts`
39. ok — `apps/web/src/api/client.test.ts` ("throws ApiError when the body has no consent block")
40. ok by reading `apps/web/e2e/helpers/sign-in.ts` and `profile.spec.ts`. The e2e result itself comes from build.md (5/5 pass).

## Hard rules
1. ok — `consent.ts` and `accept-consent.ts` import only core modules. `isValidConsent` uses `instantFromIso`.
2. ok — no client-side Firestore writes. Consent is written only through the API (`recordConsent`), and rules are unchanged.
3. ok — `users` is a global collection by design, so no `tenantId` applies. Cross-user isolation is tested in contract test 10 and route test 32.
4. ok — no `Date.now()` or `new Date()` in the changed non-test source. `acceptedAt` and `updatedAt` come from `toIso(deps.clock.now())`.
5. ok — no plan-name checks.
6. ok — `AcceptConsentRequest` is strict. `userId` comes only from the verified token. `version` is only compared to the server constant. `required` is computed on the server.
7. ok — the primary key is our ULID, validated with `asUserId`.
8. ok — no secrets in code or logs. Error `details` carry only a reason. The e2e helper never logs the auth header.
9. ok — not applicable: no AI output is touched.
10. ok — `MeResponse` is built from named fields and `.parse`d. The strict `MeConsent` has no `acceptedAt`. `toUserDoc` and `recordConsent` copy consent by named keys.
11. ok — not applicable: no content is scheduled.

## Scope
Only files listed in the spec's "Files" section changed. There are no changes to `firestore.rules`, indexes, BOARD.md or epic files. No new dependencies. `requestUserOf()` in `me.ts` is a small helper that is not named in the spec. It serves the "never spread a user" rule, so it is fine.

## Correctness
- Middleware order matches the spec. PATCH runs `limitBody, requireUser, requireConsent` and then parses. POST consent runs `limitBody, requireUser` and then parses.
- `acceptConsent` runs its checks in the spec's order: VALIDATION, CONFLICT, NOT_FOUND, no-op if already current, then write.
- Both repos check the id, then the consent shape, then existence. A malformed consent on an unknown user therefore gives VALIDATION (noted in build.md).
- `InMemoryUserRepo.#copy` copies the nested `consent`, so no stored object leaks through a return value. `updateProfile` preserves consent through `#copy`.
- `FirestoreUserRepo.recordConsent` uses a transaction and `tx.update` with only `consent` and `updatedAt`. The `UserDoc` schema is strict, with a default of `null` for legacy docs.
- The e2e timezone test registers the PATCH waiter before the consent helper and still asserts exactly one PATCH.

## Nits (non-blocking)
- `recordConsent` does not validate `updatedAt` in either repo. The spec does not ask for it, and the caller always passes a Clock ISO value. A cheap check could go in a later hardening task.
- `isValidConsent` checks that `acceptedAt` parses via `instantFromIso`. The Firestore `UserDoc` uses its own `isoString` refinement. Both agree on all tested inputs. If they ever diverge, a write could succeed and the next read would fail as INTERNAL, so keep them aligned.
