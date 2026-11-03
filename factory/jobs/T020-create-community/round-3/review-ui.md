VERDICT: PASS
# UI design review — T020 round 3

## Findings
- None.

## Nits (non-blocking)
- None.

## Verified
- Round 3 changes only `CommunitiesPage.tsx`, `CommunitiesView.tsx`, and `CommunitiesView.test.tsx`. No new component and no stylesheet edit. Name wrapping and the error border stay as accepted in round 2.
- Create stays an `.auth__button`. While `status === 'list-error'` it is `disabled` and still labelled `community.create` (`CommunitiesView.tsx`). The existing `.auth__button:disabled` rule applies (`opacity: 0.7`, `cursor: progress`), the same treatment as saving and the profile submit button. Name and timezone stay enabled; only the submit control is blocked. The error keeps `community__error` (`color: var(--color-error)`) and Try again stays an enabled `.auth__button`.
- With an empty list and `list-error`, the `community.empty` paragraph is omitted (`null`), so no extra box or margin is left under the title. `.community__title` and `.community__form` are then adjacent blocks, and their `1rem` block margins collapse. No new `left` / `right`, hex, or spacing value.
