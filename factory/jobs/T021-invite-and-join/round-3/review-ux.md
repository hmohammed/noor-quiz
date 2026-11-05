VERDICT: PASS
# UX review — T021 round 3

Round 3 only stacks the community row. `.community__summary` is a column flex with `gap: var(--space-2)` and `min-inline-size: 0` (`styles.css:385`). Inside it, in order, are the name (`dir="auto"`), the address, the role, and the Invite button (`CommunitiesView.tsx:146`). The invite panel is the next sibling, so it stays under that row and stays active while the summary is inert. Invite remains a `type="button"` with `.auth__button` (`min-block-size: 2.75rem`, `min-inline-size: 6rem`) and `align-self: start`, so it sits on its own line at the start edge and keeps a 44px target. `text-align: start` on the row follows `dir`. Names and addresses still use `overflow-wrap: break-word`.

The round-1 and round-2 must-fixes are unchanged: the panel is still in that community’s row, a second tap cannot open another link, and the join states were not edited in this commit.

## Findings

None.

## Nits (non-blocking)

- apps/web/src/i18n/en.json:92 — “This invite link is not valid.” and “This invite link is no longer available.” still give no next step. A line such as “Ask the person who invited you for a new link.” would help.
- apps/web/src/features/invites/JoinView.tsx:113 — After “You joined”, the next step is only the header Communities link.
- apps/web/src/styles.css:436 — The invite URL has no minimum block size, so a single-line link is under a 44px touch target. Copy, Join, and Close stay on `.auth__button` (2.75rem).
- apps/web/src/features/invites/InviteDialog.tsx:109 — “Copied” only changes the button label. A `role="status"` beside it would announce the copy. Copy failure already keeps the link and uses `role="alert"`.
- apps/web/src/features/invites/JoinView.tsx:133 — While joining, the button and the status line both say “Joining…”.
