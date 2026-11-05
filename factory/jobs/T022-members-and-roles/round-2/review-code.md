VERDICT: PASS
# Code review — T022 round 2

## Findings
(none)

## Acceptance tests
1–18. ok — unchanged from round 1 PASS; round 2 touches only web CSS / i18n / MembersView busy copy. Spec tests 17–18 still covered: `MembersView.test.tsx` asserts confirm step and now asserts in-flight remove uses `members.remove.removing` (not `members.saving`); `CommunitiesView.test.tsx` leave/Members-link cases unchanged. View tests re-run: 29 passed.

## Hard rules
1–11. ok — no core/API/Firestore/rules/deps changes in round 2; prior round-1 verdict still applies. Round 2 CSS uses logical properties only (`padding-inline` / `padding-block` / `min-block-size` / `min-inline-size`); remove busy copy goes through `t('members.remove.removing')`.

## Correctness notes
- `.members__confirm-button` / `.members__cancel` and `.community__leave-confirm-button` / `.community__leave-cancel` now mirror `.profile-delete__confirm` / `__cancel` (font inherit, 2.75rem min height, error-filled confirm, outlined cancel, focus-visible, disabled opacity).
- Save still uses `members.saving`; remove in-flight uses the new `members.remove.removing` key.

## Scope
Round 2 limited to the UI/UX must-fixes (styles.css, en.json, MembersView + test). No unrelated refactors.

## Nits (non-blocking)
- Spec’s English key list did not name `members.remove.removing`; the extra key is justified by the round-1 UX finding and keeps strings out of components.
