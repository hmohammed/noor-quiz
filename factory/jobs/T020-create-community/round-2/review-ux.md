VERDICT: PASS
# UX review — T020 round 2

## Findings
None.

Round-1 must-fixes, checked on `factory/T020-create-community`:

- Long names wrap on a narrow screen. `.community__item` uses `align-items: stretch`, `min-inline-size: 0` and `max-inline-size: 100%`, and `.community__name` / `.community__slug` use `overflow-wrap: break-word` (`apps/web/src/styles.css:375`). The name still has `dir="auto"` and the item keeps `text-align: start`.
- A failed list refresh after a successful create is not shown as a failed create. `refreshList` calls `listMyCommunities` only (`apps/web/src/features/communities/CommunitiesPage.tsx:134`). Failure sets `list-error`, the alert is `community.error.created` ("The community was created, but the list could not be loaded."), and Try again is a `type="button"` wired to that same reload (`CommunitiesView.tsx:196`). The name is cleared, so Create does not send the same community again. A failed create still uses `community.error.save`.

Also checked: signed-out, unavailable, loading, load error, empty, populated list, saving, and invalid name/timezone. User-facing strings go through `t()` and the `community.*` keys are in `en.json`. Inputs have labels, controls are native buttons and links, loading and saving use `role="status"`, errors use `role="alert"`, and buttons and fields are at least 2.75rem with a visible focus outline. New CSS uses logical properties only. The timezone select is `dir="ltr"`. This screen does not show an answer or an explanation.

## Nits (non-blocking)
- Unchanged from round 1, and not a fail: `community.slug` is still "Address" (`apps/web/src/i18n/en.json:73`); a successful create still has no live success message (`CommunitiesView.tsx` only announces "Saving…"); the name input still has no `autoComplete="off"` (`CommunitiesView.tsx:135`).
- `apps/web/src/features/communities/CommunitiesView.tsx:115` — when `list-error` and the stored list is still empty, "You don't belong to a community yet." stays above the form and disagrees with the alert. Hide `community.empty` while status is `list-error`.
- `apps/web/src/features/communities/CommunitiesPage.tsx:153` — Enter or Create on the cleared name replaces `list-error` with `invalid-name` and removes Try again. Keep `list-error` when that submit is invalid so the reload action stays.
