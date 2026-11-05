VERDICT: PASS
# UI design review — T031 round 2

## Findings
- None. The round 1 must-fix is fixed: `apps/web/src/features/seasons/SeasonsView.tsx:168` puts `dir="ltr"` on an inner `<bdi>` around `season.startDate`. The `.season__meta` span stays in the page direction, so `text-align: start` on `.season__item` keeps the date on the start edge in Arabic.

## Nits (non-blocking)
- None.

## Verified
- No new generic component. The page reuses `.page` and `.auth__button`. `.season__link` matches `.site-nav__link` (accent, weight 600, 2.75rem target, 3px text-coloured focus ring). Form, list, title, hint, and error classes follow the community screen (`--space-2` / `--space-4`, column flex, wrapping actions). The list-error alert and Try again button sit in that same actions row.
- New rules use existing tokens only: `--color-text`, `--color-muted`, `--color-accent`, `--color-error`, `--color-bg`, `--space-2`, `--space-4`. Radius `0.375rem`, `1px` borders, and `3px` / `2px` focus outlines match the existing controls. No new hex. No `left` / `right` / physical margin or padding in the new CSS.
- Contrast on `--color-bg` (`#fbfaf7`): text 15.03:1, muted 5.72:1, accent link 6.56:1, error 6.37:1, white label on the accent button 6.84:1. All clear WCAG AA for normal text. Season rules do not change the font stack or `line-height: 1.5`, so Arabic and Ethiopic names still use Noto Sans Arabic / Noto Sans Ethiopic.
- The page is capped at `40rem` with `padding-inline: var(--space-4)`. Controls use `max-inline-size: 100%`, list items use `min-inline-size: 0` and `overflow-wrap: anywhere`, and action rows wrap. Name field and listed name use `dir="auto"`. Timezone, date, length, and time controls use `dir="ltr"` on the full-width control, matching the community timezone select. The date in the list is isolated on the inner `bdi` only.
