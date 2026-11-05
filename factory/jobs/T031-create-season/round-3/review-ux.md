VERDICT: PASS
# UX review — T031 round 3

## Findings
None.

Round 2 must-fix, checked on `factory/T031-create-season`: a Hijri suggestion started from `list-error` keeps that state for the whole request, including when the suggestion fails.

- `handleSuggest` records `returnToListError` and does not set `suggesting` in that case (`apps/web/src/features/seasons/SeasonsPage.tsx:209`). Status stays `list-error` while the request runs. The success path sets `list-error` again (`SeasonsPage.tsx:217`). The rejection path sets `list-error`, not `suggest-error` (`SeasonsPage.tsx:221`).
- With `list-error` and an empty list, the empty line is not rendered (`SeasonsView.tsx:157`). Create is `disabled` (`SeasonsView.tsx:298`). The alert stays `season.error.created` (`SeasonsView.tsx:315`).
- Try again is `type="button"` and calls `refreshList`, which calls `listSeasons` only (`SeasonsPage.tsx:175`, `SeasonsView.tsx:317`). A second suggestion click while that request is in flight returns immediately (`SeasonsPage.tsx:204`). `handleSubmit` still returns on `list-error` (`SeasonsPage.tsx:186`). Editing a field does not clear `list-error` (`SeasonsPage.tsx:226`).

Round 1 must-fixes still hold. An open season is `${t('season.state.active')} ${dayIndex}` and `season.state.active` is "Active, day" (`SeasonsView.tsx:70`). This screen has no season edit form.

Also checked: the suggest control is `type="button"`, only for kind Ramadan, and fills start date and length only. Submit is blocked while saving, suggesting, or `list-error`. The form is limited to admin and owner. Loading, signed-out, unavailable, empty, and the first-load error each have a next step. Strings go through `t()` and the `season.*` keys are in `en.json`. Inputs have labels, controls are native buttons, links, and fields, loading uses `role="status"`, errors use `role="alert"`, and buttons, fields, and the Seasons link are at least 2.75rem with a visible focus outline. Season CSS uses logical properties. The name has `dir="auto"` and wraps, including Arabic and Ge'ez. The listed date is in a `bdi` with `dir="ltr"` inside a line that follows the page direction. This screen does not show an answer or an explanation.

## Nits (non-blocking)
- Unchanged from round 1: "Finding a suggestion…" and "Saving…" are only the label of a disabled button, so a slow request is not in a live region (`SeasonsView.tsx:290`, `SeasonsView.tsx:300`). A suggestion that starts from `list-error` never sets `suggesting`, so that button stays enabled and still says "Suggest Hijri start" (`SeasonsView.tsx:287`). If that suggestion fails, the screen does not change. A successful create still has no status, and the new list item is not in a live region.
- Unchanged from round 1: a suggestion drops `hijriYear` (`SeasonsPage.tsx:216`). The admin sees a Gregorian date and length change with no live confirmation of which Hijri year was suggested.
- Unchanged from round 1: the name input has no `autoComplete="off"` (`SeasonsView.tsx:179`).
- Unchanged from round 1: the start-date input is `dir="ltr"` on a full-width row (`SeasonsView.tsx:232`), so in RTL the value sits on the left while the label and an Arabic name align to the start.
- Unchanged from round 1: "Seasons" is a plain `<a href>` (`CommunitiesView.tsx:131`), so the app reloads. The other navigation uses the router `Link`.
- Unchanged from round 1: the form error is one alert ("Check the season name, dates and times.") with no `aria-invalid` and no error border on the field that failed (`SeasonsView.tsx:303`). Length and timezone are not named in that sentence.
