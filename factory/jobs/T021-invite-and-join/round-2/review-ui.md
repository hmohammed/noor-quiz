VERDICT: CHANGES
# UI design review — T021 round 2

## Findings
- [must-fix] apps/web/src/features/communities/CommunitiesView.tsx:146 — The name, address, role, and Invite control sit in an unstyled `div` so that block can be inert while the panel stays active. `.community__item` (styles.css:375) is the column flex (`gap: var(--space-2)`) that stacked those lines. The wrapper is not a flex container, so the spans run inline and the Invite button (min block size 2.75rem) shares that line. `.community__invite { align-self: start }` (styles.css:399) has no effect, because the button is not a flex item. At 360px they wrap as one run of text. Make the wrapper a column flex with that same gap and `min-inline-size: 0`, and keep the invite panel as the following sibling.

## Nits (non-blocking)
- apps/web/src/styles.css:429 — `.invite-dialog__link` sets no colour. Other links use `color: var(--color-accent)`; this URL uses the browser default blue.
- apps/web/src/features/invites/JoinView.tsx:133 — while joining, the button label and the status line both show `join.joining`.
- apps/web/src/styles.css:450 — `.join__name` is a `p` with no `margin-block: 0`. The title, status lines, and invite-panel text all clear that margin, so the user-agent margin stacks with `.join__title` and `.join__actions`.

The round-1 placement and button-width fixes hold. `InviteDialog` renders inside the active `li.community__item` in `main.page` (CommunitiesView.tsx:143 and :164), so it uses the centered column and the page’s inline padding. Close and Retry use `invite-dialog__button` (`align-self: start`, styles.css:425; InviteDialog.tsx:83 and :119) and stay content-sized. New CSS uses logical properties and the existing tokens (`--space-4`, `--color-muted`, `--color-error`). The Noto Arabic and Ethiopic stack and the root `line-height: 1.5` are unchanged. Community names keep `dir="auto"`.
