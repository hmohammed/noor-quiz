VERDICT: CHANGES
# UX review — T020 round 1

## Findings
- [must-fix] apps/web/src/styles.css:371 — `.community__item` is a column flex with `align-items: start`, so the name, slug and role size to their text and do not wrap. A community name may be 48 characters, and Arabic and Ge'ez glyphs are wide, so on a phone the name runs off the screen instead of wrapping under the title. Stretch the item contents to the page width (`align-items: stretch`, `min-inline-size: 0`, `max-inline-size: 100%`) and set `overflow-wrap: break-word` on `.community__name` and `.community__slug`. Keep `text-align: start` and `dir="auto"` on the name.
- [must-fix] apps/web/src/features/communities/CommunitiesPage.tsx:155 — After `createCommunity` succeeds, a failed `listMyCommunities` uses the same `status: 'error'` as a failed create. The form then shows `community.error.save` ("Could not create the community. Please try again.") while the name is still filled in and the list is unchanged, including the empty line "You don't belong to a community yet." The enabled Create button sends a second create. Treat a failed refresh as a load failure: say the community was created but the list could not be loaded, and make Try again call `listMyCommunities` only.

## Nits (non-blocking)
- apps/web/src/i18n/en.json:72 — `community.slug` is "Address", so the list reads like a street address (`Address masjid-al-noor`). Use a label that means the short link name, and put the slug in its own element with `dir="ltr"` so an Arabic label cannot reorder it.
- apps/web/src/features/communities/CommunitiesView.tsx:185 — "Saving…" is a `role="status"`, then success removes it and the new list item is not in a live region. A screen reader is not told the community appeared. Add a short success status, the way profile says "Profile saved."
- apps/web/src/styles.css:339 — An invalid name or timezone sets `aria-invalid`, but `.community__control` has no error border. Profile fields do (`.profile-form__control[aria-invalid='true']`). Use the same border so the field is visible as the one to fix.
- apps/web/src/features/communities/CommunitiesView.tsx:134 — The name input is `name="name"` with no `autoComplete`. On a phone the browser can fill the person's name. Set `autoComplete="off"`.
