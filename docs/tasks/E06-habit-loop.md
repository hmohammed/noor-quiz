# E06 · Habit loop

Streaks, reminders and sharing — the retention engine.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T060

**Streaks with a weekly mercy token**

Phase: P2 · Depends on: [T040](E04-answering.md#t040) · Tags: —
Skills: `vertical-slice`

**Goal.** Members build a daily streak; missing one day per week can be covered automatically.

**Scope**

- Core: streak update on answer; one mercy token per ISO week per member per season, applied automatically to a single missed day
- Stored on `memberSeasonStats` (currentStreak, bestStreak, tokensUsed)
- Web: streak badge on home and history

**Acceptance criteria**

- [ ] Table tests: consecutive days, one miss covered, two misses in a week break the streak, timezone boundaries
- [ ] Streak is computed server-side only

**Notes**

_(implementer adds notes for the next task here)_

## T061

**Web push opt-in**

Phase: P2 · Depends on: [T011](E01-identity-privacy.md#t011) · Tags: —
Skills: `port-adapter`, `api-endpoint`

**Goal.** Members allow notifications on their device.

**Scope**

- Port `Notifier` (channel-agnostic) and `pushTokens/{tokenHash}` (userId, platform, createdAt, lastSeenAt)
- FCM adapter for web push; service worker in apps/web
- `POST /v1/me/push-tokens`, `DELETE ...`; settings toggle in profile
- Notification preferences on user: reminderTime (local HH:mm), channels

**Acceptance criteria**

- [ ] Test send to my device from profile works (manual check noted in PR + adapter contract test with fake)
- [ ] Invalid/expired tokens are removed after a failed send

**Notes**

_(implementer adds notes for the next task here)_

## T062

**Daily reminder at my chosen time**

Phase: P2 · Depends on: [T061](E06-habit-loop.md#t061), [T034](E03-seasons-questions.md#t034) · Tags: —
Skills: `port-adapter`

**Goal.** Each member gets 'Today's question is open' at the time they picked, in their timezone.

**Scope**

- Port `Scheduler`; Cloud Scheduler adapter triggers a worker every 15 minutes
- Worker selects members whose local reminder time falls in the window and who haven't answered; sends via Notifier
- `reminderLog/{date_userId}` for idempotency

**Acceptance criteria**

- [ ] Running the worker twice in a window sends once
- [ ] Members who already answered get no reminder
- [ ] FakeClock tests across timezones

**Notes**

_(implementer adds notes for the next task here)_

## T063

**Email channel as fallback**

Phase: P2 · Depends on: [T061](E06-habit-loop.md#t061) · Tags: —
Skills: `port-adapter`

**Goal.** Members without push still get reminders by email.

**Scope**

- Email adapter for `Notifier` via an SMTP-compatible provider (config-driven, no provider SDK in core)
- Templates rendered from i18n keys; unsubscribe link

**Acceptance criteria**

- [ ] Contract test passes with fake and with a local SMTP catcher in CI
- [ ] Unsubscribe link disables the email channel without sign-in (signed token)

**Notes**

_(implementer adds notes for the next task here)_

## T064

**Shareable daily result card**

Phase: P2 · Depends on: [T060](E06-habit-loop.md#t060) · Tags: —
Skills: `port-adapter`, `api-endpoint`, `i18n-rtl`

**Goal.** After answering, a member shares a nice image of their day with an invite link.

**Scope**

- Server renders an SVG → PNG card (day, streak, community name, invite link QR); port `BlobStore` + Cloud Storage adapter
- `POST /v1/t/:tenantId/share-cards` returns a URL; web share button using the Web Share API with copy fallback
- Card never shows the correct answer

**Acceptance criteria**

- [ ] Cards render in Arabic (RTL) and Amharic without broken glyphs (snapshot tests)
- [ ] Same member/day returns the cached card

**Notes**

_(implementer adds notes for the next task here)_

## T065

**Evening reveal notification**

Phase: P2 · Depends on: [T062](E06-habit-loop.md#t062), [T041](E04-answering.md#t041) · Tags: —
Skills: `vertical-slice`

**Goal.** When the question closes, members are told the answer is out and how their rank moved.

**Scope**

- Worker triggered at each season's close time; message includes rank change from memberSeasonStats
- Respects channel preferences and quiet hours

**Acceptance criteria**

- [ ] One notification per member per day (idempotent)
- [ ] Rank change computed correctly when the member did not answer

**Notes**

_(implementer adds notes for the next task here)_
