VERDICT: PASS
# UX review — T022 round 2

## Findings
None. Round-1 must-fixes are done:
- `.members__confirm-button` / `.members__cancel` and `.community__leave-confirm-button` / `.community__leave-cancel` now match `.profile-delete__confirm` / `.profile-delete__cancel` (`min-block-size: 2.75rem`, padding, colours, `:focus-visible` outline, disabled opacity/cursor).
- In-flight remove uses `t('members.remove.removing')` ("Removing…"); `members.saving` stays on role Save only (covered in `MembersView.test.tsx`).

## Nits (non-blocking)
- apps/web/src/i18n/en.json:118 — `members.leave` is still unused; Leave on the communities list uses `community.leave*`.
- apps/web/src/features/members/MembersView.tsx:51 and apps/web/src/features/communities/CommunitiesView.tsx:81 — Confirm opens on Cancel; when Cancel disables during remove/leave, focus can drop, and busy is only `aria-busy` + label (no `role="status"`). Same as delete-account.
- apps/web/src/features/members/MembersView.tsx:177 — Remove is not disabled while another row's Save runs; `onRemoveStart` no-ops when `savingUserId` is set.

## Checked
- Members view states: loading (`role="status"` + `aria-busy`), signed-out + Sign in, unavailable, load-error + Try again, forbidden with `members.forbidden` and no names, ready list and empty copy.
- Role controls: own row text only; admin editor offers Member–Admin not Owner; owner editor also offers Owner; admin→owner has neither select nor Remove.
- Confirm steps: Remove and Leave use DeleteAccount-style chrome (44px targets, focus ring, disabled); Cancel focused on open; double-submit blocked while `removing` / `leaving`; no `window.confirm`.
- Last-owner: role Save 409 → `members.error.lastOwner`; leave 409 → `community.leave.lastOwner`. Other failures use generic error keys with `role="alert"`.
- Communities entry: Members link only for admin/owner; Leave on every role.
- Copy via `t('…')` in `en.json`; remove in-progress key is `members.remove.removing`.
- RTL / scripts: logical properties, `text-align: start`, `dir="auto"` and `overflow-wrap: break-word` on names.
- Accessibility: real buttons/links, labelled role select, Save / Members / Seasons / Leave start use 44px patterns. No quiz spoilers on these screens.
