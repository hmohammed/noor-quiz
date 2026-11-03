VERDICT: PASS
# UI design review — T013c round 3

## Findings
None.

## Nits (non-blocking)
- apps/web/src/styles.css:157 — While delete is open, the name, language and timezone controls are `disabled`, but `.profile-form__control` sets `color` and `background-color` and has no `:disabled` rule, so they keep the same fill and text as an editable field. Save does fade, through `.auth__button:disabled`. — Add `.profile-form__control:disabled { opacity: 0.7; }` so the locked fields match the faded Save button. Do not reuse `cursor: progress`; that cursor means a save is running.

## Checked
- Rebase onto main (consent screen) only appends `.profile-delete*` after the footer rule. Consent rules (`.consent`, `.consent__actions`, `.privacy__*`) are intact and do not share class names with the delete section. `DeleteAccountView` still renders as `afterForm`, after `</form>`, inside `.page`, and only in the signed-in form state.
- Round 1: `.profile-delete__start` has `align-self: start` (styles.css:279). `.profile-delete` does not set `align-items`, so the intro and confirm paragraphs still stretch to the column.
- `DeleteAccountView` stays a small profile view beside `ProfileFormView`. The alert reuses `.profile__error`. There is still no shared button; the new button metrics (radius `0.375rem`, `min-block-size: 2.75rem`, `min-inline-size: 6rem`, padding, focus ring, disabled opacity) copy `.auth__button`. Outline start/cancel buttons are separate from `.auth__button` so Cancel is not the accent fill. The locked prop reuses that button's existing `:disabled` rule for Save.
- Spacing is `--space-*`. The divider is the header's `color-mix` of `--color-muted` at 25%. Confirm fill is `var(--color-error)` with `#fff`, the same on-fill literal as `.auth__button` (no on-color token). Contrast: `#fff` on `#a8322d` is 6.7:1; `#1d2521` on `#fbfaf7` is 15.0:1; `#a8322d` on `#fbfaf7` is 6.4:1; the outline border `#5b6660` on `#fbfaf7` is 5.7:1. Disabled opacity matches the existing button rule (inactive text is exempt).
- New rules use `margin-block-start`, `padding-block`, `border-block-start`, `padding-inline`, `min-block-size`, `min-inline-size`, `gap`, and `align-self: start`. No `left` / `right`.
- `font: inherit` keeps the root stack (`Noto Sans Arabic`, `Noto Sans Ethiopic`) and `line-height: 1.5`. Copy is `t('profile.delete.*')`. The `h2` sits under the profile `h1`.
- `.profile-delete__actions` is `flex-wrap` with `gap`. At 360px, `.page` padding leaves about 328px. English "Delete my account" plus padding is under that, and the confirm/cancel pair fits on one row and wraps instead of overlapping. The section is a column under a `max-inline-size: 40rem` page, so the intro wraps with no horizontal scroll.
