VERDICT: CHANGES
# UX review — T013c round 1

## Findings
- [must-fix] apps/web/src/features/profile/ProfilePage.tsx:107 — The profile form stays editable for the whole delete. Save is disabled only while the form itself is saving (`ProfileFormView.tsx:178`), and Enter in the name field still submits. `updateMe` (`session-context.tsx:126`) never uses the abort controller that `deleteAccount` cancels (`session-context.tsx:55`), so a profile save can arrive as `PATCH /v1/me` after `DELETE /v1/me`. That PATCH runs `requireUser()` and creates a new account, while the page still sends the member to the signed-out home. — When confirm starts, ignore further saves and disable the profile fields. Abort any in-flight `updateMe` in the same cancellation that runs before `deleteMe`.

## Nits (non-blocking)
- apps/web/src/features/profile/DeleteAccountView.tsx:23 — Confirm focuses Cancel, then `deleting` disables that button, so keyboard focus drops. "Deleting…" is only the disabled confirm button's label. The section sets `aria-busy` and has no `role="status"` or `aria-live`, so a screen reader is not told the request is still running. Put the deleting label in a `role="status"` element and move focus there.
- apps/web/src/features/auth/session-context.tsx:143 — If sign-out fails after a successful delete, the promise still resolves and the page goes home, but the banner shows `auth.error` ("Sign-in failed. Please try again.") and a Sign out button (`AuthButtonView.tsx:62`). The account is already gone. Say that it was removed, and that they still need to finish signing out.
- apps/web/src/features/profile/ProfilePage.tsx:138 — A successful delete lands on `/` with the same "Sign in with Google" banner as an ordinary sign-out. The confirm copy has just said the Google account itself is not deleted, so it is easy to think the Noor account is still there. A short translated line that this account was removed, and that signing in again starts fresh, would close that.
