VERDICT: CHANGES
# UI design review — T031 round 1

## Findings
- [must-fix] apps/web/src/features/seasons/SeasonsView.tsx:164 — The start date sets `dir="ltr"` on the `.season__meta` line. That line is a stretched flex item, and `.season__item` uses `text-align: start`, so the date’s start edge becomes the physical left. In an RTL page the date sits on the opposite edge from the state line and from an Arabic name (`dir="auto"` on `.season__name`). Keep the meta span in the page direction and put `dir="ltr"` on an inner `<bdi>` around the date text so the line stays on the start edge and the ISO date does not reorder.

## Nits (non-blocking)
- None.

## Verified
- No new generic component. The page reuses `.page` and `.auth__button`. `.season__link` matches `.site-nav__link` (accent, weight 600, 2.75rem target, 3px text-coloured focus ring). Form, list, title, hint, and error classes follow the community screen’s structure and spacing (`--space-2` / `--space-4`, column flex, wrapping actions).
- New rules use existing tokens only: `--color-text`, `--color-muted`, `--color-accent`, `--color-error`, `--color-bg`, `--space-2`, `--space-4`. Radius `0.375rem`, `1px` borders, and `3px` / `2px` focus outlines match the existing controls. No new hex and no `left` / `right` / physical margin or padding.
- Contrast on `--color-bg` (`#fbfaf7`): text 15.03:1, muted 5.72:1, accent link 6.56:1, error 6.37:1, white label on the accent button 6.84:1. All clear WCAG AA for normal text. Season rules do not change the font stack or `line-height: 1.5`, so Arabic and Ethiopic names still use Noto Sans Arabic / Noto Sans Ethiopic.
- The page is capped at `40rem` with `padding-inline: var(--space-4)`. Controls use `max-inline-size: 100%`, list items use `min-inline-size: 0` and `overflow-wrap: anywhere`, and action rows wrap. Name field and listed name use `dir="auto"`. Timezone, date, length, and time controls use `dir="ltr"` on the full-width control, matching the community timezone select.
