VERDICT: PASS
# Code review — T021 round 1

## Findings
None.

## Acceptance tests
1. ok — `packages/core/src/usecases/create-invite.test.ts` "stores a ULID token, uses 0, the caller, maxUses 25 and expiry 7 days after one clock read"
2. ok — same file, bounds cases and "throws VALIDATION for … and writes nothing"
3. ok — same file, member / scholar-reviewer / editor forbidden; admin and owner allowed
4. ok — same file, "throws FORBIDDEN when the user has no membership and stores no invite"
5. ok — `packages/core/src/usecases/preview-invite.test.ts` "returns exactly the community name for a live invite"
6. ok — same file, unknown token `NOT_FOUND`; `expiresAt === now` and `uses >= maxUses` are `GONE` with no name
7. ok — same file, malformed token is `VALIDATION` and `getByToken` is not called
8. ok — `packages/core/src/usecases/accept-invite.test.ts` uses `makeTestDeps()`, one member row, second accept leaves `uses` at 1, `listMyCommunities` returns that community
9. ok — same file, existing owner stays owner and `uses` stays 0
10. ok — same file, filled link: the member accepts again; a different user is `GONE` with no membership
11. ok — same file, expired link: new user `GONE`; existing member still succeeds
12. ok — same file, unknown token `NOT_FOUND`; malformed token `VALIDATION` and `accept` is not called
13. ok — `packages/testkit/src/contracts/invite-repo.contract.ts` "gives the last remaining use…", run for the in-memory repo and from `apps/api/src/adapters/firebase/invite-repo.contract.test.ts`
14. ok — same contract, "round-trips create and getByToken, and a second create is CONFLICT"
15. ok — `apps/api/src/routes/invites.test.ts` 201 body is only `{ token, expiresAt, maxUses }`
16. ok — same file, create without a token is 401 `UNAUTHENTICATED`
17. ok — same file, create without current consent is 403 `CONSENT_REQUIRED`
18. ok — same file, member and editor of that tenant are 403 `FORBIDDEN` and `count()` stays 0
19. ok — same file, admin of another tenant is 403 and no invite is stored
20. ok — same file, `role`, `expiresAt`, `maxUses: 0`, unknown key, and a non-ULID `:tenantId` are 400 `VALIDATION`
21. ok — same file, GET with no `Authorization`, and with another tenant's member, is exactly `{ name }`
22. ok — same file, unknown token 404; expired and used-up 410 with no name
23. ok — same file, malformed preview token is 400 `VALIDATION`
24. ok — same file, `maxUses` 1: first accept 201, second 200, role `member`, one membership, `uses` is 1
25. ok — same file, a non-member gets 410 for an expired token and a used-up token, with no membership
26. ok — same file, accept without a token is 401; without consent is 403 and no membership
27. ok — same file, accepting B adds `member` in B and leaves the A membership unchanged
28. ok — same file, `{ role: "owner" }` is 400 and `uses` stays 0
29. ok — `apps/api/src/errors.test.ts` walks every `statusForCode` entry; `GONE` is 410, message `Gone`, and `ErrorResponse` is strict so `details` cannot be in the body
30. ok — `firebase/rules.test.ts` seeds `invites` into the existing deny matrix (get, list, create, overwrite, update, delete) for unauthenticated, authenticated, and forged-claims clients; `firestore.rules` has no new allow
31. ok — `InviteDialog.test.tsx` and `JoinView.test.tsx` require every `community.invite*` / `join.*` string from `en.json`; the name is `dir="auto"`. New rules in `apps/web/src/styles.css` use logical properties (`margin-block`, `inline-size`, `text-align: start`)
32. ok — `CommunitiesView.test.tsx` "shows Invite for admin and owner only"
33. ok — `InviteDialog.test.tsx` pathname `/join/{token}` and `src="data:` with `fetch` unused; `invite-qr.test.ts` data URL, empty text throws, no `fetch`
34. ok — `JoinView.test.tsx` loading, preview, not-found, gone without a name, signed-out, joined, and error, all under `dir="rtl"`
35. ok — `apps/web/e2e/invites.spec.ts` two contexts: A creates, B opens `/join/:token`, joins, and sees the community; QR requests to a remote host stay empty
36. ok — `packages/contracts/src/invite.test.ts` strict create, response, and preview schemas; extra keys fail

## Hard rules
1. ok — use cases and `inviteUnusable` take `Clock`, `IdGenerator`, and repos only. No `firebase`, `hono`, `fetch`, or `qrcode` under `packages/core`. `FirestoreInviteRepo.accept` parses the `now` string it is given and does not read a clock.
2. ok — `InviteRepo` is on the existing repo port, with an in-memory fake and a Firestore adapter. Create, preview, and accept are HTTP. The browser draws the QR from `qrcode`'s `create` in `invite-qr.ts`. Rules stay default deny.
3. ok — no client Firestore writes. `invites` is in the deny-all matrix. Preview, create, and accept go through `apiClient`.
4. ok — create takes `tenantId` first and `validateNewInvite` rejects a mismatch. The route passes `c.var.membership.tenantId` after `requireMember('admin')`. Accept takes `tenantId` from the invite document and writes `membershipId(userId, invite.tenantId)`. `getByToken` omits `tenantId`, the exception the spec shares with `listByUser`.
5. ok — each use case reads `Clock` once. Expiry is `addDuration` of 86 400 000 ms days. Tests move `FakeClock`. `InviteDialog` formats the stored `expiresAt` with `Intl.DateTimeFormat`; the e2e `Date.now()` is only a unique email stamp.
6. ok — create checks the stored role with `roleAtLeast(..., 'admin')`. Accept's body is `z.strictObject({})` and is not passed into the use case. New rows are `member`; an existing row is returned as stored.
7. ok — joining is not plan-gated. No plan-name check and no Stripe call.
8. ok — membership and user ids are app ULIDs from `c.var.user.id` and `ids.newId()`, not the Firebase uid.
9. ok — no new secret, no `.env` change. Routes do not log the token, the `Authorization` header, or the invite doc. `GONE` / `NOT_FOUND` details stay off the response.
10. ok — no AI output in this slice.
11. ok — no question content is created or scheduled.

## Nits (non-blocking)
None.
