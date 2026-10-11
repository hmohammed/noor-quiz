---
name: factory
description: Run the Noor Quiz software factory. Picks READY tasks from docs/tasks/BOARD.md and drives each one through spec → build → review → approve → merge with subagents, keeping factory/board.json up to date for the dashboard. Use when the user types /factory (next, run, <task-id>, status, approve, rework, gate, stop).
---

# /factory: the orchestrator

The session that runs this skill is the **orchestrator**. It picks tasks, spawns every agent, merges approved work, and is the **only writer** of `factory/board.json` and of the Status/Owner columns in `docs/tasks/BOARD.md`. Agents get their context from files, never from this conversation, and each one writes only its own file.

Source of truth: `AGENT.md` (hard rules, commands, Definition of Done) and `docs/tasks/BOARD.md` (the backlog). AGENT.md "Out of bounds" applies to every agent: **never deploy, never touch production projects, Stripe live mode or secrets, never push, never force anything.**

## Commands

| Command | What it does |
| --- | --- |
| `/factory next` | Run the first READY task, one job at a time, to the end of its loop |
| `/factory run [--max N]` | Keep running READY tasks, up to N in parallel (default 2, hard cap 4), until nothing is ready, a gate is closed, or `stop` |
| `/factory <task-id>` | Run one specific task (it must be READY) |
| `/factory status` | Print running jobs, queue, blocked tasks and closed gates. Read-only |
| `/factory approve <task-id>` | Send a `needs-human` job to the merge queue |
| `/factory rework <task-id> <note>` | Send a job back to its builder with the note as feedback |
| `/factory gate <phase>` | Open a phase gate after a human has checked it |
| `/factory stop` | Set `"stopping": true`: finish current rounds, start nothing new |

## Preflight (every command)

1. The repo must be a git repo with a `main` branch, and this checkout must be on `main`. If it is not, stop and ask the user to set it up (`git init -b main && git add -A && git commit -m "initial"`). Do not do that yourself.
2. Load `factory/board.json`. If a job is mid-stage and its agent is gone (a new session), see **Restart** below.
3. Parse `docs/tasks/BOARD.md`: every table row `| [T###](E##-file.md#t###) | title | epic | depends | tags | status | owner |`, plus its phase from the `## P1 ·`, `## P2 ·`, `## P3 ·`, `## P4 ·`, `## Later` heading above it.

## Task selection

Phases run in order **P1 → P2 → P3 → P4 → Later**. The gate of a phase opens with `/factory gate <phase>`, and a task can start only when the gates of all **earlier** phases are open.

A task is **READY** when:
1. Its Status is `todo`.
2. Every task in Depends is `done`, meaning merged to main. Never build on unmerged work.
3. Its Owner is not `human`. Human tasks go in `blocked` with reason `human`; a person sets them to `done` in BOARD.md themselves.
4. Its phase's gates are open. If the first candidate is held only by a gate, report **"waiting for gate P1"**.

Take READY tasks in BOARD.md order. For parallel runs, also require:
5. **No conflict** with a running job. Two tasks conflict if they are in the same epic, or their **Scope** sections name the same collection (`answers/…`), route prefix (`/v1/t/:tenantId/questions`), port (`RateLimiter`), or web feature folder (`apps/web/src/features/<area>`). If unsure, they conflict, so run them one after the other.
6. Running jobs (stages spec, build, review, approve, merge-queue) ≤ `maxParallel`.

Write the remaining READY task ids, in order, to `board.json` `queue`.

## Starting a job

1. **slug**: 2–4 kebab words from the title (`Answer today's multiple-choice question` → `submit-mcq`). Job id = task id. Branch `factory/<id>-<slug>`.
2. Create `factory/jobs/<id>-<slug>/task.md`: a verbatim copy of the task section from its epic file (from `## T040` up to the next `## T`), plus the row's Tags and Phase.
3. BOARD.md row: Status `in-progress`, Owner `factory`. Add the job to `board.json` with `stage: "spec"`, `round: 1`, `startedAt` (now, UTC ISO).
4. Commit on main: `factory: start T040`.

## The loop (per job; edit this diagram and the stages below to change the factory)

```
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
```

Stages in `board.json`: `spec → build → review → approve → merge-queue → done | needs-human | split`.
Update `board.json` at **every** transition and whenever a review verdict lands, so the dashboard stays live.

Below, `JOB` is the absolute path of `factory/jobs/<id>-<slug>/` in this (main) checkout. Agents without isolation write there by absolute path. The builder runs in a worktree and **cannot** write outside it: it writes `factory/jobs/<id>-<slug>/build.md` inside its worktree (never committed), and you copy that file to `JOB/build.md` and delete the worktree copy.

### 1 · spec

Spawn `spec-writer` (no isolation):
> Job T040. Task: `JOB/task.md`. Write `JOB/spec.md`. Repo root: `<abs path>`.

- First line `SPLIT`: insert the proposed `T040a`, `T040b`… rows into BOARD.md right after T040, with their sections in the epic file (same format as the others). Set T040's Status to `split`. Set the job `stage: "split"`, commit `factory: split T040`, and re-run selection. Do not build the original. When the last sub-task is merged, set T040 to `done`.
- Otherwise: `stage: "build"`.

### 2 · build

Spawn `builder` with `isolation: "worktree"`, named `builder-T040` (if the Agent tool has no name field, store the returned agent id in the job's `builderAgent`):
> Job T040, round 1. Spec: `JOB/spec.md`. Task: `JOB/task.md`. Create and work on branch `factory/T040-submit-mcq` in your worktree. Write `factory/jobs/T040-submit-mcq/build.md` inside your worktree; do not commit it.

When it returns, copy its build.md to `JOB/build.md` (after every round), read it and record `branch` and `worktree` (from its header) in `board.json`.
- First line `BLOCKED: …` → `stage: "needs-human"`, `reason` = that line.
- Otherwise → **review**.

### 3 · review (WAIT FOR ALL)

**Select reviewers** from the task and `git diff --name-only main...<branch>`, and record them as `reviewers`:
- `code`: always.
- `security`: the task is tagged `sec`, OR the diff touches auth, `middleware/`, `firebase/firestore.rules`, billing, webhooks, `adapters/ai/` or prompts, or `adapters/notify/` and messaging bots.
- `ux` and `ui`: the diff touches `apps/web/`.
- `content`: the task's Skills line lists `question-content`.

Create `JOB/round-N/`, set every selected reviewer to `"pending"`, then spawn all of them **in one message** (no isolation; they read the branch with git):

| key | agent | writes |
| --- | --- | --- |
| security | `security-reviewer` | `round-N/review-security.md` |
| ux | `ux-reviewer` | `round-N/review-ux.md` |
| ui | `ui-reviewer` | `round-N/review-ui.md` |
| code | `code-reviewer` | `round-N/review-code.md` |
| content | `content-reviewer` | `round-N/review-content.md` |

> Job T040, round N. Review `git diff main...factory/T040-submit-mcq` against `JOB/spec.md` and `JOB/build.md`. Write only `JOB/round-N/review-<key>.md`, first line `VERDICT: PASS` or `VERDICT: CHANGES`.

As each one finishes, read the first line of its file and set `reviews.<key>`. The round is done **only when every selected reviewer's file exists**. Never resume the builder mid-round.

- All `PASS` → **approve**.
- Any `CHANGES` and `round < 3`: push `{round, reviews}` onto `history`, then `round += 1` and `stage: "build"`. Resume the same builder with SendMessage:
  > Round N reviews are in `JOB/round-N/`. Fix only what they ask, run the checks again, commit, and append a `## Round N+1` section to your worktree's build.md. (Copy the current `JOB/build.md` back into the worktree first if you deleted it.)

  Then run a new review round in `round-(N+1)/`, re-selecting reviewers from the new diff.
- Any `CHANGES` after round 3 (2 fix rounds used) → `stage: "needs-human"`, `reason: "still CHANGES after 2 fix rounds"`.

### 4 · approve

Spawn `approver` (no isolation):
> Job T040. Read everything in `JOB/` and the diff of `factory/T040-submit-mcq`. Write `JOB/decision.md`, first line `APPROVE` or `ESCALATE`.

- `APPROVE` → `stage: "merge-queue"`.
- `ESCALATE` → `stage: "needs-human"`, `reason` = the approver's one-line reason. BOARD.md Status becomes `review`.

### 5 · merge queue (one job at a time, in queue order)

Log every command and its result to `JOB/merge.md`.
1. Commit any pending factory state on main first (`factory: …`).
2. `git -C <worktree> rebase main`.
3. In the worktree: `npm install && npm run lint && npm run typecheck && npm test`, plus `npm run test:emulator` / `npm run test:e2e` when build.md says they apply.
4. In this checkout: `git merge --squash <branch>`, then `git commit` with message `T040: <title>` (plus the session's Co-Authored-By trailer).
5. BOARD.md Status becomes `done` (and the split parent too, if this was its last sub-task). The job gets `stage: "done"` and `finishedAt`. Commit `factory: T040 done`.
6. `git worktree remove <worktree>`. Keep the branch for audit.
7. **Recompute READY** and start new jobs up to `maxParallel`, unless stopping.

A **rebase conflict or red suite**: run `git rebase --abort` if needed, write the failure into `merge.md`, set `round += 1` and `stage: "build"`, and resume the builder pointing at `JOB/merge.md`. Then do a normal review round. This counts toward the 3-round limit.

## Other commands

- **status**: print a table of jobs (id, stage, round, reviews), the queue, blocked tasks, gates. For each closed gate whose phase is fully `done`, add "ready for `/factory gate P1`". Change nothing.
- **approve <id>**: the job must be `needs-human`. Note `Approved by human` in `decision.md` (append), set `stage: "merge-queue"`, and merge.
- **rework <id> <note>**: write the note to `JOB/round-N/rework.md`, set `round += 1` and `stage: "build"`, resume (or respawn) the builder pointing at it, then review. Human rework does not count toward the round limit.
- **gate <phase>**: refuse and list what is missing unless every task in that phase is `done`. Otherwise set `gates.<phase>: "open"`, commit `factory: open gate P1`, and recompute READY.
- **stop**: set `"stopping": true`. Let running rounds finish and start nothing new. Starting a later `run`/`next` sets it back to `false`.

## board.json

```json
{ "maxParallel": 2, "stopping": false, "updatedAt": "2026-10-20T09:30:00Z",
  "gates": { "P1": "closed", "P2": "closed", "P3": "closed", "P4": "closed" },
  "jobs": [ { "id": "T040", "slug": "submit-mcq", "title": "Answer today's multiple-choice question",
    "epic": "E04", "phase": "P1", "tags": ["sec"], "branch": "factory/T040-submit-mcq",
    "worktree": "<path reported by the builder>", "builderAgent": "builder-T040",
    "stage": "review", "round": 2,
    "reviewers": ["security", "ux", "ui", "code"],
    "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "pending", "code": "PASS" },
    "history": [ { "round": 1, "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "CHANGES", "code": "PASS" } } ],
    "reason": null, "startedAt": "2026-10-20T09:12:00Z", "finishedAt": null } ],
  "queue": ["T041", "T050"],
  "blocked": [ { "id": "T005", "reason": "human" } ] }
```

Gate `P4` holds the `Later` tasks. Gates are keyed by the phase that must be finished first.

## Commits on main

Stage only `factory/` and `docs/tasks/` (never `git add -A`). Message: `factory: <what changed>`. Commit at job start, split, needs-human, gate, and after each merge. Mid-loop board.json updates can wait for the next of those commits.

## Restart (a new session finds jobs mid-flight)

Rebuild from `board.json` and the job folders. `spec` with no `spec.md`: re-spawn the spec-writer. `build`: spawn a fresh `builder` **without** isolation, told to `cd` into the recorded worktree and continue on its branch. `review`: spawn only the reviewers whose files are missing in the current round. `approve`: re-spawn the approver. `merge-queue`: restart the merge from step 1.
