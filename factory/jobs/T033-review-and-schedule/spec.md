# Spec — T033 Review status and schedule questions to season days

Editors submit drafts for review; scholar-reviewers (and admins/owners) approve or reject with notes. Only `approved` questions can be scheduled onto a season day. One question per day; the same question cannot appear twice in one season. This slice has no web page.

`requireMember` alone cannot gate approve/reject: role order is `member` < `scholar-reviewer` < `editor` < `admin` < `owner`, so `requireMember('scholar-reviewer')` would also let editors approve. The review route uses `requireMember('scholar-reviewer')` as the floor (members stay out), and the use case enforces status-specific roles. There is no `requireFeature` and no `rateLimit` middleware in the app; do not add either.

## Acceptance tests

1. An editor `POST /v1/t/:tenantId/questions/:questionId/review` with `{ status: "in_review", notes: "…" }` on a `draft` (or `rejected`) question returns 200. The body parses as `Question`, `reviewStatus` is `in_review`, `reviewNotes` is the trimmed notes, `reviewedBy` and `reviewedAt` are `null`, and `updatedAt` is the clock — api — `apps/api/src/routes/questions.test.ts`
2. An editor `POST` with `status: "approved"` or `status: "rejected"` returns 403 `FORBIDDEN` and does not change the question — api — `apps/api/src/routes/questions.test.ts`
3. A scholar-reviewer `POST` with `status: "approved"` on an `in_review` question returns 200. `reviewStatus` is `approved`, `reviewedBy` is the caller’s user id, `reviewedAt` equals `updatedAt` from one clock read, and `reviewNotes` is the request notes — api — `apps/api/src/routes/questions.test.ts`
4. A scholar-reviewer `POST` with `status: "rejected"` on an `in_review` question returns 200 with `reviewStatus: "rejected"` and the same audit fields set — api — `apps/api/src/routes/questions.test.ts`
5. A scholar-reviewer `POST` with `status: "in_review"` returns 403 `FORBIDDEN` (only editor+ may submit for review) — api — `apps/api/src/routes/questions.test.ts`
6. An admin or owner may approve or reject the same way as a scholar-reviewer (200). A plain `member` gets 403 on the review route — api — `apps/api/src/routes/questions.test.ts`
7. `reviewQuestion` throws `FORBIDDEN` when an editor requests `approved`/`rejected`, and when a scholar-reviewer requests `in_review`. It throws `CONFLICT` for illegal transitions (`approved` ← not `in_review`; `in_review` ← already `approved`; `rejected` ← not `in_review`). It does not call `questions.update` on those failures — core — `packages/core/src/usecases/review-question.test.ts`
8. `reviewQuestion` sets `reviewedBy` / `reviewedAt` from the actor and `Clock` on approve/reject, and clears both to `null` on submit-for-review. Timestamps use `toIso(deps.clock.now())` — core — `packages/core/src/usecases/review-question.test.ts`
9. A request with no token gets 401 `UNAUTHENTICATED` on the review route. An editor of another tenant gets 403. Unknown or non-ULID `questionId` is 404 / 400. Missing question or other-tenant id is 404 `NOT_FOUND` — api — `apps/api/src/routes/questions.test.ts`
10. Review body with an unknown `status`, extra keys, or `notes` over 2000 code points returns 400 `VALIDATION` — api — `apps/api/src/routes/questions.test.ts` and `packages/contracts/src/question.test.ts`
11. An editor `PUT /v1/t/:tenantId/seasons/:seasonId/schedule/:dayIndex` with `{ questionId }` for an `approved` question on a valid day returns 200. The body parses as `ScheduleEntry`. Replacing the question on the same day overwrites that entry — api — `apps/api/src/routes/seasons.test.ts`
12. Scheduling a question whose `reviewStatus` is not `approved` (`draft`, `in_review`, or `rejected`) returns 409 `CONFLICT` and writes nothing — api — `apps/api/src/routes/seasons.test.ts`
13. Scheduling the same `questionId` on a second day of the same season returns 409 `CONFLICT` and leaves the first day unchanged — api — `apps/api/src/routes/seasons.test.ts`
14. `scheduleQuestion` throws `CONFLICT` when the question is not approved or when it is already scheduled on another day of that season; throws `NOT_FOUND` for a missing season or question (or wrong tenant); throws `VALIDATION` when `dayIndex` is not an integer in `1..season.lengthDays` — core — `packages/core/src/usecases/schedule-question.test.ts`
15. Schedule route: no token → 401; member or scholar-reviewer → 403; other-tenant editor → 403; missing season or question → 404; non-ULID ids → 400; dayIndex `0`, negative, non-integer path, or `lengthDays+1` → 400 `VALIDATION` — api — `apps/api/src/routes/seasons.test.ts`
16. `CreateQuestionRequest` / create path still writes `reviewedBy: null` and `reviewedAt: null`. `Question.parse` accepts those nulls and non-null audit values after review. `MemberQuestionView` still has no review or audit fields — core (contract) — `packages/contracts/src/question.test.ts`
17. The schedule-repo contract: `put` then `get` is visible only for that `tenantId`; `listBySeason` is tenant- and season-scoped; a second `put` for the same `(seasonId, dayIndex)` overwrites; a put with a mismatched `tenantId` on the stored season’s path is not inventable via `get` of another tenant — adapter — `packages/testkit/src/contracts/schedule-repo.contract.ts`, run by `packages/testkit/src/in-memory-schedule-repo.test.ts` and `apps/api/src/adapters/firebase/schedule-repo.contract.test.ts`
18. Question-repo contract still passes after the additive `reviewedBy` / `reviewedAt` fields (create round-trips nulls; update may change review fields). Extend the shared contract fixture accordingly — adapter — `packages/testkit/src/contracts/question-repo.contract.ts` (existing runners)
19. Seeded `schedule/{id}` documents are denied for client get, list, create, update and delete (authenticated and not). `questions` remain denied. Do not add an allow rule — rules — `firebase/rules.test.ts`

## Files and modules to touch

- `packages/contracts/src/question.ts` — add `ReviewQuestionRequest`; extend `Question` with `reviewedBy: Ulid | null` and `reviewedAt: UtcIso | null`. Export from `packages/contracts/src/index.ts`. Tests in `question.test.ts`.
- `packages/contracts/src/season.ts` (or `schedule.ts` if cleaner) — `ScheduleQuestionRequest`, `ScheduleEntry`. Prefer `packages/contracts/src/schedule.ts` + export from `index.ts` so season contracts stay season-shaped. Tests beside it.
- `packages/core/src/questions/question.ts` — add `reviewedBy: UserId | null` and `reviewedAt: string | null` on `Question`; update `copyQuestion`.
- `packages/core/src/usecases/create-question.ts` (+ `.test.ts`) — write `reviewedBy: null`, `reviewedAt: null`.
- `packages/core/src/usecases/update-question.ts` (+ `.test.ts`) — preserve stored `reviewedBy` / `reviewedAt` (and existing review fields).
- `packages/core/src/usecases/review-question.ts` (+ `.test.ts`) — `reviewQuestion({ clock, questions }, input)`.
- `packages/core/src/usecases/schedule-question.ts` (+ `.test.ts`) — `scheduleQuestion({ clock, seasons, questions, schedules }, input)`.
- `packages/core/src/communities/role.ts` (+ `.test.ts` if new helpers) — optional pure helpers `canSubmitForReview(role)` / `canApproveOrReject(role)` so the use case does not invent ad-hoc rank checks. Keep them next to `roleAtLeast`.
- `packages/core/src/schedule/schedule-entry.ts` — domain `ScheduleEntry`, `SCHEDULE_SCHEMA_VERSION`, id helper for `seasonId_dayIndex`.
- `packages/core/src/ports/repos.ts` — add `ScheduleRepo` beside `QuestionRepo`. Extend the `Question` port comment for the new fields. Do not add a new port file.
- `packages/core/src/deps.ts` — `schedules: ScheduleRepo`.
- `packages/core/src/index.ts` and `packages/core/src/index.test.ts` — export the new use cases, helpers and types.
- `packages/testkit/src/in-memory-schedule-repo.ts` (+ `.test.ts`) — in-memory `ScheduleRepo`.
- `packages/testkit/src/contracts/schedule-repo.contract.ts` — `runScheduleRepoContract(makeImpl)`.
- `packages/testkit/src/in-memory-question-repo.ts`, `make-test-deps.ts`, `index.ts` — wire `schedules`; question fixtures include null audit fields.
- `packages/core/src/usecases/memory-question-repo.ts` — same field updates for core unit tests.
- `apps/api/src/adapters/firebase/question-repo.ts` — persist optional/nullable `reviewedBy` / `reviewedAt` (missing on old docs → `null`). Still schemaVersion 1.
- `apps/api/src/adapters/firebase/schedule-repo.ts` — Firestore converter. Vendor types stay in this file. Corrupt docs → `INTERNAL`.
- `apps/api/src/adapters/firebase/schedule-repo.contract.test.ts` — emulator run of the shared contract; skip when no emulator, same as seasons/questions.
- `apps/api/src/routes/questions.ts` (+ `.test.ts`) — `POST .../questions/:questionId/review`. Update `questionView` to include audit fields.
- `apps/api/src/routes/seasons.ts` (+ `.test.ts`) — `PUT .../seasons/:seasonId/schedule/:dayIndex`.
- `apps/api/src/composition.ts` and `composition.test.ts` — `FirestoreScheduleRepo`.
- `firebase/rules.test.ts` — add a `schedule` seed to the deny matrix.
- `firebase/firestore.rules` — leave default deny. No new `match` block.
- `firebase/firestore.indexes.json` — leave empty. `listBySeason` is `tenantId` + `seasonId` equality only if both are stored; prefer document id `seasonId_dayIndex` and `listBySeason` via `where('seasonId','==',…)` with `tenantId` check in code, or a single-field query plus in-memory filter. If a composite index would be required, avoid it: query by `seasonId` alone and filter `tenantId` in the adapter (same spirit as question `list`).

No web files, no i18n keys, no e2e, no `.env.example` change, no new dependency.

## Contracts and data shapes

Zod is `^4.6.6`. New request/response objects are `z.strictObject`.

`ReviewQuestionRequest` (strict):

- `status`: `in_review` | `approved` | `rejected` (not `draft` — create already writes draft; there is no “un-review to draft” in this slice)
- `notes`: trimmed, 0–2000 Unicode code points (same rules as `reviewNotes`)

`Question` (editor/reviewer response) gains:

- `reviewedBy`: `Ulid | null`
- `reviewedAt`: UTC ISO ending in `Z`, or `null`

Create/update of editorial content still never accepts these from the client. `MemberQuestionView` unchanged (still strips answer, explanation, review fields).

`ScheduleQuestionRequest` (strict):

- `questionId`: Ulid

`ScheduleEntry` (strict response):

- `id`: string document id (`{seasonId}_{dayIndex}`)
- `tenantId`, `seasonId`, `questionId`: Ulid
- `dayIndex`: int `1..366`
- `scheduledBy`: Ulid
- `scheduledAt`: UtcIso

Error codes (already mapped):

| Case | Code | HTTP |
| --- | --- | --- |
| Bad JSON, strict extras, bad dayIndex, bad notes | `VALIDATION` | 400 |
| No token | `UNAUTHENTICATED` | 401 |
| Wrong role for status, non-member, other tenant | `FORBIDDEN` | 403 |
| No consent | `CONSENT_REQUIRED` | 403 |
| Missing season/question (or wrong tenant) | `NOT_FOUND` | 404 |
| Non-approved schedule, duplicate question in season, illegal review transition | `CONFLICT` | 409 |

Public body stays `{ error: { code, message } }`. Do not put notes, sources or answers in client-visible `details`.

### Role rules (use case)

| Target `status` | Allowed roles |
| --- | --- |
| `in_review` | `editor`, `admin`, `owner` (`roleAtLeast('editor')`) |
| `approved` / `rejected` | `scholar-reviewer`, or `admin` / `owner` (`role === 'scholar-reviewer' \|\| roleAtLeast('admin')`) |

Route floor for review: `requireMember('scholar-reviewer')` so members never enter the use case. Schedule route: `requireMember('editor')`.

### Review transitions

| From → To | Allowed |
| --- | --- |
| `draft` → `in_review` | yes (editor+) |
| `rejected` → `in_review` | yes (editor+, resubmit) |
| `in_review` → `in_review` | yes (idempotent; refresh notes; keep `reviewedBy`/`reviewedAt` null) |
| `in_review` → `approved` | yes (approver roles) |
| `in_review` → `rejected` | yes (approver roles) |
| `approved` → anything via this endpoint | no → `CONFLICT` |
| `draft` / `rejected` → `approved` / `rejected` | no → `CONFLICT` (must be `in_review` first) |
| `approved` / `rejected` → `in_review` from scholar-only caller | still `FORBIDDEN` if caller cannot submit; editor may move `rejected` → `in_review` only |

On `in_review`: set `reviewNotes` from `notes`, clear `reviewedBy`/`reviewedAt` to `null`. On approve/reject: set `reviewNotes`, `reviewedBy = actor`, `reviewedAt = updatedAt = toIso(clock.now())`.

### Firestore

`questions/{questionId}` — same document; additive fields. `schemaVersion` stays `1`. Adapter: absent `reviewedBy`/`reviewedAt` → `null`.

```jsonc
{
  "id": "01J…",
  "tenantId": "01J…",
  "type": "mcq",
  "difficulty": "beginner",
  "topic": "fasting",
  "locales": { "en": { "title": "…", "prompt": "…", "choices": ["…", "…"], "explanation": "…" } },
  "answer": { "choiceIndex": 0 },
  "sources": [{ "kind": "quran", "ref": "2:183" }],
  "reviewStatus": "approved",
  "reviewNotes": "ok",
  "authoredBy": "01J…",
  "reviewedBy": "01J…",
  "reviewedAt": "2026-11-06T12:00:00.000Z",
  "createdAt": "2026-11-05T09:00:00.000Z",
  "updatedAt": "2026-11-06T12:00:00.000Z",
  "schemaVersion": 1
}
```

`schedule/{seasonId}_{dayIndex}` — top-level, flat. Id is exactly `` `${seasonId}_${dayIndex}` `` (ULID has no `_`, so parsing is unambiguous).

```jsonc
{
  "id": "01JSEASON_3",
  "tenantId": "01J…",
  "seasonId": "01JSEASON",
  "dayIndex": 3,
  "questionId": "01JQ…",
  "scheduledBy": "01JU…",
  "scheduledAt": "2026-11-06T12:05:00.000Z",
  "schemaVersion": 1
}
```

`ScheduleRepo`:

- `get(tenantId, seasonId, dayIndex)` → entry or null (null if missing or `tenantId` mismatch)
- `listBySeason(tenantId, seasonId)` → unsorted entries for that season in that tenant
- `put(entry)` → upsert by `entry.id`; timestamps/ids are arguments (no clock in the adapter)

`scheduleQuestion` flow: load season → validate dayIndex → load question → require `reviewStatus === 'approved'` → `listBySeason` and reject if another day already has this `questionId` → `put` with `scheduledBy` from membership user id and `scheduledAt` from clock. `tenantId` always from `c.var.membership.tenantId`.

Routes:

- `POST /v1/t/:tenantId/questions/:questionId/review` — `bodyLimit` 4096, `requireUser`, `requireConsent`, `requireMember('scholar-reviewer')`, `parseJsonBody(ReviewQuestionRequest)`, 200 `Question`. Pass `role` and `userId` from membership into the use case.
- `PUT /v1/t/:tenantId/seasons/:seasonId/schedule/:dayIndex` — `bodyLimit` 4096, `requireUser`, `requireConsent`, `requireMember('editor')`, `parseJsonBody(ScheduleQuestionRequest)`, 200 `ScheduleEntry`. Parse `dayIndex` from the path as a base-10 integer before the use case.

## Hard rules that apply here

- **Core stays free of vendors (rule 1).** Use cases call `QuestionRepo`, `SeasonRepo` and `ScheduleRepo` only.
- **New I/O is a port plus a fake plus one shared contract (rule 2).** `ScheduleRepo` in `ports/repos.ts`, fake in testkit, both run `runScheduleRepoContract`.
- **The browser never writes (rule 3).** Rules stay default deny; seed `schedule` in rules tests only.
- **Tenant isolation (rule 4).** Every schedule and question doc has `tenantId`. Cross-tenant ids are `NOT_FOUND`. Routes pass `membership.tenantId`.
- **Time from `Clock` (rule 5).** `reviewedAt`, `updatedAt` and `scheduledAt` use `toIso(deps.clock.now())`. No `Date.now()` in core or routes.
- **Roles are server-side (rule 6).** Client cannot send `reviewedBy`, `reviewStatus` on create/patch, or elevate via body. Approve/reject is not `roleAtLeast('scholar-reviewer')` (that would include editors).
- **Provenance (rule 11).** Only `approved` questions are scheduleable. Agents still must not mark content approved; only the review use case under approver roles writes `approved`.
- **No client-trusted day index for answers (T034+).** This slice only stores the mapping; it does not expose today’s question.

## Out of scope

- `GET /v1/t/:tenantId/today`, member question HTTP, and the Today UI (T034).
- Un-scheduling / `DELETE` a day, GET schedule list HTTP, multi-track schedules (T102).
- The 7-day “live or starts soon” scheduling restriction from the question-content skill (T102 calendar flags). Any season may receive approved questions here.
- Scholar review queue UI and editor studio (T100, T101).
- Moving `approved` back to `draft` / `in_review`, or bulk schedule.
- `true_false` / `free_text` / import script (T035, T070).
- Entitlements, `custom_questions`, `rateLimit` middleware, client reads of `questions` or `schedule` in rules.
- Changing role order or renaming roles.
