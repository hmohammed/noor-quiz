VERDICT: CHANGES
# UI design review — T013c round 1

## Findings
- [must-fix] apps/web/src/styles.css:189 — `.profile-delete` is a column flex with the default `align-items: stretch`, and the idle start button is a direct child (`DeleteAccountView.tsx`), so it grows to the full profile column (up to `40rem`). Save (`.auth__button` inside `.profile-form__actions`) and the confirm/cancel pair (inside `.profile-delete__actions`) stay content-sized, so the first delete step is a much wider control than the buttons beside it. — Add `align-self: start` to `.profile-delete__start` only. Do not set `align-items: start` on `.profile-delete`; the paragraphs would then size to their max-content and can overflow the column.

## Nits (non-blocking)
None.

## Checked
- `DeleteAccountView` is a small profile view next to `ProfileFormView`. It reuses `.profile__error` for the alert. There is no shared button component; the new button metrics (radius `0.375rem`, `min-block-size: 2.75rem`, `min-inline-size: 6rem`, padding, focus ring, disabled opacity) copy `.auth__button`. The section renders only in the signed-in form state, after `</form>`.
- Spacing uses `--space-*`. The divider matches the header (`color-mix` of `--color-muted` at 25%). The confirm fill is `var(--color-error)` with `#fff` text, the same on-fill literal as `.auth__button` (no on-color token exists). `#a8322d` on `#fff` is about 6.7:1. `#1d2521` and `#a8322d` on `#fbfaf7` are above 4.5:1. Disabled opacity matches `.auth__button:disabled` (inactive text is exempt).
- New rules use `margin-block-start`, `padding-block`, `border-block-start`, `padding-inline`, `min-block-size`, `min-inline-size`, and `gap`. No `left` / `right`.
- `font: inherit` keeps the root stack (`Noto Sans Arabic`, `Noto Sans Ethiopic`) and `line-height: 1.5`. Strings go through `t('profile.delete.*')`.
- `.profile-delete__actions` is `flex-wrap` with `gap`, so confirm and cancel wrap instead of overlapping. The page padding and `max-inline-size: 40rem` keep the English labels inside a 360px viewport. The `h2` sits under the profile `h1`.
