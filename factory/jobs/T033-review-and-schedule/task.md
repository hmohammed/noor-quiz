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

Tags: sec
Phase: P1
