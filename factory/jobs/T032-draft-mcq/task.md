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
