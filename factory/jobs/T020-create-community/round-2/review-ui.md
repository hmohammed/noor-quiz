VERDICT: PASS
# UI design review — T020 round 2

## Findings
- None.

## Nits (non-blocking)
- None.

## Verified
- Round 1 overflow: `.community__item` is `align-items: stretch` with `min-inline-size: 0` and `max-inline-size: 100%` (`apps/web/src/styles.css:375`). `.community__name` and `.community__slug` use `overflow-wrap: break-word` (`:385`). The page content box is definite (`.page` padding and `max-inline-size: 40rem`), and a column flex item’s automatic minimum applies on the block axis, so the stretched inline size is the content width. A 48-character unspaced name and a 40-character unhyphenated slug wrap to two lines. At a 360px viewport the document `scrollWidth` stays 360, including the nav, the list-error actions, and the timezone `<select>`.
- Round 1 error border: `.community__control[aria-invalid='true']` sets `border-color: var(--color-error)` (`styles.css:355`). `CommunitiesView` sets `aria-invalid` on the name input (`CommunitiesView.tsx:142`) and the timezone select (`:164`). Computed border color is `rgb(168, 50, 45)` (`#a8322d`).
- Components: `CommunitiesView` follows `ProfileFormView` and reuses `.page`, `.auth__button`, and `.site-nav__link`. No new generic component.
- Tokens: colour, gap, and margin use `--color-*` and `--space-*`. The `0.375rem` radius and `1px` / `3px` / `2px` outline match `.profile-form__control`. No new hex value.
- Logical CSS: new rules use `margin-block`, `margin-block-start`, `padding-inline`, `padding-inline-start`, `min-block-size`, `min-inline-size`, `max-inline-size`, and `text-align: start`. No `left` or `right`.
- Contrast on `--color-bg` (`#fbfaf7`): `--color-text` 15.0:1, `--color-muted` 5.7:1, `--color-error` 6.4:1. The error border against the page background is the same 6.4:1. The page inherits `--font-sans` (Noto Sans Arabic and Noto Sans Ethiopic) and `line-height: 1.5`. The listed name and the name input keep `dir="auto"`.
