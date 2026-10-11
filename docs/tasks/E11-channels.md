# E11 · Messaging channels

Telegram and WhatsApp: reminders and answering in chat.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T110

**Telegram bot: link account and answer MCQ in chat**

Phase: P3 · Depends on: [T040](E04-answering.md#t040) · Tags: `sec`
Skills: `port-adapter`, `api-endpoint`

**Goal.** Members answer today's question from Telegram with buttons.

**Scope**

- Telegram webhook route with secret-token verification
- Account linking: one-time code from web profile → `/start <code>` in bot
- `/today` sends question with inline buttons; button press calls the same `submitAnswer` use case

**Acceptance criteria**

- [ ] Unlinked users get a link prompt, not data
- [ ] Codes are single-use and expire in 10 minutes
- [ ] Duplicate button presses → one answer

**Notes**

_(implementer adds notes for the next task here)_

## T111

**Telegram reminders**

Phase: P3 · Depends on: [T110](E11-channels.md#t110), [T062](E06-habit-loop.md#t062) · Tags: —
Skills: `port-adapter`

**Goal.** Members who prefer Telegram get the daily reminder there.

**Scope**

- Telegram channel in Notifier; channel preference in profile

**Acceptance criteria**

- [ ] Reminder worker routes to Telegram for members with that preference
- [ ] Blocked bot → channel disabled and fallback to push/email

**Notes**

_(implementer adds notes for the next task here)_

## T112

**WhatsApp reminders (metered)**

Phase: P3 · Depends on: [T062](E06-habit-loop.md#t062), [T092](E09-billing.md#t092) · Tags: `sec`
Skills: `port-adapter`, `entitlements-billing`

**Goal.** Paid communities send reminders on WhatsApp using approved templates.

**Scope**

- WhatsApp Cloud API adapter (Meta direct) for Notifier; opt-in with phone verification
- Each send consumes `messages` quota; exhaustion falls back to push/email
- Inbound webhook verified (for opt-out STOP)

**Acceptance criteria**

- [ ] Free communities cannot enable WhatsApp (feature gate)
- [ ] STOP reply disables the channel
- [ ] Quota race test

**Notes**

_(implementer adds notes for the next task here)_

## T113

**Answer via WhatsApp interactive buttons**

Phase: P4 · Depends on: [T112](E11-channels.md#t112) · Tags: `sec`
Skills: `port-adapter`

**Goal.** Stretch: answer MCQ directly in WhatsApp.

**Scope**

- Interactive message with reply buttons; inbound handler maps to submitAnswer

**Acceptance criteria**

- [ ] Duplicate inbound messages → one answer
- [ ] Only verified, linked numbers can answer

**Notes**

_(implementer adds notes for the next task here)_
