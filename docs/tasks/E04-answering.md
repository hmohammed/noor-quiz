# E04 · Answering and results

Members answer today's question, see results after close, and their history.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T040

**Answer today's multiple-choice question**

Phase: P1 · Depends on: [T034](E03-seasons-questions.md#t034) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`, `vertical-slice`

**Goal.** A member taps an answer and immediately sees whether it was right.

**Scope**

- `answers/{questionId_userId}` (tenantId, seasonId, dayIndex, choice, correct, points, submittedAt)
- Use case `submitAnswer` — validates open window via Clock, one answer per user per question, scores MCQ in core
- `POST /v1/t/:tenantId/questions/:questionId/answers`
- Web: choices as buttons, result state after submit

**Acceptance criteria**

- [ ] Second submission → 409 `ALREADY_ANSWERED` (also under concurrent requests)
- [ ] Submitting when closed or for a non-today question → 409 `CLOSED`
- [ ] Non-member → 403; day/time/score in the request body are ignored
- [ ] Instant result shows correct/incorrect but not the explanation until close
- [ ] e2e happy path

**Notes**

_(implementer adds notes for the next task here)_

## T041

**Reveal: correct answer and explanation after close**

Phase: P2 · Depends on: [T040](E04-answering.md#t040) · Tags: `sec`
Skills: `api-endpoint`, `vertical-slice`

**Goal.** After the question closes members see the right answer, the explanation and the source.

**Scope**

- `GET /v1/t/:tenantId/questions/:questionId/result` → my answer + correct answer + explanation + sources, only when closed
- Web 'Yesterday's answer' card and post-close view of today

**Acceptance criteria**

- [ ] Before close → 403 `NOT_REVEALED` (FakeClock test at close-1min and close)
- [ ] Works for members who did not answer (shows answer without their choice)

**Notes**

_(implementer adds notes for the next task here)_

## T042

**My season history**

Phase: P2 · Depends on: [T041](E04-answering.md#t041) · Tags: —
Skills: `api-endpoint`, `vertical-slice`

**Goal.** Members see each past day: question title, their answer, points.

**Scope**

- `GET /v1/t/:tenantId/seasons/:seasonId/me/history`
- Web history page with a day grid (answered / missed / upcoming)

**Acceptance criteria**

- [ ] Only my own answers are returned
- [ ] Upcoming days show no titles (no spoilers)

**Notes**

_(implementer adds notes for the next task here)_

## T043

**Rate limiting on write endpoints**

Phase: P2 · Depends on: [T040](E04-answering.md#t040) · Tags: `sec`
Skills: `port-adapter`, `api-endpoint`

**Goal.** Protect submit, join and invite endpoints from abuse.

**Scope**

- Port `RateLimiter.hit(key, window, max)`; Firestore adapter (fixed window counters) and in-memory fake
- Middleware `rateLimit()` applied to answers, invites accept, community create

**Acceptance criteria**

- [ ] Exceeding the limit returns 429 with `Retry-After`
- [ ] Limits are per user and per IP; config-driven

**Notes**

_(implementer adds notes for the next task here)_
