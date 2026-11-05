VERDICT: PASS
# UX review — T021 round 2

Round 1 must-fixes, checked on `origin/main...factory/T021-invite-and-join`:

- The invite panel renders inside that community’s row (`CommunitiesView.tsx:164`). While it is open, the title, the other rows, that row’s Invite button, and the create form are `inert`, and `openInvite` ignores a tap unless the panel is closed, so a second tap does not create another link. When the link is ready, focus moves to it and the row scrolls into view (`InviteDialog.tsx:51`). Escape closes (`InviteDialog.tsx:57`). Close restores focus to the Invite button (`CommunitiesPage.tsx:112`). The community name is in the panel with `dir="auto"` (`InviteDialog.tsx:70`).
- With a ready preview, session `loading` keeps the name, shows “Signing in…”, and disables Join (`JoinPage.tsx:104`, `JoinView.tsx:78`). Session `error` keeps the name, shows “Sign-in failed. Please try again.”, and Try again calls `signIn()` (`JoinPage.tsx:105`, `JoinPage.tsx:92`, `JoinView.tsx:94`). Closing the popup still returns to the signed-out preview.
- Preview HTTP 400 uses the same not-found state as 404 (`JoinPage.tsx:41`): “This invite link is not valid.”, no name, no Join, no retry (`JoinView.tsx:45`).

Also checked against the spec: Invite is only on admin and owner rows; create, copy (link stays visible if copy fails), expiry, and an in-page QR are in the panel; `/join/:token` covers loading, preview, signed-out Join (stays on this URL, does not auto-accept), joining (button disabled), joined (name from accept, no preview refetch), gone (no name, no Join), and a retryable error. Copy is `t()` from `en.json`. New CSS uses logical properties. Names use `dir="auto"` and `overflow-wrap: break-word`. Consent still replaces this page until the signed-in visitor agrees; the public preview is not behind that gate.

## Findings

None.

## Nits (non-blocking)

- apps/web/src/i18n/en.json:92 — “This invite link is not valid.” and “This invite link is no longer available.” still give no next step. A line such as “Ask the person who invited you for a new link.” would help.
- apps/web/src/features/invites/JoinView.tsx:108 — After “You joined”, the next step is only the header Communities link.
- apps/web/src/styles.css:429 — The invite URL has no minimum block size, so a single-line link is under a 44px touch target. Copy, Join, and Close stay on `.auth__button` (2.75rem).
- apps/web/src/features/invites/InviteDialog.tsx:109 — “Copied” only changes the button label. A `role="status"` beside it would announce the copy. Copy failure already keeps the link and uses `role="alert"`.
- apps/web/src/features/invites/JoinView.tsx:133 — While joining, the button and the status line both say “Joining…”.
