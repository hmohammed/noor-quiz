VERDICT: PASS
# UX review — T011 round 2

Reviewed `git diff main...factory/T011-edit-profile -- apps/web` in the worktree, with a focus on the round-2 commit b30b82d. Read `ProfilePage.tsx`, `ProfileFormView.tsx`, `en.json`, the new e2e test, the profile view tests, and the `session-context.tsx` state and generation logic. I did not run the app or the tests; I rely on the build notes that e2e passes 5/5.

## Round-1 must-fixes

1. Unsaved draft and status carried over to the next user: **fixed.** `ProfilePage` renders `ProfileEditor` only when `state.kind === 'signed-in'`, with `key={state.me.userId}`. The draft and status live inside the editor. Signing out leaves `signed-in` and unmounts it, and another user id remounts it. The new e2e test "an unsaved edit never shows in the next member's form" covers sign-out then sign-in as someone else. It checks that the name field shows the new member's name and that "Profile saved." is absent.
2. Load failure showed the save-failure text with no retry: **fixed.** The `error` view state shows `profile.error.load` ("We couldn't load your profile. Please try again.") in a `role="alert"` paragraph, with a "Try again" button (`profile.retry`) that reloads the page. `profile.error.generic` is now used only for save failures. The view test covers the load error.
3. `unavailable` showed "Sign in to edit your profile.": **fixed.** `unavailable` is now its own view state with `profile.unavailable` ("Sign-in is not available right now, so your profile can't be edited."), and it offers no sign-in action. The signed-out view now has its own `auth.signIn` button wired to `session.signIn`. The view tests cover both.

## New diff checks

- All new strings go through `t()`. The keys `profile.unavailable`, `profile.retry` and `profile.error.load` exist in `en.json`.
- No dead ends in any non-form state: loading shows a status, signed-out has a sign-in button, unavailable explains why, and error has Try again.
- Double submit is still blocked: the button is disabled and `handleSubmit` returns early while saving.
- A save that finishes after sign-out or a user switch cannot write the previous user's profile into the new session. `session-context` checks `generation` before `setState`. The unmounted editor's late `setDraft` and `setStatus` calls do nothing visible.
- The e2e helper now targets the header sign-in button with `getByRole('banner')`, which is correct now that `/profile` shows a second sign-in button when signed out.
- No new CSS or RTL concerns. The new views reuse existing classes (`auth__button`, `profile__status`, `profile__error`).

## Findings
None.

## Nits (non-blocking)
- apps/web/src/features/profile/ProfilePage.tsx:61-63 — The session `error` state also covers a failed sign-in (`hasSession: false`) and a failed sign-out (`hasSession: true`). On `/profile` both show "We couldn't load your profile." A failed sign-in popup is not a load failure, and after a failed sign-out the member is still signed in. Consider branching on `hasSession`, or wording such as "Something went wrong". "Try again" still works, since a reload recovers both.
- apps/web/src/features/profile/ProfilePage.tsx:41 — `reloadPage` is a full `window.location.reload()`. This is acceptable as a retry, but it throws away any unsaved state, and it is a heavy retry on a slow connection. A session-level `retry()` would be lighter.
- Still open from round 1, unchanged and non-blocking: the `role="status"` "Profile saved." paragraph is inserted already filled, so some screen readers may not announce it. The "Saving…" label is not announced. Typing is still allowed while saving, and success then clears the draft. The timezone "Not set" option reuses `profile.localeUnset`. The nav uses `Link` instead of `NavLink` (no `aria-current`). The label "Language" does not change the UI until T080.
