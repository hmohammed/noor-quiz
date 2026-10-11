# E12 · Live iftar rounds

Kahoot-style live quiz with projector view.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T120

**Live round: host creates a lobby**

Phase: P3 · Depends on: [T033](E03-seasons-questions.md#t033) · Tags: —
Skills: `api-endpoint`, `firestore-data`

**Goal.** An admin starts a live iftar round from approved questions and gets a join code.

**Scope**

- `liveRounds/{roundId}` (tenantId, questionIds, state: lobby|question|reveal|ended, currentIndex, joinCode)
- Endpoints to create, open lobby, list players

**Acceptance criteria**

- [ ] Join codes are unique among active rounds
- [ ] Only admin+ can host

**Notes**

_(implementer adds notes for the next task here)_

## T121

**Live round: players answer with a timer**

Phase: P3 · Depends on: [T120](E12-live-rounds.md#t120) · Tags: `sec`
Skills: `api-endpoint`

**Goal.** Players join with the code and answer each question within the time limit; speed earns points.

**Scope**

- Host advances; server records question start time via Clock; `liveAnswers` with server receive time
- Speed points computed in core from server times only

**Acceptance criteria**

- [ ] Answers after the timer are rejected
- [ ] Client-sent timestamps ignored (test)
- [ ] One answer per player per question

**Notes**

_(implementer adds notes for the next task here)_

## T122

**Live round realtime views and projector screen**

Phase: P3 · Depends on: [T121](E12-live-rounds.md#t121), [T051](E05-leaderboards.md#t051) · Tags: —
Skills: `firestore-data`, `vertical-slice`

**Goal.** Players see questions live; a projector view shows the live leaderboard.

**Scope**

- Server-written `liveRoundViews/{roundId}` (no answers until reveal); Realtime adapter on web
- Player screen and full-screen projector route

**Acceptance criteria**

- [ ] Rules: only members read the view; correct answer absent before reveal (rules + contract tests)
- [ ] Two-browser e2e: host advances, player sees next question

**Notes**

_(implementer adds notes for the next task here)_

## T123

**Live round points into season stats**

Phase: P4 · Depends on: [T122](E12-live-rounds.md#t122) · Tags: —
Skills: `vertical-slice`

**Goal.** Live rounds count toward the season with a configurable bonus.

**Scope**

- Season setting `liveRoundBonus`; on round end, add bonus points to memberSeasonStats idempotently

**Acceptance criteria**

- [ ] Ending a round twice adds points once
- [ ] Bonus 0 disables it

**Notes**

_(implementer adds notes for the next task here)_
