# Task board

Vertically sliced tasks in build order. Each task delivers one testable behaviour through every layer it needs, and is sized to roughly a day of agent work.

## How to use

1. Pick the **first `todo` row whose dependencies are all `done`** and whose owner is not `human` (see the `pick-task` skill).
2. Set Status to `in-progress` and Owner to your name/session; commit that change first.
3. Read the task in its epic file, build it with the `vertical-slice` skill, get it reviewed.
4. Set Status to `done` (or `review` if a person must check). Too big? Ask the `architect` agent to split it (T040 → T040a, T040b).

Status: `todo` · `in-progress` · `review` · `done` · `blocked` · `split` (replaced by T###a/b; becomes `done` when the last sub-task is). Under `/factory`, only the orchestrator edits Status/Owner. Tags: `sec` = also run `security-reviewer`; `human` = needs a person (accounts, legal, scholar review).

Phases follow the roadmap in [../vision.md](../vision.md#roadmap-and-metrics): gates are *security verified* (end P1), *feature freeze* (20 Dec), *load test passed* (end Jan).


## P1 · Harden (12 Oct – 8 Nov)

| ID | Task | Epic | Depends | Tags | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| [T001](E00-foundation.md#t001) | Monorepo skeleton with lint, typecheck and unit tests | E00 | — |  | in-progress | factory |
| [T002](E00-foundation.md#t002) | Local stack: emulators, Hono health endpoint, Vite home page | E00 | T001 |  | todo |  |
| [T003](E00-foundation.md#t003) | Clock port, typed config and domain errors | E00 | T001 |  | todo |  |
| [T005](E00-foundation.md#t005) | Create Firebase projects and accounts | E00 | — |  | todo | human |
| [T004](E00-foundation.md#t004) | CI: emulator tests, e2e and auto-deploy to dev | E00 | T002, T005 |  | todo |  |
| [T010](E01-identity-privacy.md#t010) | Sign in with Google and get my user record | E01 | T002, T003 | sec | todo |  |
| [T011](E01-identity-privacy.md#t011) | Edit my profile: display name, locale, timezone | E01 | T010 |  | todo |  |
| [T012](E01-identity-privacy.md#t012) | Firestore rules baseline: deny every client write | E01 | T002 | sec | todo |  |
| [T013](E01-identity-privacy.md#t013) | Consent at first sign-in and delete my account | E01 | T011 | sec | todo |  |
| [T020](E02-communities.md#t020) | Create a community and list mine | E02 | T013 | sec | todo |  |
| [T021](E02-communities.md#t021) | Invite link and join | E02 | T020 | sec | todo |  |
| [T022](E02-communities.md#t022) | Members list and role management | E02 | T021 | sec | todo |  |
| [T030](E03-seasons-questions.md#t030) | Season rules in core: days, open and close times | E03 | T003 |  | todo |  |
| [T031](E03-seasons-questions.md#t031) | Create a season for a community | E03 | T030, T020 |  | todo |  |
| [T032](E03-seasons-questions.md#t032) | Draft multiple-choice questions | E03 | T031 |  | todo |  |
| [T033](E03-seasons-questions.md#t033) | Review status and schedule questions to season days | E03 | T032, T022 | sec | todo |  |
| [T034](E03-seasons-questions.md#t034) | Today's question for members | E03 | T033 | sec | todo |  |
| [T040](E04-answering.md#t040) | Answer today's multiple-choice question | E04 | T034 | sec | todo |  |

## P2 · Core features (9 Nov – 20 Dec)

| ID | Task | Epic | Depends | Tags | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| [T023](E02-communities.md#t023) | Community switcher and community home | E02 | T021 |  | todo |  |
| [T035](E03-seasons-questions.md#t035) | Import questions from JSON (incl. old data.json) | E03 | T032 |  | todo |  |
| [T041](E04-answering.md#t041) | Reveal: correct answer and explanation after close | E04 | T040 | sec | todo |  |
| [T042](E04-answering.md#t042) | My season history | E04 | T041 |  | todo |  |
| [T043](E04-answering.md#t043) | Rate limiting on write endpoints | E04 | T040 | sec | todo |  |
| [T050](E05-leaderboards.md#t050) | Community leaderboard | E05 | T040 |  | todo |  |
| [T051](E05-leaderboards.md#t051) | Realtime leaderboard view | E05 | T050 | sec | todo |  |
| [T052](E05-leaderboards.md#t052) | Global season and fair cross-community ranking | E05 | T050 |  | todo |  |
| [T060](E06-habit-loop.md#t060) | Streaks with a weekly mercy token | E06 | T040 |  | todo |  |
| [T061](E06-habit-loop.md#t061) | Web push opt-in | E06 | T011 |  | todo |  |
| [T062](E06-habit-loop.md#t062) | Daily reminder at my chosen time | E06 | T061, T034 |  | todo |  |
| [T063](E06-habit-loop.md#t063) | Email channel as fallback | E06 | T061 |  | todo |  |
| [T064](E06-habit-loop.md#t064) | Shareable daily result card | E06 | T060 |  | todo |  |
| [T065](E06-habit-loop.md#t065) | Evening reveal notification | E06 | T062, T041 |  | todo |  |
| [T070](E07-ai-scoring.md#t070) | Free-text reflection questions | E07 | T040 |  | todo |  |
| [T071](E07-ai-scoring.md#t071) | Queue and scoring worker with a fake AI | E07 | T070 |  | todo |  |
| [T072](E07-ai-scoring.md#t072) | Real AI provider adapter with versioned prompt | E07 | T071 | sec | todo |  |
| [T073](E07-ai-scoring.md#t073) | Cloud Tasks queue adapter with budget cap | E07 | T071 |  | todo |  |
| [T074](E07-ai-scoring.md#t074) | Human review queue for uncertain scores | E07 | T072, T022 |  | todo |  |
| [T080](E08-i18n.md#t080) | i18n layer with English and Swedish | E08 | T023 |  | todo |  |
| [T081](E08-i18n.md#t081) | Arabic and right-to-left layout | E08 | T080 |  | todo |  |
| [T090](E09-billing.md#t090) | Plans as data and entitlements | E09 | T020 |  | todo |  |
| [T091](E09-billing.md#t091) | Gate features and member cap via entitlements | E09 | T090, T032, T021 | sec | todo |  |
| [T092](E09-billing.md#t092) | Usage metering and AI credit quotas | E09 | T090, T071 |  | todo |  |
| [T100](E10-organiser-studio.md#t100) | Question editor with sources and translations | E10 | T033 |  | todo |  |
| [T101](E10-organiser-studio.md#t101) | Scholar review screen | E10 | T100 |  | todo |  |
| [T102](E10-organiser-studio.md#t102) | Season calendar and scheduling view | E10 | T101 |  | todo |  |

## P3 · Content + pilot (21 Dec – 31 Jan)

| ID | Task | Epic | Depends | Tags | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| [T075](E07-ai-scoring.md#t075) | Scoring cache and evaluation harness | E07 | T072 |  | todo |  |
| [T082](E08-i18n.md#t082) | Amharic and Somali; multilingual questions | E08 | T081, T034 |  | todo |  |
| [T083](E08-i18n.md#t083) | Localised notifications and AI feedback | E08 | T082, T072, T062 |  | todo |  |
| [T093](E09-billing.md#t093) | Stripe checkout behind PaymentProvider (test mode) | E09 | T090 | sec | todo |  |
| [T094](E09-billing.md#t094) | Stripe webhook updates subscription and entitlements | E09 | T093 | sec | todo |  |
| [T095](E09-billing.md#t095) | Customer portal, downgrade and cancel | E09 | T094 |  | todo |  |
| [T096](E09-billing.md#t096) | Season pass one-off purchase | E09 | T094, T031 |  | todo |  |
| [T097](E09-billing.md#t097) | Sponsored communities (platform grant) | E09 | T090 |  | todo |  |
| [T098](E09-billing.md#t098) | Legal entity, Stripe live mode and VAT | E09 | — |  | todo | human |
| [T103](E10-organiser-studio.md#t103) | Participation analytics for organisers | E10 | T050 |  | todo |  |
| [T104](E10-organiser-studio.md#t104) | Community data export | E10 | T042 | sec | todo |  |
| [T105](E10-organiser-studio.md#t105) | Community branding | E10 | T091 |  | todo |  |
| [T110](E11-channels.md#t110) | Telegram bot: link account and answer MCQ in chat | E11 | T040 | sec | todo |  |
| [T111](E11-channels.md#t111) | Telegram reminders | E11 | T110, T062 |  | todo |  |
| [T112](E11-channels.md#t112) | WhatsApp reminders (metered) | E11 | T062, T092 | sec | todo |  |
| [T120](E12-live-rounds.md#t120) | Live round: host creates a lobby | E12 | T033 |  | todo |  |
| [T121](E12-live-rounds.md#t121) | Live round: players answer with a timer | E12 | T120 | sec | todo |  |
| [T122](E12-live-rounds.md#t122) | Live round realtime views and projector screen | E12 | T121, T051 |  | todo |  |
| [T130](E13-launch.md#t130) | Structured logs, error tracking and AI cost metric | E13 | T072 |  | todo |  |
| [T131](E13-launch.md#t131) | Nightly backup and restore runbook | E13 | T004 |  | todo |  |
| [T132](E13-launch.md#t132) | Load test 10k answers and scoring | E13 | T073, T051 |  | todo |  |
| [T133](E13-launch.md#t133) | Pilot content: 30+ approved questions in 3 languages | E13 | T101, T082 |  | todo | human |
| [T134](E13-launch.md#t134) | Pilot with 3 communities | E13 | T133, T065 |  | todo | human |
| [T135](E13-launch.md#t135) | Production release pipeline with approval | E13 | T004, T131 |  | todo |  |

## P4 · Ramadan (Feb – Mar)

| ID | Task | Epic | Depends | Tags | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| [T113](E11-channels.md#t113) | Answer via WhatsApp interactive buttons | E11 | T112 | sec | todo |  |
| [T123](E12-live-rounds.md#t123) | Live round points into season stats | E12 | T122 |  | todo |  |

## Later · after launch

| ID | Task | Epic | Depends | Tags | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| [T140](E14-after-launch.md#t140) | Duels: challenge a friend to 5 questions | E14 | T040 |  | todo |  |
| [T141](E14-after-launch.md#t141) | Weekly leagues with promotion and relegation | E14 | T052 |  | todo |  |
| [T142](E14-after-launch.md#t142) | Quran khatm together | E14 | T022 |  | todo |  |
| [T143](E14-after-launch.md#t143) | Private good-deeds tracker | E14 | T011 |  | todo |  |
| [T144](E14-after-launch.md#t144) | Kids profiles managed by parents | E14 | T022 |  | todo |  |
| [T145](E14-after-launch.md#t145) | Weekly Jumu'ah season template | E14 | T031 |  | todo |  |
| [T146](E14-after-launch.md#t146) | Laylat al-Qadr bonus nights | E14 | T031, T060 |  | todo |  |
| [T147](E14-after-launch.md#t147) | AI tutor grounded in vetted sources | E14 | T072, T101 |  | todo |  |
| [T148](E14-after-launch.md#t148) | AI question drafting in the studio | E14 | T100, T072 |  | todo |  |
| [T149](E14-after-launch.md#t149) | Discussion thread after reveal | E14 | T041, T022 |  | todo |  |
