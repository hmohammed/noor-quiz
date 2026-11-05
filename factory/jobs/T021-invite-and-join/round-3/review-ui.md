VERDICT: PASS
# UI design review — T021 round 3

## Findings
None. `.community__summary` (`apps/web/src/styles.css:385`) is a column flex with `gap: var(--space-2)` and `min-inline-size: 0`. It wraps the name, address, role, and Invite button (`CommunitiesView.tsx:146`). The invite panel is the following sibling (`CommunitiesView.tsx:164`), inside `li.community__item` in `main.page`. The Invite button is a flex item, so `align-self: start` keeps it content-sized.

## Nits (non-blocking)
- apps/web/src/styles.css:436 — `.invite-dialog__link` sets no colour. Other links use `color: var(--color-accent)`; this URL uses the browser default blue.
- apps/web/src/features/invites/JoinView.tsx:133 — while joining, the button label and the status line both show `join.joining`.
- apps/web/src/styles.css:457 — `.join__name` is a `p` with no `margin-block: 0`. The title, status lines, and invite-panel text all clear that margin, so the user-agent margin stacks with `.join__title` and `.join__actions`.

Close and Retry still use `invite-dialog__button` (`align-self: start`). New CSS uses logical properties and the existing tokens (`--space-2`, `--space-4`, `--color-muted`, `--color-error`). The Noto Arabic and Ethiopic stack and the root `line-height: 1.5` are unchanged. Community names keep `dir="auto"`. The QR stays at most the column width (`max-inline-size: 100%`).
