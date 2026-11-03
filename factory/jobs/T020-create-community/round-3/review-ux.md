VERDICT: PASS
# UX review — T020 round 3

## Findings
None.

Round-3 list-error behaviour, checked on `factory/T020-create-community`:

- Create cannot start another community while the list failed to reload. The submit button is `disabled` when `status === 'list-error'` (`apps/web/src/features/communities/CommunitiesView.tsx:186`), and `handleSubmit` returns immediately in that state (`apps/web/src/features/communities/CommunitiesPage.tsx:145`). Editing the name or timezone does not clear `list-error`, so Try again stays on screen.
- The empty-list line is hidden in that state. `community.empty` renders only when the list is empty and status is not `list-error` (`CommunitiesView.tsx:117`).
- Try again still only reloads the list. It is `type="button"` and calls `refreshList`, which calls `listMyCommunities` and does not call `createCommunity` (`CommunitiesPage.tsx:134`, `CommunitiesView.tsx:204`). The alert stays `community.error.created`.

Also checked: signed-out, unavailable, loading, load error, empty, populated list, saving, save error, and invalid name/timezone. User-facing strings go through `t()` and the `community.*` keys are in `en.json`. Inputs have labels, controls are native buttons and links, loading and saving use `role="status"`, errors use `role="alert"`, and buttons and fields are at least 2.75rem with a visible focus outline. Disabled Create uses the shared faded button style. New CSS uses logical properties only. The name keeps `dir="auto"` and wraps inside a stretched list item. The timezone select is `dir="ltr"`. This screen does not show an answer or an explanation.

## Nits (non-blocking)
- Unchanged, and not a fail: `community.slug` is still "Address" (`apps/web/src/i18n/en.json:73`); a successful create still has no live success message (`CommunitiesView.tsx:190` only announces "Saving…"); the name input still has no `autoComplete="off"` (`CommunitiesView.tsx:138`).
