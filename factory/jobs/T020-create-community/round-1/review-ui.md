VERDICT: CHANGES
# UI design review — T020 round 1

## Findings
- [must-fix] apps/web/src/styles.css:371 — `.community__item` is `align-items: start` with no `max-inline-size`, and `.community__name` / `.community__slug` (lines 379–384) do not set `overflow-wrap`. A name is up to 48 code points and need not contain a space, so the item sizes to its max-content and can scroll sideways in the 360px `.page` (content width is the viewport minus `padding-inline: var(--space-4)`). Set `max-inline-size: 100%` and `min-inline-size: 0` on `.community__item`, and `max-inline-size: 100%` plus `overflow-wrap: anywhere` on `.community__name` and `.community__slug`.
- [must-fix] apps/web/src/styles.css:339 — `.community__control` copies the profile field border, radius, and focus ring, but there is no `[aria-invalid='true']` rule. `CommunitiesView` already sets `aria-invalid` on the name and timezone controls (apps/web/src/features/communities/CommunitiesView.tsx:142 and :164). Match `.profile-form__control[aria-invalid='true']`: `border-color: var(--color-error)`.

## Nits (non-blocking)
- None.

## Verified
- `CommunitiesView` follows `ProfileFormView`. The new screen reuses `.page`, `.auth__button`, and `.site-nav__link`. No new generic component and no new hex colour. Spacing uses `--space-2` and `--space-4`. The raw `0.375rem` radius and `1px` / `3px` / `2px` outline match the existing profile controls; the stylesheet has no radius token.
- New rules are logical only: `margin-block`, `margin-block-start`, `padding-inline`, `padding-inline-start`, `min-block-size`, `max-inline-size`, `text-align: start`, `align-items: start`. No `left` or `right`.
- The name input (CommunitiesView.tsx:138) and the listed community name (:120) both have `dir="auto"`. The timezone `<select>` is `dir="ltr"`, same as profile. Text uses existing tokens on `--color-bg` (`#fbfaf7`): `--color-text` 15.0:1, `--color-muted` 5.7:1, `--color-error` 6.4:1. The page inherits `--font-sans` (Noto Sans Arabic and Noto Sans Ethiopic) and `line-height: 1.5`.
