# Spec — T021 Invite link and join

One slice. An admin or owner creates an invite; anyone with the link can preview the community name and, once signed in, join as a member. Reuse T020: `Community`, `Membership`, `membershipId`, `roleAtLeast`, `requireMember`, `requireUser`, `requireConsent`, `CommunitySummary`, and the shared in-memory community store. Do not add a second port.

## Acceptance tests

1. A default invite stores a ULID token, `uses: 0`, `createdBy` and `tenantId` from the caller, `maxUses` 25, and `expiresAt` exactly 7 × 86 400 000 ms after the single `Clock` read — core — `packages/core/src/usecases/create-invite.test.ts`
2. `expiresInDays` 1–30 and `maxUses` 1–100 are stored; omitted fields use those defaults; 0, 31, 101, non-integers, and any caller `expiresAt`, `role`, `uses`, or `tenantId` are `VALIDATION` and write nothing — core — `packages/core/src/usecases/create-invite.test.ts`
3. A member, scholar-reviewer, or editor gets `FORBIDDEN` and no invite is stored; an admin and an owner can create — core — `packages/core/src/usecases/create-invite.test.ts`
4. A user with no membership in that tenant gets `FORBIDDEN` and no invite is stored — core — `packages/core/src/usecases/create-invite.test.ts`
5. A live invite previews as exactly `{ name }` of that community — core — `packages/core/src/usecases/preview-invite.test.ts`
6. An unknown token is `NOT_FOUND`; `expiresAt <= now` and `uses >= maxUses` are `GONE` and the name is not returned — core — `packages/core/src/usecases/preview-invite.test.ts`
7. A malformed token is `VALIDATION` and the invite repo is not read — core — `packages/core/src/usecases/preview-invite.test.ts`
8. The first accept creates one membership with role `member`; the second accept by that user returns the same membership, leaves `uses` unchanged, and `listMyCommunities` returns that one community — core — `packages/core/src/usecases/accept-invite.test.ts`
9. An existing owner who accepts stays `owner` and does not consume a use — core — `packages/core/src/usecases/accept-invite.test.ts`
10. When `uses` has reached `maxUses`, the user who already joined can accept again, and a different user gets `GONE` with no new membership — core — `packages/core/src/usecases/accept-invite.test.ts`
11. A new user accepting an expired invite gets `GONE` and no membership; a user who already has a membership still succeeds — core — `packages/core/src/usecases/accept-invite.test.ts`
12. An unknown token on accept is `NOT_FOUND`; a malformed token is `VALIDATION` and writes nothing — core — `packages/core/src/usecases/accept-invite.test.ts`
13. Two new users accepting the last remaining use: one membership is created, `uses` equals `maxUses`, and the other call is `GONE` — adapter — `packages/testkit/src/contracts/invite-repo.contract.ts` (same suite in `apps/api/src/adapters/firebase/invite-repo.contract.test.ts`)
14. `create` then `getByToken` round-trips the doc; creating the same token again is `CONFLICT` and does not change the stored invite — adapter — `packages/testkit/src/contracts/invite-repo.contract.ts`
15. `POST /v1/t/:tenantId/invites` returns 201 and a strict body `{ token, expiresAt, maxUses }` with no `createdBy`, `uses`, `tenantId`, slug, or role — api — `apps/api/src/routes/invites.test.ts`
16. `POST` create without a token is 401 `UNAUTHENTICATED` — api — `apps/api/src/routes/invites.test.ts`
17. `POST` create without the current consent is 403 `CONSENT_REQUIRED` — api — `apps/api/src/routes/invites.test.ts`
18. `POST` create as a member of that tenant, and as an editor of that tenant, is 403 `FORBIDDEN` — api — `apps/api/src/routes/invites.test.ts`
19. `POST` create as an admin of a different tenant is 403 `FORBIDDEN` and stores no invite — api — `apps/api/src/routes/invites.test.ts`
20. `POST` create with `role`, `expiresAt`, `maxUses: 0`, an unknown key, or a non-ULID `:tenantId` is 400 `VALIDATION` — api — `apps/api/src/routes/invites.test.ts`
21. `GET /v1/invites/:token` with no `Authorization` returns 200 and a body that is exactly `{ name }`; a member of another tenant gets that same body — api — `apps/api/src/routes/invites.test.ts`
22. `GET` preview is 404 `NOT_FOUND` for an unknown token and 410 `GONE` for an expired token and a used-up token, and none of those bodies contain a name — api — `apps/api/src/routes/invites.test.ts`
23. `GET` preview of a malformed token is 400 `VALIDATION` — api — `apps/api/src/routes/invites.test.ts`
24. With `maxUses` 1, the first accept is 201 and the second accept by the same user is 200; both bodies are `CommunitySummary` with role `member`; exactly one membership exists and `uses` is 1 — api — `apps/api/src/routes/invites.test.ts`
25. A user who is not already a member gets 410 `GONE` for an expired token and for a used-up token — api — `apps/api/src/routes/invites.test.ts`
26. `POST` accept without a token is 401 `UNAUTHENTICATED`; without current consent it is 403 `CONSENT_REQUIRED` — api — `apps/api/src/routes/invites.test.ts`
27. Accepting an invite for tenant B while already a member of tenant A adds only role `member` in B and leaves the A membership unchanged — api — `apps/api/src/routes/invites.test.ts`
28. `POST` accept with a body such as `{ "role": "owner" }` is 400 `VALIDATION` and does not create a membership — api — `apps/api/src/routes/invites.test.ts`
29. `DomainError` `GONE` maps to HTTP 410, public message `Gone`, and `details` are not in the body — api — `apps/api/src/errors.test.ts`
30. Unauthenticated, authenticated, and forged-claims clients cannot read or write `invites` — rules — `firebase/rules.test.ts`
31. Invite and join copy comes from `en.json`; the community name uses `dir="auto"`; new CSS uses logical properties only — web — `apps/web/src/features/invites/InviteDialog.test.tsx` and `apps/web/src/features/invites/JoinView.test.tsx`
32. The Invite control is shown for `admin` and `owner` only, not for `member`, `editor`, or `scholar-reviewer` — web — `apps/web/src/features/communities/CommunitiesView.test.tsx`
33. The dialog shows a link whose pathname is `/join/{token}` and a QR image whose `src` is a `data:` URL; producing that image does not call `fetch` or a remote QR host — web — `apps/web/src/features/invites/InviteDialog.test.tsx` and `apps/web/src/features/invites/invite-qr.test.ts`
34. The join view covers loading, the name preview, not-found, gone without a name, sign-in when signed out, and the joined community after accept, including under `dir="rtl"` — web — `apps/web/src/features/invites/JoinView.test.tsx`
35. User A creates an invite, user B opens `/join/:token`, joins, and sees that community in B’s list; the QR image is not requested from another origin — e2e — `apps/web/e2e/invites.spec.ts`
36. `CreateInviteRequest`, `CreateInviteResponse`, and `InvitePreviewResponse` are strict: extra keys fail, and the documented shapes parse — contracts — `packages/contracts/src/invite.test.ts`

## Files and modules to touch

- `packages/contracts/src/invite.ts` — request and response schemas below. Export from `packages/contracts/src/index.ts`. Contracts do not import core.
- `packages/contracts/src/invite.test.ts` — test 36.
- `packages/core/src/errors.ts` — add `GONE` to `DOMAIN_ERROR_CODES`.
- `packages/core/src/communities/invite.ts` — `Invite`, `INVITE_SCHEMA_VERSION`, limit constants, `asInviteToken`, `inviteUnusable`.
- `packages/core/src/ports/repos.ts` — `InviteRepo`. Update the `MembershipRepo` note: membership writes are the owner row in `CommunityRepo.createWithOwner`, the member row inside `InviteRepo.accept`, and `deleteByUser`. Still no `setRole` and no public `MembershipRepo` create.
- `packages/core/src/deps.ts` — `invites: InviteRepo`.
- `packages/core/src/usecases/create-invite.ts` (+ `.test.ts`) — tests 1–4.
- `packages/core/src/usecases/preview-invite.ts` (+ `.test.ts`) — tests 5–7.
- `packages/core/src/usecases/accept-invite.ts` (+ `.test.ts`) — tests 8–12. Use `makeTestDeps()` so invites and memberships share one store, then `listMyCommunities` in test 8.
- `packages/core/src/index.ts` and `packages/core/src/index.test.ts` — export `asInviteToken`, `inviteUnusable`, `createInvite`, `previewInvite`, `acceptInvite`, `INVITE_SCHEMA_VERSION`, and the limit constants.
- `packages/testkit/src/in-memory-community-store.ts` — `invites` on the same maps as `memberships` (and able to read communities only if the use case does that read through `CommunityRepo`, not inside the invite map). `create` / `getByToken` / `accept` as specified. `accept` does its read-then-write with no `await` in between, matching `createWithOwner`.
- `packages/testkit/src/contracts/invite-repo.contract.ts` — tests 13–14, run for the in-memory repo.
- `packages/testkit/src/make-test-deps.ts` — default `invites` comes from the same `createInMemoryCommunityStore()` as default `memberships`. An override replaces that object only.
- `packages/testkit/src/index.ts` — export the new repo surface the contract needs.
- `apps/api/src/errors.ts` — `GONE` → 410, public message `Gone`. The existing exhaustive table in `errors.test.ts` covers test 29 once the code is mapped.
- `apps/api/src/routes/invites.ts` (+ `invites.test.ts`) — the three routes. Mount from `apps/api/src/app.ts`.
- `apps/api/src/adapters/firebase/invite-repo.ts` — Firestore adapter. Export the existing membership converter from `community-repo.ts` and use it here so the membership shape stays in one place. Do not change `createWithOwner`.
- `apps/api/src/adapters/firebase/invite-repo.contract.test.ts` — runs the shared invite contract on the emulator.
- `apps/api/src/composition.ts` and `apps/api/src/composition.test.ts` — wire `FirestoreInviteRepo`. Invalid config still builds no adapters.
- `firebase/rules.test.ts` — add an `invites` seed so the existing deny matrix covers it. No new `allow` rule. `firebase/firestore.indexes.json` stays empty: token and membership reads are document gets.
- `apps/web/src/api/client.ts` (+ `client.test.ts`) — `createInvite`, `previewInvite` (no token), `acceptInvite`.
- `apps/web/src/features/auth/session-context.tsx` — `createInvite` and `acceptInvite` take the signed-in id token, same pattern as `createCommunity`. Preview stays on the API client so a signed-out visitor can load it.
- `apps/web/src/features/communities/CommunitiesView.tsx` (+ test) — Invite control. `CommunitiesPage.tsx` opens the dialog and calls `createInvite` with `{}`.
- `apps/web/src/features/invites/InviteDialog.tsx` (+ test), `join-url.ts`, `invite-qr.ts` (+ test), `JoinView.tsx` (+ test), `JoinPage.tsx`.
- `apps/web/src/router.tsx` — `{ path: '/join/:token', element: <JoinPage /> }` under the existing layout.
- `apps/web/src/i18n/en.json` — new keys only. Other locales keep falling back.
- `apps/web/src/styles.css` — dialog and join layout. Logical properties only.
- `apps/web/package.json` — one dependency, `qrcode`, used only by `inviteQrDataUrl`. Justification: encode the join URL as a QR image in the browser; the package does not contact a QR service. Exit: replace that one function. Do not add it to `packages/core` or `apps/api`.
- `apps/web/e2e/invites.spec.ts` — test 35, two browser contexts, `signInWithEmulator` and `acceptConsentOnScreen`.

Do not change `delete-account.ts`, `BOARD.md`, `factory/board.json`, or anything under `factory/jobs/T031-create-season`.

## Contracts and data shapes

New domain code: `GONE`. Map it only in `apps/api/src/errors.ts` to **410** and public message `Gone`. Expired and used-up are the same code, so a response does not say which. Unknown token stays `NOT_FOUND` (404). Malformed token or body stays `VALIDATION` (400). `CLOSED` stays 409 and is not used for invites.

Limits (core constants and the zod bounds are the same numbers):

| Field | Default | Min | Max |
| --- | --- | --- | --- |
| `expiresInDays` | 7 | 1 | 30 |
| `maxUses` | 25 | 1 | 100 |

Expiry is an absolute duration from `Clock` via `addDuration(now, { days })` (86 400 000 ms per day), not a local calendar day and not a client timestamp.

`CreateInviteRequest` — strict object, both fields optional: `expiresInDays` int 1–30, `maxUses` int 1–100. `{}` is valid. `role`, `tenantId`, `createdBy`, `expiresAt`, `uses`, and `token` are rejected.

`CreateInviteResponse` — strict `{ token: Ulid, expiresAt: UtcIso, maxUses }`. `token` is the document id.

`InvitePreviewResponse` — strict `{ name }` where `name` is 1–48 Unicode code points. No other key.

Accept success reuses `CommunitySummary` (`CommunityResponse`). 201 when `created` is true, 200 when it is false. The role in that body is the stored membership role.

`POST` accept body is `z.strictObject({})`. Any other JSON is 400. The route does not copy the body into the use case.

Error body stays `ErrorResponse`. Clients localise by `code`.

Firestore `invites/{token}` (`token` is a ULID, `id === token`):

```
{
  id, tenantId, createdBy, expiresAt, maxUses, uses,
  createdAt, updatedAt, schemaVersion: 1
}
```

All timestamps are UTC ISO strings from `Clock`. On create, `uses` is 0 and `createdAt === updatedAt`. No composite index.

Membership created by accept, id `membershipId(userId, tenantId)`:

```
{
  id, tenantId, userId, role: "member",
  createdAt: now, updatedAt: now, schemaVersion: 1
}
```

`InviteRepo`:

- `create(tenantId, invite)` — `tenantId` is the first argument and must equal `invite.tenantId`. Mismatch, bad ULID, `uses !== 0`, or a limit outside the range is `VALIDATION` and writes nothing. An existing token is `CONFLICT`.
- `getByToken(token)` — omits `tenantId` because the caller does not know the tenant yet. The token is the unguessable document id (same exception class as `listByUser`). Returns `null` when missing. Does not check expiry. A non-ULID throws `VALIDATION` before the read.
- `accept({ token, userId, now })` — one transaction. `now` is the UTC ISO string the use case got from `Clock`. The adapter must not read the clock. Order inside the transaction:
  1. Missing invite → `NOT_FOUND`, no write.
  2. Existing membership for `(invite.tenantId, userId)` → return `{ membership, created: false }` with no write. Do this before the expiry and `maxUses` checks so a second accept still works after the link is used up or has expired.
  3. `inviteUnusable(invite, instantFromIso(now))` → `GONE`, no write. Unusable means `expiresAt <= now` or `uses >= maxUses`.
  4. Otherwise write the `member` membership and set `uses` to the value read in this transaction plus 1, and `updatedAt` to `now`. Return `{ membership, created: true }`.

`inviteUnusable` lives in core. The preview use case and both invite adapters call it. Do not reimplement the comparison.

`createInvite(deps: { clock, ids, memberships, invites }, { tenantId, userId, expiresInDays?, maxUses? })`:

1. Brand `tenantId` and `userId`. Resolve limits or throw `VALIDATION`.
2. `memberships.get`. Missing, or `roleAtLeast(role, 'admin')` false → `FORBIDDEN`. The role is the stored membership, never an argument.
3. One `clock.now()`. Token from `ids.newId()` branded with `asInviteToken`.
4. `invites.create`. Return the stored invite.

`previewInvite(deps: { clock, invites, communities }, { token })` — no user id:

1. Brand the token or `VALIDATION`.
2. `getByToken`. `null` → `NOT_FOUND`.
3. `inviteUnusable` against `clock.now()` → `GONE`.
4. `communities.getById(invite.tenantId)`. Missing → `NOT_FOUND`.
5. Return `{ name: community.name }` only.

`acceptInvite(deps: { clock, invites, communities }, { token, userId })` — no tenant id and no role:

1. Brand token and user id or `VALIDATION`.
2. `getByToken`. `null` → `NOT_FOUND`. Do not treat expiry here.
3. `communities.getById(invite.tenantId)`. Missing → `NOT_FOUND` and do not call `accept`.
4. `invites.accept` with `now` from one `clock.now()`.
5. Return `{ community, membership, created }`. The community is the one loaded in step 3; its `tenantId` must equal `membership.tenantId`.

Routes:

| Method and path | Middleware | Success |
| --- | --- | --- |
| `POST /v1/t/:tenantId/invites` | body limit 4096, `requireUser`, `requireConsent`, `requireMember('admin')` | 201 `CreateInviteResponse` |
| `GET /v1/invites/:token` | none | 200 `InvitePreviewResponse` |
| `POST /v1/invites/:token/accept` | body limit 4096, `requireUser`, `requireConsent` | 201 or 200 `CommunitySummary` |

`tenantId` on create comes from `c.var.membership.tenantId`. `userId` comes from `c.var.user.id`. Parse every success body with its strict schema before `c.json`, as `communitySummary` does. Do not log the token, the `Authorization` header, or the invite doc.

Web:

- Join URL is `new URL('/join/' + token, origin).href`. The API does not build an absolute URL and no new env var is required.
- On each community row, show Invite only when `role` is `admin` or `owner`. Opening the dialog calls `createInvite` with `{}`. Show loading, error with retry, the link (an `<a>`), a Copy control (`navigator.clipboard.writeText`, and keep the link visible if that fails), and the QR. Format `expiresAt` with `Intl.DateTimeFormat` in the community’s timezone next to a translated label; `t()` has no placeholders.
- `inviteQrDataUrl(text)` returns a `data:` URL from the `qrcode` package in process. Empty text throws. The module does not call `fetch`.
- `/join/:token` loads `previewInvite` with no auth header. States: loading, not-found (404), gone (410, no name, no Join button), preview (name + Join), signed-out (Join calls the existing `signIn()` and stays on this URL), joining, joined (name from the accept response), error with retry. Do not auto-accept on load. After success, do not refetch the preview. Do not exempt `/join/:token` from the consent gate: a signed-out visitor sees the preview; a signed-in user who still owes consent sees the existing gate, then this page, then clicks Join. Accept stays behind `requireConsent`.
- New strings in `en.json` under `community.invite*` and `join.*`. No hard-coded user-facing copy. Community name `dir="auto"`.

Rules seed (so the current loop denies get, list, create, overwrite, update, and delete):

```
invites/{ulid}: {
  id, tenantId, createdBy, expiresAt, maxUses: 25, uses: 0,
  createdAt, updatedAt, schemaVersion: 1
}
```

`firestore.rules` stays default deny. Do not add an allow rule for `invites`.

## Hard rules that apply here

1. **Core stays vendor-free.** Use cases and `inviteUnusable` take `Clock`, `IdGenerator`, and repos only. No `firebase`, `hono`, `fetch`, or `qrcode` in `packages/core`. The adapter receives `now`; it does not call `Date.now` or `new Date()` for the current time. `instantFromIso` / `inviteUnusable` may parse that given string.
2. **Browser writes go through the API.** Preview, create, and accept are HTTP. `invites` is covered by the deny-all rules test. The QR is drawn in the browser from the join URL. No request to a QR hosting service.
3. **Tenant isolation.** Create uses the membership’s `tenantId`. Accept uses `tenantId` from the invite document, not from the body or the path. The new membership id is `membershipId` for that pair only. A member of tenant A who accepts B’s invite gains `member` in B and keeps their role in A.
4. **Roles stay server-side.** `requireMember('admin')` plus the use-case `roleAtLeast(..., 'admin')` check. The accept body cannot set a role. New joins are always `member`. An existing membership’s role is left as stored.
5. **Time comes from `Clock`.** One read per use case. Tests move a `FakeClock`. There is no client test mode.
6. **The public preview is the name only.** `GET` has no auth and no consent check. The strict response schema drops every other field. Expired and used-up tokens are 410 on both `GET` and `POST` accept, except the accept short-circuit for someone who already has a membership.
7. **Accept is one transaction.** A second accept does not insert another membership and does not increment `uses`. `uses` never passes `maxUses`. No entitlement or Stripe call: joining is not plan-gated in this task.
8. **Secrets.** No new secret, no `.env` change, no token in logs.

## Out of scope

- T022: member list, role changes, remove, leave, last-owner rules, `canChangeRole`.
- T023: community switcher, `/c/:slug`, `GET /v1/communities/by-slug/:slug`.
- T031 and any season, question, or schedule work.
- Listing, revoking, editing, or reusing an existing invite. Each dialog open creates a new token. Both tokens stay valid until they expire or fill.
- Rate limiting. E04 adds `rateLimit` on accept later. Do not add a rate-limit port.
- Member caps, pending join requests, and plan-based `maxUses` or lifetime (E09). No `requireFeature`.
- Sending the link by email, WhatsApp, Telegram, or a share card (E06).
- Changing `deleteAccount`. Invites are not removed when the creator deletes their account; `createdBy` may dangle.
- A client read of `invites`, `communities`, or `memberships`.
- A members page or a community home. The only new route is `/join/:token`. The invite UI is a dialog on the existing communities page.
- Translating `sv`, `ar`, `am`, or `so`, and a Playwright session in Arabic. `t()` is English-only until T080. RTL is the `dir="rtl"` component check in test 34.
- Auto-joining when the page loads.
- A second new port (QR, email, rate limit, or a public `MembershipRepo.create`).
