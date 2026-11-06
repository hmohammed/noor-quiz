VERDICT: PASS
# Security review — T033 round 1

## Findings
None.

Review `POST .../questions/:questionId/review` runs `requireUser`, `requireConsent`, then `requireMember('scholar-reviewer')` as the route floor so plain members never enter the use case. Role comes from the membership document, not the body. `reviewQuestion` then enforces status-specific gates: `canSubmitForReview` (`roleAtLeast('editor')`) for `in_review`, and `canApproveOrReject` (`scholar-reviewer` or `roleAtLeast('admin')`) for `approved`/`rejected`. That is intentionally not `roleAtLeast('scholar-reviewer')`, so editors who pass the floor still get `FORBIDDEN` on approve/reject. Scholars get `FORBIDDEN` on `in_review`. Role is checked before the transition, so a scholar asking for `in_review` is `FORBIDDEN`, not `CONFLICT`. Illegal transitions (`approved`/`rejected` from non-`in_review`, or leaving `approved` via this endpoint) throw `CONFLICT` and do not call `questions.update`.

Schedule `PUT .../seasons/:seasonId/schedule/:dayIndex` uses the same auth/consent chain with `requireMember('editor')`, so members and scholar-reviewers are `FORBIDDEN`. `tenantId`, `userId` / `scheduledBy`, and `role` are taken from `c.var.membership`. Request bodies are strict: `ReviewQuestionRequest` only allows `status` + `notes`; `ScheduleQuestionRequest` only `questionId`. Create/patch still reject `reviewStatus`, `reviewedBy`, `reviewedAt`, and related identity fields. `reviewedBy`/`reviewedAt` are set from the actor and `deps.clock.now()` on approve/reject, cleared to `null` on submit-for-review; `updateQuestion` preserves the stored audit and review fields. Only `reviewStatus === 'approved'` is scheduleable (`CONFLICT` otherwise). Duplicate question on another day of the same season is `CONFLICT` with the first day left in place.

Cross-tenant access is `FORBIDDEN` when the caller has no membership (or too-low role) for the path tenant, and `NOT_FOUND` when a well-formed id belongs to another tenant: review and schedule both pass `membership.tenantId` into repos. `FirestoreScheduleRepo.get` / `listBySeason` return null or filter when `tenantId` mismatches; season and question loads are tenant-scoped before `put`. `firebase/firestore.rules` is unchanged (default deny). The new `schedule` seed is in the existing deny matrix; no client allow rule was added. `MemberQuestionView` still omits answer, explanation, and review/audit fields. Error bodies stay `{ error: { code, message } }` without notes, sources, or answers in client-visible details.

## Hard rules
1. core vendor-free — ok
2. ports + adapters + fakes — ok (`ScheduleRepo` + fake + shared contract)
3. no client Firestore writes — ok (rules unchanged; schedule seeded deny-only)
4. tenant isolation — ok
5. time from Clock — ok (`reviewedAt`, `updatedAt`, `scheduledAt` via `toIso(deps.clock.now())`)
6. roles server-side — ok (membership role; no client-trusted approve)
7. entitlements, not plan names — ok (none in this slice; none added)
8. our own ids — ok
9. secrets — ok (none in this slice)
10. AI output untrusted — ok (no AI in this slice)
11. religious content provenance — ok (only approver roles write `approved`; only approved scheduleable)
