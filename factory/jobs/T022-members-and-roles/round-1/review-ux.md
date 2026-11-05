VERDICT: CHANGES
# UX review — T022 round 1

## Findings
- [must-fix] apps/web/src/styles.css:425 and apps/web/src/styles.css:674 — Spec asks for a Remove confirm step in the same style as `DeleteAccountView`, and Leave to use that same confirm step. `.community__leave-confirm-button` / `.community__leave-cancel` and `.members__confirm-button` / `.members__cancel` only set `align-self: start`. They have no `min-block-size: 2.75rem`, no padding, no `:focus-visible` outline, and no disabled opacity (unlike `.profile-delete__confirm` / `.profile-delete__cancel` at `styles.css:260`). On a phone those confirm and cancel controls stay under a 44px target and lose visible keyboard focus. Style them like the delete-account confirm pair (size, padding, focus ring, disabled state).
- [must-fix] apps/web/src/features/members/MembersView.tsx:196 — While a remove is in flight the confirm button label switches to `t('members.saving')` ("Saving…"). That copy belongs to a role Save. Leave correctly uses `community.leave.leaving` ("Leaving…"). A person confirming a removal on a slow connection is told the app is saving. Add a remove-in-progress key (for example `members.remove.removing`) and use it here; keep `members.saving` for Save only.

## Nits (non-blocking)
- apps/web/src/i18n/en.json:117 — `members.leave` ("Leave community") is listed in the spec keys but never used. Leave on the communities list uses `community.leave*`. Drop the unused key or wire it if a Members-page leave entry was intended.
- apps/web/src/features/members/MembersView.tsx:51 and apps/web/src/features/communities/CommunitiesView.tsx:81 — Entering confirm focuses Cancel (good). When remove/leave then disables Cancel, focus can drop to the page, and the only busy signal is `aria-busy` plus the button label change (no `role="status"`). Same pattern as delete-account; a short live status would help screen readers.
- apps/web/src/features/members/MembersView.tsx:177 — The Remove control is not disabled while another row's Save is running; `onRemoveStart` no-ops when `savingUserId` is set. Disabling Remove (and Save on other rows) would make the block visible.

## Checked
- Members view states: loading (`role="status"` + `aria-busy`), signed-out + Sign in, unavailable (no button), load-error + Try again, forbidden with `members.forbidden` and no member names, ready list and empty copy. `MembersPage` maps session kinds and 403 from list to those states.
- Role controls: own row is text only (no select, no Remove). Admin → editor offers Member through Admin, not Owner. Owner → editor also offers Owner. Admin → owner has neither select nor Remove. Options come from `member-access.ts` using the actor role from `GET /v1/me/communities`.
- Confirm steps: Remove and Leave both require an inline confirm before calling the handler (no `window.confirm`). Cancel is focused on open; double-submit is blocked while `removing` / `leaving`.
- Last-owner copy: role Save 409 → `members.error.lastOwner`; leave 409 → `community.leave.lastOwner` and the community row stays. Other save/remove/leave failures use the generic error keys with `role="alert"`.
- Communities entry points: Members link only for `admin` / `owner`; Leave on every role; Seasons link unchanged.
- Copy: user-facing strings go through `t('…')` with keys in `en.json` (aside from the unused `members.leave` nit). Role labels reuse `community.role.*`.
- RTL / scripts: new rules use logical properties and `text-align: start`; member and community names use `dir="auto"` and `overflow-wrap: break-word` on member names. Font stack still includes Noto Sans Arabic and Noto Sans Ethiopic.
- Accessibility otherwise: real buttons/links, role `<select>` has a label via `htmlFor`, Save uses `.auth__button` (44px), Members/Seasons links use `.season__link` (44px). No quiz answers or spoilers on these screens.
