# E10 · Organiser studio

Tools for community admins, editors and scholar reviewers.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T100

**Question editor with sources and translations**

Phase: P2 · Depends on: [T033](E03-seasons-questions.md#t033) · Tags: —
Skills: `question-content`, `vertical-slice`, `i18n-rtl`

**Goal.** Editors create and edit questions comfortably in the studio.

**Scope**

- Web editor for mcq/free_text/true_false: locale tabs, sources list (kind + ref), difficulty, topic; 'submit for review'

**Acceptance criteria**

- [ ] Cannot submit for review without a source
- [ ] Editor works in RTL for Arabic content

**Notes**

_(implementer adds notes for the next task here)_

## T101

**Scholar review screen**

Phase: P2 · Depends on: [T100](E10-organiser-studio.md#t100) · Tags: —
Skills: `question-content`, `vertical-slice`

**Goal.** Scholar-reviewers see a queue, read sources, approve or reject with notes.

**Scope**

- Review queue page; approve/reject with notes; history of decisions per question

**Acceptance criteria**

- [ ] Only scholar-reviewers see approve/reject
- [ ] Rejected questions return to editors with notes visible

**Notes**

_(implementer adds notes for the next task here)_

## T102

**Season calendar and scheduling view**

Phase: P2 · Depends on: [T101](E10-organiser-studio.md#t101) · Tags: —
Skills: `vertical-slice`

**Goal.** Admins see the whole season as a calendar and fill gaps.

**Scope**

- Calendar grid of days with assigned question per track; assign from approved list; gaps highlighted

**Acceptance criteria**

- [ ] Days without a question within the next 7 days are flagged
- [ ] Assigning uses the T033 endpoint (no new write paths)

**Notes**

_(implementer adds notes for the next task here)_

## T103

**Participation analytics for organisers**

Phase: P3 · Depends on: [T050](E05-leaderboards.md#t050) · Tags: —
Skills: `api-endpoint`, `vertical-slice`

**Goal.** Admins see daily active members, answers per day and drop-off.

**Scope**

- Daily rollup `communityDailyStats` written by a scheduled worker; analytics page with simple charts (own SVG, no chart library)

**Acceptance criteria**

- [ ] Numbers match raw counts in an emulator test with seeded data
- [ ] No individual answers exposed in analytics

**Notes**

_(implementer adds notes for the next task here)_

## T104

**Community data export**

Phase: P3 · Depends on: [T042](E04-answering.md#t042) · Tags: `sec`
Skills: `port-adapter`, `api-endpoint`

**Goal.** Owners download all their community's data — our anti-lock-in promise to customers.

**Scope**

- Worker builds a zip (JSON + CSV) via BlobStore; signed URL valid 24h; owner-only endpoint

**Acceptance criteria**

- [ ] Export contains only that tenant's data (test with two tenants)
- [ ] Link expires

**Notes**

_(implementer adds notes for the next task here)_

## T105

**Community branding**

Phase: P3 · Depends on: [T091](E09-billing.md#t091) · Tags: —
Skills: `entitlements-billing`, `vertical-slice`

**Goal.** Paid communities add their logo and accent colour.

**Scope**

- Upload logo via BlobStore (size/type limits); accent colour validated for contrast; gated by `branding` feature

**Acceptance criteria**

- [ ] Free communities see an upgrade prompt
- [ ] Low-contrast colours rejected

**Notes**

_(implementer adds notes for the next task here)_
