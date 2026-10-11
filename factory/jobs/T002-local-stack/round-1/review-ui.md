VERDICT: PASS
# UI design review — T002 round 1

Scope: first home page and first CSS (`apps/web/src/styles.css`, `HomePage.tsx`, `index.html`, `main.tsx`). Verified from `git show factory/T002-local-stack:<file>`.

## Findings
None. Nothing must-fix.

Checks:
1. Components: no existing components yet; none added beyond `HomePage`. OK.
2. Tokens: hex values appear only as `:root` variable definitions (styles.css:3-7). Rules below use `var(--space-*)` and `var(--color-*)`. No magic values elsewhere. OK.
3. Logical CSS: `max-inline-size`, `margin-inline`, `padding-inline`, `padding-block`, `margin-block`. No `left`/`right`. OK.
4. Contrast (computed against `--color-bg` #fbfaf7): muted #5b6660 about 5.8:1, ok #1f7a4d about 5.1:1, error #a8322d about 6.4:1, text #1d2521 well above. All meet AA for normal text. Font stack (styles.css:11-13) includes 'Noto Sans Arabic' and 'Noto Sans Ethiopic' plus `system-ui` and a generic fallback. `line-height: 1.5` is acceptable for Arabic.
5. Responsive: single column, `max-inline-size: 40rem` with `padding-inline: 1rem`, viewport meta present, no fixed widths, so no horizontal scroll at 360px.
6. Consistency: first screen, nothing to compare. The three states (checking, ok, unreachable) differ in text as well as colour.

## Nits (non-blocking)
- apps/web/src/features/home/HomePage.tsx:31 — the status `<p>` changes text after load but is not a live region; add `role="status"` (or `aria-live="polite"`) so screen readers announce the result.
- apps/web/src/styles.css:15-18 — token set is minimal (no font-size, radius or line-height tokens). Add them when the first component needs them. Consider `--line-height-base` and a slightly looser value (about 1.6) once Arabic body text is on screen.
- apps/web/src/styles.css:2 — consider `color-scheme: light` so form controls and scrollbars match until dark mode is designed.
- apps/web/index.html:2 — `dir="ltr"` and `lang="en"` are hard-coded. Fine for now; T080 (i18n) must set them from the active locale.
