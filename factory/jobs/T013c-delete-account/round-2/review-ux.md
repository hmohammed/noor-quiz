VERDICT: PASS
# UX review — T013c round 2

## Findings
None.

## Nits (non-blocking)
- apps/web/src/features/profile/DeleteAccountView.tsx:22 — Entering `confirming` focuses Cancel. `deleting` then disables that button, so keyboard focus drops to the page. "Deleting…" is only the disabled confirm button's label. The section sets `aria-busy` and has no `role="status"` or `aria-live`, so a screen reader is not told the request is still running. After a failure, focus is not moved to the alert or to Cancel when the buttons are enabled again. Put the deleting label in a `role="status"` element and move focus there; on `error`, move focus to the alert.
- apps/web/src/features/auth/session-context.tsx:155 — If sign-out fails after a successful delete, the promise still resolves and the page goes home, but the banner shows `auth.error` ("Sign-in failed. Please try again.") and a Sign out button (`AuthButtonView.tsx:62`). The account is already gone. Say that it was removed, and that they still need to finish signing out.
- apps/web/src/features/profile/ProfilePage.tsx:140 — A successful delete lands on `/` with the same "Sign in with Google" banner as an ordinary sign-out. The confirm copy has just said the Google account itself is not deleted, so it is easy to think the Noor account is still there. A short translated line that this account was removed, and that signing in again starts fresh, would close that.
- apps/web/src/features/profile/ProfilePage.tsx:129 — A profile save that was already in flight is aborted when delete starts, and that rejection sets the form status to `error`. The locked form then shows "Could not save your profile. Please try again." while Save is disabled. Ignore a save that delete cancelled, and leave the form status unchanged.

## Checked
- Round 1 must-fix: once delete leaves `idle`, `ProfilePage.tsx` ignores edits and saves, and `ProfileFormView.tsx` disables the name, language, timezone, and Save controls. `updateMe` shares the abort controller `deleteAccount` cancels before `deleteMe`, and it returns before the PATCH if that generation has already moved (`session-context.tsx`).
- Flow: signed-in profile only. Start, then a confirm step whose first focus is Cancel, then delete and `navigate('/', { replace: true })`. Cancel returns to the intro. A failed delete shows `profile.delete.error` in a `role="alert"` and enables Confirm and Cancel again. A second confirm while `deleting` is ignored, and both buttons are disabled.
- Copy: every new string is `t('profile.delete.*')` in `en.json`. The intro and confirm name the profile, language, timezone, privacy-consent record, and sign-in link, say the Google account itself is not deleted, and the confirm says this can't be undone. No answers or memberships. No state renders a raw key. The section is outside the `<form>`.
- Accessibility: real `type="button"` controls, the section is `aria-labelledby` the `h2`, inputs keep their labels, and `:focus-visible` outlines the delete buttons. New buttons use `min-block-size: 2.75rem` (44px at the default root size).
- RTL: new rules use logical properties and `align-self: start`. The actions row is `flex-wrap` with `gap`. The display-name field still has `dir="auto"`. The delete section does not render the person's name.
- The delete UI does not show quiz answers or explanations.
