# E13 · Launch readiness

Observability, backups, load test, content and pilot.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T130

**Structured logs, error tracking and AI cost metric**

Phase: P3 · Depends on: [T072](E07-ai-scoring.md#t072) · Tags: —
Skills: `port-adapter`, `deploy-release`

**Goal.** We see errors, latency and AI spend per day.

**Scope**

- Logger port with JSON logs (Cloud Logging adapter); error tracking adapter behind a port
- Metric: AI calls, tokens, estimated cost per tenant/day; dashboard link in docs

**Acceptance criteria**

- [ ] No PII or answer text in logs (test on logger redaction)
- [ ] Alert when daily AI cost exceeds threshold

**Notes**

_(implementer adds notes for the next task here)_

## T131

**Nightly backup and restore runbook**

Phase: P3 · Depends on: [T004](E00-foundation.md#t004) · Tags: —
Skills: `deploy-release`

**Goal.** Data can be recovered and moved — nightly export to Cloud Storage.

**Scope**

- Scheduled Firestore export; retention policy; `docs/runbooks/restore.md` tested on staging

**Acceptance criteria**

- [ ] A restore of last night's export into staging succeeds (documented in PR)

**Notes**

_(implementer adds notes for the next task here)_

## T132

**Load test 10k answers and scoring**

Phase: P3 · Depends on: [T073](E07-ai-scoring.md#t073), [T051](E05-leaderboards.md#t051) · Tags: —
Skills: `deploy-release`

**Goal.** Prove the system handles a Ramadan evening peak.

**Scope**

- k6 or Node script simulating 10k members answering within 30 minutes + close-time scoring on staging
- Report p95 latency, errors, cost; fix hotspots as new tasks

**Acceptance criteria**

- [ ] p95 submit latency < 500 ms and zero lost answers at target load (or follow-up tasks filed)

**Notes**

_(implementer adds notes for the next task here)_

## T133

**Pilot content: 30+ approved questions in 3 languages**

Phase: P3 · Depends on: [T101](E10-organiser-studio.md#t101), [T082](E08-i18n.md#t082) · Tags: `human`
Skills: `question-content`

**Goal.** Enough reviewed content for the pilot and the first Ramadan weeks.

**Scope**

- Editors draft (AI-assisted allowed), content-reviewer agent pre-checks, scholar approves
- en + ar + am versions

**Acceptance criteria**

- [ ] ≥ 30 approved questions scheduled in the global Ramadan 1448 season
- [ ] Every question has at least one specific source

**Notes**

_(implementer adds notes for the next task here)_

## T134

**Pilot with 3 communities**

Phase: P3 · Depends on: [T133](E13-launch.md#t133), [T065](E06-habit-loop.md#t065) · Tags: `human`
Skills: `deploy-release`

**Goal.** Real communities use the app for two weeks in January.

**Scope**

- Onboard 3 communities on staging/prod-pilot; feedback form; daily check of metrics

**Acceptance criteria**

- [ ] Pilot report: retention, bugs, top feedback; follow-up tasks filed

**Notes**

_(implementer adds notes for the next task here)_

## T135

**Production release pipeline with approval**

Phase: P3 · Depends on: [T004](E00-foundation.md#t004), [T131](E13-launch.md#t131) · Tags: —
Skills: `deploy-release`

**Goal.** Tagged releases go to staging, then prod after a human approves.

**Scope**

- CI: tag `v*-rc*` → staging; tag `v*` → prod behind GitHub environment approval; rules/indexes before functions

**Acceptance criteria**

- [ ] A release candidate deploys to staging and passes the smoke test
- [ ] Prod deploy requires approval

**Notes**

_(implementer adds notes for the next task here)_
