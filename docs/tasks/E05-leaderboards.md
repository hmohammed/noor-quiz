# E05 · Leaderboards

Community and cross-community rankings, realtime.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T050

**Community leaderboard**

Phase: P2 · Depends on: [T040](E04-answering.md#t040) · Tags: —
Skills: `api-endpoint`, `firestore-data`

**Goal.** Members see their community's ranking for the season and their own position.

**Scope**

- `memberSeasonStats/{seasonId_userId}` (tenantId, points, answered, correct, lastAnsweredAt) updated in the submit transaction
- `GET /v1/t/:tenantId/seasons/:seasonId/leaderboard?limit=` → top N + my rank
- Ties: points desc, answered desc, earliest last answer
- Web leaderboard page

**Acceptance criteria**

- [ ] Points stay consistent under concurrent submissions (transaction test on emulator)
- [ ] Leaderboard shows display names only (no emails, no userIds)
- [ ] Members of other communities get 403

**Notes**

_(implementer adds notes for the next task here)_

## T051

**Realtime leaderboard view**

Phase: P2 · Depends on: [T050](E05-leaderboards.md#t050) · Tags: `sec`
Skills: `port-adapter`, `firestore-data`

**Goal.** The leaderboard updates live without refresh.

**Scope**

- Server-written `leaderboardViews/{seasonId}` (top 50, denormalised) refreshed after each scored answer (debounced via queue or every N seconds)
- Web `Realtime` port with Firestore listener adapter (read-only) and polling fallback
- Rules: members of the tenant can read their leaderboard view; no writes

**Acceptance criteria**

- [ ] Rules tests: non-members and anonymous users cannot read
- [ ] Web falls back to polling if the listener errors
- [ ] Two-browser e2e: answer in one, rank updates in the other

**Notes**

_(implementer adds notes for the next task here)_

## T052

**Global season and fair cross-community ranking**

Phase: P2 · Depends on: [T050](E05-leaderboards.md#t050) · Tags: —
Skills: `api-endpoint`, `firestore-data`

**Goal.** Communities take part in the platform's global Ramadan season and are ranked fairly regardless of size.

**Scope**

- Platform tenant `global` owns global seasons; communities opt in (`seasonParticipants/{seasonId_tenantId}`)
- `communitySeasonStats` with avg points per active member and participation rate (answered / members)
- Ranking formula in core, documented; `GET /v1/seasons/:seasonId/communities/leaderboard`

**Acceptance criteria**

- [ ] A 6-member family can outrank a 600-member mosque with lower averages (core test)
- [ ] Communities with fewer than 3 active members are listed but marked 'provisional'

**Notes**

_(implementer adds notes for the next task here)_
