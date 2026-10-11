# E03 · Seasons and questions

The season engine and the question bank with sources and review status.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T030

**Season rules in core: days, open and close times**

Phase: P1 · Depends on: [T003](E00-foundation.md#t003) · Tags: —
Skills: `vertical-slice`

**Goal.** Pure, tested logic for when a season day starts and when its question opens and closes — the old app's biggest source of bugs.

**Scope**

- `Season` type: startDate (local date), lengthDays, timezone, opensAtLocal (HH:mm), closesAtLocal (HH:mm)
- Functions: `seasonState(season, now)`, `dayIndexAt(season, now)`, `questionWindow(season, dayIndex)`, `isOpen(...)`
- Hijri helper to suggest a Ramadan start date (Umm al-Qura via Intl) — suggestion only, admins confirm

**Acceptance criteria**

- [ ] Table tests in Europe/Stockholm, Africa/Addis_Ababa, America/Toronto, Asia/Riyadh including a DST change night
- [ ] Close time after midnight (e.g. 01:00) is handled
- [ ] Day index never exceeds lengthDays; pre/post states correct at boundaries (±1 minute)

**Notes**

_(implementer adds notes for the next task here)_

## T031

**Create a season for a community**

Phase: P1 · Depends on: [T030](E03-seasons-questions.md#t030), [T020](E02-communities.md#t020) · Tags: —
Skills: `api-endpoint`, `firestore-data`

**Goal.** An admin sets up 'Ramadan 1448' with dates and times for their community.

**Scope**

- `seasons/{seasonId}` (tenantId, name, kind: ramadan|dhul_hijjah|muharram|weekly|custom, rules from T030)
- `POST /v1/t/:tenantId/seasons` (admin+), `GET .../seasons`, `PATCH` (only before start, except closesAt)
- Web: minimal season form with Hijri start suggestion

**Acceptance criteria**

- [ ] Editors and members cannot create seasons
- [ ] Start date and length can't be changed once the season has started (409)
- [ ] e2e: admin creates a season and sees it listed with its state

**Notes**

_(implementer adds notes for the next task here)_

## T032

**Draft multiple-choice questions**

Phase: P1 · Depends on: [T031](E03-seasons-questions.md#t031) · Tags: —
Skills: `api-endpoint`, `firestore-data`, `question-content`

**Goal.** Editors write MCQ questions with sources; answers are never exposed to members.

**Scope**

- Contracts: `Question` (full) and `MemberQuestionView` (no answer, no explanation)
- `questions/{questionId}` per the question-content skill; type `mcq` only for now
- `POST/PATCH/GET /v1/t/:tenantId/questions` (editor+); status starts `draft`

**Acceptance criteria**

- [ ] Members get 403 on question endpoints
- [ ] Creating without at least 2 choices or a valid choiceIndex fails validation
- [ ] A test asserts `MemberQuestionView.parse` strips `answer`

**Notes**

_(implementer adds notes for the next task here)_

## T033

**Review status and schedule questions to season days**

Phase: P1 · Depends on: [T032](E03-seasons-questions.md#t032), [T022](E02-communities.md#t022) · Tags: `sec`
Skills: `api-endpoint`, `question-content`

**Goal.** Only approved questions go live, approved by a scholar-reviewer, and each season day gets one question.

**Scope**

- `POST .../questions/:id/review` {status: in_review|approved|rejected, notes} — approve/reject requires `scholar-reviewer`
- `schedule/{seasonId_dayIndex}` → questionId; `PUT .../seasons/:seasonId/schedule/:dayIndex`
- Audit fields: reviewedBy, reviewedAt

**Acceptance criteria**

- [ ] Scheduling a non-approved question returns 409
- [ ] Editors can submit for review but not approve; scholar-reviewers can approve
- [ ] The same question cannot be scheduled twice in one season

**Notes**

_(implementer adds notes for the next task here)_

## T034

**Today's question for members**

Phase: P1 · Depends on: [T033](E03-seasons-questions.md#t033) · Tags: `sec`
Skills: `api-endpoint`, `vertical-slice`, `i18n-rtl`

**Goal.** A member opens the app and sees today's question for their community, or a clear 'not yet / season over' state.

**Scope**

- Use case `getToday(tenantId, userId)` using Clock + season rules + schedule
- `GET /v1/t/:tenantId/today` → `{ state, dayIndex, question?: MemberQuestionView, closesAt }`
- Web 'Today' card on community home with countdown to close

**Acceptance criteria**

- [ ] Before open: state `not_open` and no question body; after close: state `closed`
- [ ] Response never contains the answer (contract parse + explicit test)
- [ ] FakeClock tests at open-1min, open, close-1min, close
- [ ] e2e: seeded season shows today's question

**Notes**

_(implementer adds notes for the next task here)_

## T035

**Import questions from JSON (incl. old data.json)**

Phase: P2 · Depends on: [T032](E03-seasons-questions.md#t032) · Tags: —
Skills: `question-content`

**Goal.** Bulk-load question banks, and bring last year's 30 questions in as drafts.

**Scope**

- `scripts/import-questions.ts <file> --tenant=<id> [--dry-run]` validates against contracts
- Mapper for the old `data.json` format → `free_text` drafts with empty sources flagged (stored even before T070 exists, with type free_text)

**Acceptance criteria**

- [ ] Dry-run prints a validation report and writes nothing
- [ ] Running twice does not duplicate (idempotent by content hash)
- [ ] Old data.json imports 30 drafts, all `reviewStatus: draft`

**Notes**

_(implementer adds notes for the next task here)_
