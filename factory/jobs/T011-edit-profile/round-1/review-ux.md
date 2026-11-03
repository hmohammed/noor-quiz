VERDICT: CHANGES
# UX review — T011 round 1

Reviewed `git diff main...factory/T011-edit-profile -- apps/web` in the worktree. Checked `ProfileFormView.tsx`, `ProfilePage.tsx`, `AppLayout.tsx`, `session-context.tsx`, `AuthButton.tsx`, `locales.ts`, `en.json` and `styles.css`. I did not run the app. The e2e specs were not re-run.

What works:
- The flow is short: header "Profile" link, edit, Save.
- All strings go through `t()` and the keys exist in `en.json`.
- The name input has `dir="auto"`, a visible `<label>`, `aria-invalid` and `aria-describedby`. The hint and error are linked to it.
- The locale options carry `lang` and `dir`, and the timezone `<select>` is `dir="ltr"`.
- Double submit is blocked (button disabled, and `handleSubmit` returns early while `saving`).
- The CSS uses logical properties only. Controls and nav links have a 44px minimum block size.

## Findings
- [must-fix] apps/web/src/features/profile/ProfilePage.tsx:49-57 — The unsaved `draft` is kept in the page's own state and is never reset when the signed-in user changes or the session ends. Sign out on `/profile` with an edited but unsaved name, then sign in as someone else. The page stays mounted, so `{ ...valuesOf(me), ...draft }` shows the previous person's typed name, locale or timezone in the new person's form, and `status` can still read "Profile saved." On a shared mosque or phone device this shows one member's text to another and can save it onto the wrong account. — Reset `draft` and `status` when `me.userId` changes or the state leaves `signed-in`. For example, render the form with `key={me.userId}`, or clear both in an effect keyed on the user id.
- [must-fix] apps/web/src/features/profile/ProfileFormView.tsx:62-68 (state `error`) — When the session fails to load (`state.kind === 'error'`), the page shows `profile.error.generic` = "Could not save your profile. Please try again." The user has not saved anything, so the wording is wrong. There is also no retry control on the page, and the `AuthButton` in the header is the only way out. — Add a separate string for a load failure, for example `profile.error.load` ("We couldn't load your profile. Please try again."), and a "Try again" or "Sign in" action or hint. Keep `profile.error.generic` for save failures only.
- [must-fix] apps/web/src/features/profile/ProfilePage.tsx:61-65 — The `unavailable` session state (sign-in not configured) falls into the `signed-out` branch, so the page says "Sign in to edit your profile." while the header says "Sign-in is not available right now." This sends the user to an action that cannot work, which is a dead end. — Map `unavailable` to its own view state with a message such as `profile.unavailable`, or reuse the `auth.unavailable` text. The signed-out view should also point at the header button, or the page should offer its own sign-in action.

## Nits (non-blocking)
- apps/web/src/features/profile/ProfileFormView.tsx:143-147 — The `role="status"` paragraph "Profile saved." is added to the DOM only after saving. Some screen readers do not announce live regions that are inserted already filled. Render an always-present empty `aria-live="polite"` container and fill it.
- apps/web/src/features/profile/ProfileFormView.tsx:126 — The "Saving…" label is not announced. The disabled button also loses keyboard focus in some browsers. Consider `aria-disabled` plus ignoring the click, or the live region above.
- apps/web/src/features/profile/ProfilePage.tsx:70-74 — The inputs stay editable while saving, and success then runs `setDraft({})`. Anything typed during the request is silently discarded. Disable the fields while `saving`, or clear only the fields that were sent.
- apps/web/src/features/profile/ProfileFormView.tsx:101-116 — The label says "Language", but saving it changes nothing visible, because language switching is T080. "Profile saved." can then look like a broken switch. Consider a hint such as "Used for notifications and, soon, the app", or hold the field until T080.
- apps/web/src/features/profile/ProfileFormView.tsx:119-137 — The timezone `<select>` lists about 400 raw IANA names such as `Africa/Addis_Ababa`, with underscores and no search. That is heavy on a phone and a bit technical for members. The "Not set" option reuses `profile.localeUnset`, a key named for locale. Consider a dedicated `profile.timezoneUnset` key, and a short helper line showing the detected browser zone.
- apps/web/src/features/layout/AppLayout.tsx:6-19 — `Link` gives no `aria-current` for the active page. Use `NavLink`, which sets `aria-current="page"`. Also, the short "Home" link is under 44px wide. Add `min-inline-size` or padding. Consider an `aria-label` on the `<nav>` too.
- apps/web/src/features/profile/ProfileFormView.tsx:78-82 — On a name validation error, focus is not moved to the input. The `role="alert"` announces it, so this is acceptable, but focusing the field helps keyboard users.
- apps/web/src/features/profile/ProfileFormView.tsx:78-90 — Consider `maxLength` on the name input. `autoComplete="nickname"` may prefill a nickname that is not a valid display name, so `"name"` may suit better.
- Title and `<html lang>` are unchanged on `/profile`. Not required until T080/T081, but note it for the i18n tasks.
- RTL: the layout uses only logical properties and `dir="auto"` on names, so it should mirror correctly under `dir="rtl"`. I did not see a mirrored e2e check, which the spec defers to T081.
