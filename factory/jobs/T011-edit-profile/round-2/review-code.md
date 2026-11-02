VERDICT: PASS
# Code review — T011 round 2

Round 2 adds one commit on top of round 1, `b30b82d`. It touches only `apps/web`: `ProfilePage.tsx`, `ProfileFormView.tsx` (+ test), `en.json`, and the e2e `profile.spec.ts` and `helpers/sign-in.ts`. The round-1 code review passed, and nothing under `packages/` or `apps/api/` changed. I re-read the new diff and `session-context.tsx`.

Checks run in the worktree:
- `npm run typecheck` passes.
- `npm test` passes 769 tests in 48 files. The only failing suite is `tooling/src/docs-commands.test.ts`. It fails because `AGENT.md` is checked out with CRLF, as build.md says, and the diff does not touch that file.
- I did not re-run the emulator or Playwright suites. No adapter or rules changed.

## Findings
No must-fix findings.

The round-2 changes answer the three UX findings:
- `ProfilePage` now renders `ProfileEditor` with `key={state.me.userId}`. The editor unmounts whenever the session state leaves `signed-in`, which includes sign-out and the `loading` state during sign-in. The draft and the `saved` status therefore reset for the next member. The pending `updateMe().then` is guarded by `generation` in `session-context.tsx`, so a late response cannot put a signed-out user's data back into state.
- `error` now shows `profile.error.load` with a retry button (`profile.retry`, which reloads the page). `profile.error.generic` is used only for save failures.
- `unavailable` is its own view state with `profile.unavailable` and no sign-in action. `signed-out` has its own `onSignIn` button wired to `session.signIn`.

## Acceptance tests
Tests 1–22 and 24–25 are unchanged from round 1, which found them ok. This commit touches none of the code they cover. Test 25's e2e helper changed in a way that is still correct, noted below.
23. ok — `ProfileFormView.test.tsx` was extended and still asserts the labelled inputs, `dir="auto"`, the five endonyms with `lang`, and the `loading`, `saving`, `saved`, `invalid-name` and `error` states. The `signed-out` test also checks that the sign-in button is rendered and no form appears. New tests cover `unavailable` (no sign-in prompt, no button, no form) and the load error (`role="alert"` with the load text, not the save text, a retry button, no form). The no-raw-`profile.*`-key test now includes the `unavailable` state.
10/11/25. ok (not re-run) — `helpers/sign-in.ts` now scopes the click to `getByRole('banner')`, so the second sign-in button on a signed-out `/profile` cannot make the helper ambiguous. The CDN blocking is kept, and `sign-in.spec.ts` still uses the helper. The new e2e test "an unsaved edit never shows in the next member's form" types a draft, signs out, signs in as another user, and asserts the new name, no draft and no "Profile saved.".

## Hard rules
1. ok — `packages/core` not touched this round.
2. ok — no new I/O.
3. ok — the web still calls only `PATCH /v1/me`; there is no Firestore access.
4. ok — nothing changes on the server. The id still comes from `c.var.user.id`.
5. ok — no `Date.now()` in app code. The only `Date.now()` in the diff is in e2e emails. The two emails in the new test use different prefixes, so they cannot collide.
6. ok — no client-trusted roles, scores or dates.
7. ok — no plan checks.
8. ok — only ULIDs are used. `key={me.userId}` is our ULID, not a Firebase uid.
9. ok — no secrets or PII are logged, and the new strings are static.
10. ok — no AI output.
11. ok — no content scheduling.

## Scope, i18n, dependencies
- Scope: the diff is limited to the profile page, its view, `en.json` and the e2e files. All of it answers the round-1 UX review. No unrelated refactors. `profile.unavailable`, `profile.retry` and `profile.error.load` are small additions beyond the spec's key list. They are needed for the UX fixes and reasonable.
- i18n: all new user text goes through `t()` and `en.json`. The button reuses the existing `auth.signIn` key. The new buttons reuse the `auth__button` class, so no new CSS was needed.
- Dependencies: none added.

## Nits (non-blocking)
- `ProfilePage.tsx` `reloadPage` uses `window.location.reload()` for retry. That is simple and works, but it reloads the whole app and loses router state. A session-level `reload()` would be gentler. Fine for now.
- The signed-out and unavailable branches pass `onChange={() => undefined}` and `onSubmit={() => undefined}` to the view. This is harmless, but a discriminated props type would remove the dummy handlers.
- Round-1 nits still apply and are unchanged. The first is that the fire-and-forget timezone-default response can overwrite a profile save made within the same few milliseconds. The second is that `PATCH /v1/me` may create a first-time user before the body fails validation. The third is the epic note about a rate limit, which needs a BOARD task.
