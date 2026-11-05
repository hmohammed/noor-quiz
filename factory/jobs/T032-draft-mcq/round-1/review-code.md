VERDICT: PASS
# Code review — T032 round 1

Orchestrator fallback review (premium code-reviewer out of usage). Diff: `main...factory/T032-draft-mcq`.

## Findings
_(none must-fix)_

## Acceptance tests
1. ok — questions.test.ts member 403 on POST/GET/PATCH
2. ok — scholar-reviewer 403
3. ok — unauthenticated 401
4. ok — other-tenant editor 403
5. ok — consent required on POST
6. ok — editor POST 201 with answer, type mcq, draft, authoredBy
7. ok — <2 choices → 400
8. ok — bad choiceIndex → 400
9. ok — question.test.ts CreateQuestionRequest rejects
10. ok — create-question.test.ts VALIDATION without calling create
11. ok — MemberQuestionView strips answer/explanation
12. ok — Question keeps answer/explanation
13. ok — strict body rejects server-owned keys; create stays draft
14. ok — sources missing/empty/bad kind/blank ref → 400
15. ok — PATCH identity preserved, empty/unknown/cross-tenant handled (route + update-question tests)
16. ok — GET list tenant-scoped, newest first (route + list-questions)
17. ok — question-repo.contract + in-memory + firebase contract test
18. ok — rules.test.ts seeds `questions` under deny matrix

## Hard rules
1. ok — no vendor imports in core; Firestore converter in apps/api adapter
2. ok — QuestionRepo in ports/repos; fake + shared contract in testkit; MemoryQuestionRepo in core mirrors memory-season-repo for use-case tests
3. ok — no client write path; rules unchanged (default deny); seed only
4. ok — tenantId on get/list; route uses membership.tenantId; cross-tenant → NOT_FOUND
5. ok — timestamps via Clock / toIso
6. ok — requireMember('editor'); server-owned fields rejected by strict bodies
7. ok — no entitlements/plan checks
8. ok — ULID ids via IdGenerator / asQuestionId
9. ok — no secrets
10. ok — N/A (no AI)
11. ok — sources required on write path; reviewStatus always draft; never approved

## Scope
- Epic Notes update in `docs/tasks/E03-seasons-questions.md` is implementer notes for the next task — acceptable.
- No web UI (correctly out of scope).

## Nits (non-blocking)
- Repo-wide Prettier check fails on main-touched files unrelated to this slice (noted in build.md).
- `listQuestions` sort compares ISO strings lexicographically; fine for `toIso` Z-terminated timestamps.
