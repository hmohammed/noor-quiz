VERDICT: CHANGES
# UI design review — T022 round 1

## Findings
- [must-fix] apps/web/src/styles.css (`.members__confirm-button`, `.members__cancel`) and MembersView.tsx:190–206 — Confirm/cancel for remove only set `align-self: start`. They have no `font`, colours, `min-block-size` / padding, focus ring, or disabled styles. Spec asks for the same confirm step style as `DeleteAccountView` (`.profile-delete__confirm` / `__cancel`: inherit font, 2.75rem min height, error-filled confirm, outlined cancel, focus-visible, disabled opacity). — Mirror those rules (and focus/disabled states) onto the members confirm pair.
- [must-fix] apps/web/src/styles.css (`.community__leave-confirm-button`, `.community__leave-cancel`) and CommunitiesView.tsx:220–237 — Leave confirm/cancel have the same gap: layout only, no button chrome. Spec ties leave to the same confirm pattern. — Style them like `.profile-delete__confirm` / `__cancel` (destructive confirm + muted outline cancel).

## Nits (non-blocking)
- apps/web/src/styles.css:`.members__status` — Unlike `.season__status` / `.community__status`, status copy is not `color: var(--color-muted)`; loading/empty text sits at full text colour.
- Verified OK otherwise: `members__*` / leave rules use CSS variables and logical properties only (no physical `left`/`right`); list/item/field/control patterns match seasons/communities; `dir="auto"` on names; column layout + `max-inline-size: 100%` + wrapping action rows suit ~360px; error/accent contrast uses existing tokens; no new shared components needed (feature BEM + `auth__button` / `season__link` reuse).
