#!/usr/bin/env node
// Factory sync: moves jobs whose GitHub PR was merged to `done` in factory/board.json.
// Runs the /factory Preflight sync (steps 3 and 4) without an agent:
//   node factory/sync.mjs            sync once
//   node factory/sync.mjs --watch    sync every 60 s (keeps factory/dashboard.html current)
// Also runs from the SessionStart hook in .claude/settings.json. Never pushes and never
// commits; local main only moves by `git pull --ff-only`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WATCH_MS = 60_000;
const PR_STAGES = new Set(['pr-open', 'split']);

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// The main checkout owns board.json, even when this runs from a worktree.
const root = path.dirname(
  run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd()),
);
const boardPath = path.join(root, 'factory', 'board.json');

function pullMain(log) {
  run('git', ['fetch', 'origin', '--quiet'], root);
  const ahead = Number(run('git', ['rev-list', '--count', 'origin/main..main'], root));
  if (ahead > 0) {
    log.push(`main is ${ahead} commit(s) ahead of origin/main: not pulling, reconcile by hand`);
    return;
  }
  if (run('git', ['branch', '--show-current'], root) !== 'main') {
    log.push('main checkout is not on main: not pulling');
    return;
  }
  const behind = Number(run('git', ['rev-list', '--count', 'main..origin/main'], root));
  if (behind === 0) return;
  try {
    run('git', ['pull', '--ff-only', '--quiet'], root);
    log.push(`pulled ${behind} commit(s) from origin/main`);
  } catch (err) {
    log.push(`git pull --ff-only failed: ${firstLine(err)}`);
  }
}

function removeWorktree(job, log) {
  const wt = job.worktree;
  if (!wt || !existsSync(wt)) return;
  const cwd = path.resolve(process.cwd());
  if (cwd === path.resolve(wt) || cwd.startsWith(path.resolve(wt) + path.sep)) {
    log.push(`${job.id}: worktree kept (this process runs inside it): ${wt}`);
    return;
  }
  try {
    // No --force: a worktree with uncommitted work stays for a human to look at.
    run('git', ['worktree', 'remove', wt], root);
    log.push(`${job.id}: worktree removed (branch kept)`);
  } catch (err) {
    log.push(`${job.id}: worktree kept: ${firstLine(err)}`);
  }
}

function firstLine(err) {
  return String(err.stderr || err.message).split('\n')[0];
}

function syncOnce() {
  const log = [];
  if (!existsSync(boardPath)) return ['no factory/board.json: nothing to sync'];
  try {
    pullMain(log);
  } catch (err) {
    log.push(`git fetch failed: ${firstLine(err)}`);
  }

  const board = JSON.parse(readFileSync(boardPath, 'utf8'));
  let changed = false;
  for (const job of board.jobs ?? []) {
    if (!PR_STAGES.has(job.stage) || !job.pr) continue;
    let pr;
    try {
      pr = JSON.parse(run('gh', ['pr', 'view', String(job.pr), '--json', 'state,mergedAt'], root));
    } catch (err) {
      log.push(`${job.id}: gh pr view ${job.pr} failed: ${firstLine(err)}`);
      continue;
    }
    if (pr.state === 'MERGED') {
      job.stage = 'done';
      job.finishedAt = pr.mergedAt;
      job.reason = null;
      changed = true;
      log.push(`${job.id}: PR #${job.pr} merged → done`);
      removeWorktree(job, log);
    } else if (pr.state === 'CLOSED') {
      job.stage = 'needs-human';
      job.reason = 'PR closed without merge';
      changed = true;
      log.push(`${job.id}: PR #${job.pr} closed without merge → needs-human`);
    }
  }

  if (changed) {
    // Re-read so a concurrent orchestrator write between our read and now is not lost.
    const latest = JSON.parse(readFileSync(boardPath, 'utf8'));
    const updates = new Map(board.jobs.map((j) => [j.id, j]));
    latest.jobs = latest.jobs.map((j) =>
      PR_STAGES.has(j.stage) && updates.get(j.id)?.stage !== j.stage ? updates.get(j.id) : j,
    );
    latest.updatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    writeFileSync(boardPath, JSON.stringify(latest, null, 2) + '\n');
  }
  return log;
}

function report() {
  const log = syncOnce();
  const stamp = new Date().toISOString().slice(11, 19);
  for (const line of log) console.log(`[factory sync ${stamp}] ${line}`);
}

report();
if (process.argv.includes('--watch')) setInterval(report, WATCH_MS);
