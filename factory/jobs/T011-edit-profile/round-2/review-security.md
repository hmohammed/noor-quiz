VERDICT: PASS
# Security review — T011 round 2

Scope: `git diff main...factory/T011-edit-profile` (47 files), focused on the round 2 commit `b30b82d` (`git diff e1d7106 factory/T011-edit-profile`). That commit changes six web files only: `ProfilePage.tsx`, `ProfileFormView.tsx` (+ test), `en.json`, `e2e/helpers/sign-in.ts`, `e2e/profile.spec.ts`. No API, core, contract, adapter or rules file changed since round 1. I re-read `apps/api/src/routes/me.ts` and `apps/web/src/features/auth/session-context.tsx` on the branch to confirm the round 1 conclusions still hold.

## Findings
None at P0–P2.

What I checked in round 2:
- Per-user draft reset: `ProfilePage` now renders `ProfileEditor` only when `state.kind === 'signed-in'`, keyed by `state.me.userId`. The draft and status are unmounted when the session leaves `signed-in` or the user changes. On a shared device, one member's unsaved name no longer shows in the next member's form. This is a privacy improvement, and the new e2e test "an unsaved edit never shows in the next member's form" covers it.
- New `signed-out` sign-in button: it calls the existing `session.signIn`, which uses the same popup flow as the header. No new auth path.
- New `error` retry: it calls `window.location.reload()`. No token, URL parameter or client override is involved.
- New `unavailable` state: display only. It exposes no config or error detail.
- New strings: static `t()` keys with no interpolated user data. React escapes the output, and the tests check the escaped HTML.
- Server path unchanged: `PATCH /v1/me` still runs `bodyLimit(4096)`, then `requireUser()`, then strict `UpdateMeRequest`, then `updateProfile` with `c.var.user.id`. The response is still built from four named fields.

## Hard rules
1. core vendor-free: ok. No core change in round 2. Round 1 is unchanged: `Intl` and regex only.
2. ports, adapters and fakes: ok. No port change in round 2. `UserRepo.updateProfile` is in the port, the fake and the Firestore adapter, with the shared contract.
3. no client Firestore writes: ok. The web app saves only through `PATCH /v1/me`, and the rules are unchanged (deny-all).
4. tenant isolation: ok. `users` is global by design, the id comes from the verified token only, and the cross-user test is present.
5. time from Clock: ok. `updatedAt` comes from `deps.clock`, and round 2 adds no time logic.
6. never trust the client: ok. The strict body rejects authority keys, core validates again, and the UI changes add no client authority.
7. answer secrecy: ok (n/a). No question or answer data is touched.
8. own IDs: ok. Responses carry only our ULID. The `userId` used as a React key is our own id, not the provider subject.
9. no secrets or PII in logs: ok. Round 2 adds no logging, and the error states show fixed strings only.
10. billing through entitlements: ok (n/a). No billing or entitlement change.
11. AI prompts delimited and validated: ok (n/a). No AI or messaging change.

## Nits (non-blocking)
- [P3] `apps/web/src/features/auth/session-context.tsx:124-127` (unchanged in round 2): `updateMe` reads `generation.current` before `await getIdToken()`, and checks it again only before `setState`. In theory, if the account switches while the token is being fetched, user A's patch could be sent with user B's token. The window is tiny, because a switch needs a sign-out and a popup sign-in. Checking `current === generation.current` again right after `getIdToken()`, and bailing out if it changed, would close it.
- [P3] Carried from round 1: `apps/api/src/routes/me.ts:30` spreads `...patch` after `userId`. The strict contract blocks a `userId` key today, but writing `{ ...patch, userId: c.var.user.id }` would stay safe if the contract is loosened later.
- [P3] Carried from round 1: `PATCH /v1/me` has no rate limit. The spec puts this out of scope and the epic notes record it as a follow-up. Track it before public launch.
