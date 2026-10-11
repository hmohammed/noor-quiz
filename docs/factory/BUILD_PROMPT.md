Build a simple, visual "software factory" in this repo (noor-quiz) using a Claude Code
skill, subagents, and markdown files. Keep it small: a viewer should understand the whole
thing in a few minutes.

Read these first — they are the source of truth and the factory must follow them:
- AGENT.md (hard rules, commands, Definition of Done)
- docs/tasks/BOARD.md (the backlog, in build order) and docs/tasks/E##-*.md (task details)
- .claude/agents/ and .claude/skills/ (existing agents and skills — reuse, don't duplicate)

## The orchestrator

The factory is one skill, /factory. Whichever Claude Code session runs it becomes the
orchestrator: it selects tasks, runs the loop below for each, spawns every agent, merges
approved work, and is the ONLY writer of factory/board.json and of the Status/Owner
columns in docs/tasks/BOARD.md. Subagents never edit either file.

## Task selection (one by one or in parallel)

A task is READY when all of these hold:
1. Its BOARD.md status is `todo`.
2. Every task in its Depends column is `done` (merged to main — never build on unmerged work).
3. Its Owner is not `human` (human tasks are shown on the dashboard as needs-human and skipped).
4. It is not in a later phase while an earlier phase gate is still closed (see Phase gates).

Ready tasks are taken in BOARD.md order. For parallel runs, also require:
5. No CONFLICT with a job already running. Two tasks conflict if they are in the same epic,
   or their Scope sections name the same collection, route prefix, port, or web feature
   folder. When unsure, treat as conflicting (run them one after the other).
6. At most `--max N` jobs at once (default 2, hard cap 4).

Each job runs in its own git worktree (spawn agents with isolation: "worktree") on branch
`factory/<task-id>-<slug>`, e.g. `factory/T040-submit-mcq`. The job id is the task id.

## The loop (per job; edit this to change the factory)

                   ┌──────────────────┐
                   │ task from BOARD  │  (ready + no conflict)
                   └─────────┬────────┘
                             ▼
                   ┌──────────────────┐
                   │   spec-writer    │  turns the task into spec.md, or
                   │       opus       │  returns SPLIT with T040a/T040b proposals
                   └─────────┬────────┘
                             ▼
                   ┌──────────────────┐
                   │     builder      │◄────────────────────┐
                   │       opus       │                     │
                   └─────────┬────────┘                     │
        ┌─────────────┬──────┴──────┬─────────────┐         │
        ▼             ▼             ▼             ▼         │
  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
  │  security │ │     ux    │ │ ui design │ │    code   │   │
  │    opus   │ │   sonnet  │ │   sonnet  │ │   sonnet  │   │
  │ if `sec`  │ │ if web UI │ │ if web UI │ │  always   │   │
  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘   │
        └─────────────┴──────┬──────┴─────────────┘         │
                             ▼                              │
                   ┌──────────────────┐   any CHANGES:      │
                   │  WAIT FOR ALL    ├─────────────────────┘
                   │ selected reviews │   resume builder
                   └─────────┬────────┘   (max 2 rounds, then ESCALATE)
                             ▼ all PASS
                   ┌──────────────────┐
                   │     approver     │
                   │       opus       │
                   └─┬───────────────┬┘
             APPROVE │               │ ESCALATE
                     ▼               ▼
              ┌─────────────┐ ┌─────────────┐
              │ merge queue │ │ needs-human │ ◄── /factory approve | rework
              └──────┬──────┘ └─────────────┘
                     ▼
              rebase on main → full test suite → merge → BOARD.md `done`
              → re-check READY tasks (new tasks may have unlocked)

Reviewer selection (decided by the orchestrator from the task and the diff, recorded in
board.json as `reviewers`):
- code: always.
- security: task tagged `sec` in BOARD.md, OR the diff touches auth, middleware,
  firestore.rules, billing, webhooks, AI prompts, or messaging adapters.
- ux and ui design: the diff touches apps/web.
- content (existing content-reviewer agent): the task lists the `question-content` skill.

## Phase gates

BOARD.md groups tasks into phases P1–P4. The last P1 task done ⇒ the "security verified"
gate opens only after a human runs `/factory gate P1`. The orchestrator never starts a task
from the next phase while its gate is closed; it reports "waiting for gate P1" instead.

## Target file system

.claude/
  skills/factory/SKILL.md          # the orchestrator's instructions (this loop + selection rules)
  agents/
    spec-writer.md                 # new
    builder.md                     # new; replaces/absorbs the existing implementer.md
    security-reviewer.md           # existing — adapt to write review-security.md with a VERDICT line
    code-reviewer.md               # existing — adapt to write review-code.md with a VERDICT line
    ux-reviewer.md                 # new
    ui-reviewer.md                 # new
    content-reviewer.md            # existing — adapt to write review-content.md
    approver.md                    # new
factory/
  board.json                       # durable runtime state, drives the dashboard
  dashboard.html                   # visual board, polls board.json
  jobs/T040-submit-mcq/            # one folder per job (task id + slug)
    task.md                        # copy of the task section from its epic file
    spec.md
    build.md                       # what the builder changed, how it tested, commit list
    round-1/                       # one folder per review round,
      review-security.md           # one file per selected reviewer
      review-ux.md
      review-ui.md
      review-code.md
    decision.md
    merge.md                       # orchestrator: rebase/test/merge log

There is no factory/backlog.md — the backlog is docs/tasks/BOARD.md.

## Agent responsibilities

- spec-writer: reads task.md, AGENT.md, docs/vision.md and the relevant skills; writes
  spec.md with: acceptance criteria as a numbered test list, files/modules to touch,
  contracts and data shapes, out-of-scope list. If the task is too big for one day or adds
  more than one new port plus one new screen, writes `SPLIT` as the first line plus
  proposed sub-tasks; the orchestrator then inserts T###a/T###b into BOARD.md and the
  epic file, and does not build the original.
- builder: works and commits only on the job branch, in its worktree. Follows the
  `vertical-slice` skill and the skills named in the task. Runs
  `npm run lint && npm run typecheck && npm test`, plus `npm run test:emulator` /
  `npm run test:e2e` when relevant. Writes build.md. On later rounds, reads
  round-N/*.md and fixes only what reviewers asked for.
- reviewers: read spec.md, build.md and `git diff main...factory/<job>`; each writes only
  its own file, first line `VERDICT: PASS` or `VERDICT: CHANGES`, then findings with
  file:line. Security and code reviewers must check every AGENT.md hard rule.
- approver: reads everything in the job folder; first line of decision.md is
  `APPROVE` or `ESCALATE`. Always ESCALATE when: the task is tagged `human`, the change
  touches billing in live mode, production config, firestore.rules weakening, a new
  dependency without justification, or content `reviewStatus: approved`.

## board.json

{ "maxParallel": 2,
  "gates": { "P1": "closed", "P2": "closed", "P3": "closed" },
  "jobs": [ { "id": "T040", "slug": "submit-mcq", "title": "Answer today's multiple-choice question",
    "epic": "E04", "phase": "P1", "branch": "factory/T040-submit-mcq",
    "worktree": "../noor-quiz-wt/T040", "stage": "review", "round": 2,
    "reviewers": ["security", "ux", "ui", "code"],
    "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "pending", "code": "PASS" },
    "startedAt": "2026-10-20T09:12:00Z" } ],
  "queue": ["T041", "T050"],
  "blocked": [ { "id": "T005", "reason": "human" } ] }

Stages: spec → build → review → approve → merge-queue → done | needs-human | split.

## Rules
- Agents get context from files, not the conversation, and write only their own file.
- Each review starts with VERDICT: PASS or CHANGES; decision.md starts with APPROVE or ESCALATE.
- WAIT FOR ALL: a review round is done only when every SELECTED reviewer's file exists in
  the round folder. Never resume the builder mid-round.
- Spawn the builder with a name (builder-<task-id>) and resume that same builder with
  SendMessage for each new round, pointing it at the round folder.
- Merges happen one at a time through the merge queue: rebase the branch on main, rerun
  the full test suite, merge with a squash commit `T040: <title>`, then set BOARD.md
  status to `done`. A rebase conflict or red suite sends the job back to its builder as
  a new round with merge.md as the feedback.
- After every merge, recompute READY tasks and start new jobs up to maxParallel.
- Never deploy, never touch production projects, Stripe live mode, or secrets
  (AGENT.md "Out of bounds" applies to every agent).
- Commit board.json and BOARD.md changes on main with message `factory: <what changed>`.

## Commands
/factory next                    run the first READY task from BOARD.md, one job at a time
/factory run [--max N]           keep running READY tasks, up to N in parallel (default 2),
                                 until nothing is ready, a gate is closed, or you stop it
/factory <task-id>               run one specific task (must be READY)
/factory status                  print running jobs, queue, blocked tasks and closed gates
/factory approve <task-id>       merge a needs-human job via the merge queue
/factory rework <task-id> <note> send a job back to its builder with feedback
/factory gate <phase>            open a phase gate after a human has checked it
/factory stop                    finish current rounds, start nothing new

## Dashboard
One self-contained HTML file, served with `python3 -m http.server` from the repo root (so it
can read both factory/ and docs/tasks/). Columns follow the loop's stages; jobs are cards
showing task id, title, epic and phase. Each review round shows as a row of reviewer chips
(only the selected reviewers) that fill in as verdicts land. Parallel jobs appear side by side.
needs-human jobs and closed gates stand out. A sidebar shows the next 5 READY tasks and
blocked/human tasks. Click a card to read its markdown files. Clean and minimal; use logical
CSS properties so it also works RTL.
