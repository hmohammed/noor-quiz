# Spec — T032 Draft multiple-choice questions

Editors of a community draft `mcq` questions with sources. The question document stores the answer. Member-facing code uses a separate contract that removes it. This slice has no web page.

`requireMember('editor')` is the gate. Role order is already `member` < `scholar-reviewer` < `editor` < `admin` < `owner`, so editor, admin and owner pass, and member and scholar-reviewer do not. There is no `requireFeature` and no `rateLimit` middleware in the app; do not add either.

## Acceptance tests

1. A member who calls `POST`, `GET` or `PATCH /v1/t/:tenantId/questions` gets 403 `FORBIDDEN` — api — `apps/api/src/routes/questions.test.ts`
2. A scholar-reviewer gets the same 403 on all three routes — api — `apps/api/src/routes/questions.test.ts`
3. A request with no token gets 401 `UNAUTHENTICATED` on all three routes — api — `apps/api/src/routes/questions.test.ts`
4. An editor of another tenant gets 403 `FORBIDDEN` on all three routes (the path tenant is not their membership) — api — `apps/api/src/routes/questions.test.ts`
5. An editor without consent gets 403 `CONSENT_REQUIRED` on `POST` — api — `apps/api/src/routes/questions.test.ts`
6. An editor `POST` with two or more choices, a `choiceIndex` inside that range, and at least one source returns 201. The body parses with `Question` (it keeps `answer.choiceIndex`), `type` is `mcq`, `reviewStatus` is `draft`, `reviewNotes` is `""`, and `authoredBy` is the caller’s user id — api — `apps/api/src/routes/questions.test.ts`
7. `POST` with fewer than 2 choices returns 400 `VALIDATION` and writes nothing — api — `apps/api/src/routes/questions.test.ts`
8. `POST` whose `choiceIndex` is missing, not an integer, negative, or greater than or equal to the choice count returns 400 `VALIDATION` and writes nothing — api — `apps/api/src/routes/questions.test.ts`
9. `CreateQuestionRequest` rejects fewer than 2 choices and an out-of-range `choiceIndex` — core (contract) — `packages/contracts/src/question.test.ts`
10. `createQuestion` throws `VALIDATION` for fewer than 2 choices and for a bad `choiceIndex`, and does not call `questions.create` — core — `packages/core/src/usecases/create-question.test.ts`
11. `MemberQuestionView.parse` of a full question (with `answer` and per-locale `explanation`) succeeds, the result has no `answer` key, no locale has `explanation`, and `prompt` and `choices` are unchanged — core (contract) — `packages/contracts/src/question.test.ts`
12. `Question.parse` of that same fixture keeps `answer.choiceIndex` and `explanation`, so the editor response is not the member view — core (contract) — `packages/contracts/src/question.test.ts`
13. `POST` or `PATCH` that sends `reviewStatus`, `type`, `tenantId`, `authoredBy`, `id` or `schemaVersion` returns 400 `VALIDATION` (strict body). A successful create is still `draft` — api — `apps/api/src/routes/questions.test.ts`
14. `POST` or `PATCH` with `sources` missing or empty, an unknown source `kind`, or a blank `ref` returns 400 `VALIDATION` — api — `apps/api/src/routes/questions.test.ts`
15. `PATCH` of one allowed field returns 200, keeps `id`, `tenantId`, `type`, `reviewStatus`, `authoredBy`, `createdAt` and `schemaVersion`, and sets `updatedAt` from the clock. An empty object is 400. An unknown id, a non-ULID id, or another tenant’s question id on this tenant’s path is 404 `NOT_FOUND` (non-ULID is 400) — api — `apps/api/src/routes/questions.test.ts` and `packages/core/src/usecases/update-question.test.ts`
16. `GET` returns 200 `{ questions }` for an editor, including an empty list. Each item parses as `Question` and includes `answer`. Only this tenant’s questions are included, newest `createdAt` first, then `id` — api — `apps/api/src/routes/questions.test.ts` and `packages/core/src/usecases/list-questions.test.ts`
17. The question-repo contract: create then `get` is visible only for that `tenantId`; `list` is tenant-scoped; a second `create` with the same id is `CONFLICT` and does not overwrite; `update` changes content fields only; a `sources: []` draft round-trips — adapter — `packages/testkit/src/contracts/question-repo.contract.ts`, run by `packages/testkit/src/in-memory-question-repo.test.ts` and `apps/api/src/adapters/firebase/question-repo.contract.test.ts`
18. A seeded `questions/{questionId}` document is denied for client get, list, create, update and delete, including an unauthenticated client and an authenticated client — rules — `firebase/rules.test.ts` (add the collection to the existing `seeds` map; do not add an allow rule)

## Files and modules to touch

- `packages/contracts/src/question.ts` — `Question`, `MemberQuestionView`, `CreateQuestionRequest`, `UpdateQuestionRequest`, `QuestionListResponse`. Export from `packages/contracts/src/index.ts`. Tests in `question.test.ts`.
- `packages/core/src/questions/question.ts` — domain `Question`, `QUESTION_SCHEMA_VERSION`, `asQuestionId`, difficulty and source-kind lists. Core does not import `@noor/contracts`. Keep the lists in the same order as the contract enums.
- `packages/core/src/questions/question-fields.ts` — normalise and `assertQuestion` (choice count, shared choice length across locales, `choiceIndex`, sources). Pure functions, no I/O.
- `packages/core/src/usecases/create-question.ts` (+ `.test.ts`) — `createQuestion({ clock, ids, questions }, input)`.
- `packages/core/src/usecases/update-question.ts` (+ `.test.ts`) — `updateQuestion({ clock, questions }, input)`.
- `packages/core/src/usecases/list-questions.ts` (+ `.test.ts`) — `listQuestions({ questions }, { tenantId })`.
- `packages/core/src/ports/repos.ts` — add `QuestionRepo` beside `SeasonRepo`. Do not add a new port file.
- `packages/core/src/deps.ts` — `questions: QuestionRepo`.
- `packages/core/src/index.ts` and `packages/core/src/index.test.ts` — export the use cases, `asQuestionId`, and the new constants the same way seasons are exported.
- `packages/testkit/src/in-memory-question-repo.ts` (+ `.test.ts`) — in-memory `QuestionRepo`.
- `packages/testkit/src/contracts/question-repo.contract.ts` — `runQuestionRepoContract(makeImpl)`.
- `packages/testkit/src/make-test-deps.ts` and `packages/testkit/src/index.ts` — wire `questions`. It is its own store, not the community store.
- `apps/api/src/adapters/firebase/question-repo.ts` — Firestore converter. Vendor types stay in this file. Corrupt stored docs throw `INTERNAL`, same as seasons.
- `apps/api/src/adapters/firebase/question-repo.contract.test.ts` — emulator run of the shared contract. Skip the same way the season contract test skips when no emulator is configured.
- `apps/api/src/routes/questions.ts` (+ `.test.ts`) — the three routes. Mount from `apps/api/src/app.ts`.
- `apps/api/src/composition.ts` and `apps/api/src/composition.test.ts` — `FirestoreQuestionRepo`.
- `firebase/rules.test.ts` — add a `questions` seed so the existing deny matrix covers the collection.
- `firebase/firestore.rules` — leave the default deny as it is. No new `match` block.
- `firebase/firestore.indexes.json` — leave indexes empty. `list` is a single-field `tenantId` equality; sort in the use case, not with `orderBy`.

No web files, no i18n keys, no e2e, no `.env.example` change, no new dependency.

## Contracts and data shapes

Zod is `^4.6.6`. `Question` and both request bodies are `z.strictObject`. `MemberQuestionView` and its locale object are `z.object` (unknown keys are stripped). Do not build the member view with `.strict()`, `z.strictObject`, or `z.looseObject`. A strict view would reject `answer` instead of removing it, and a loose view would keep it.

Supported locale keys are the existing `SUPPORTED_LOCALES`: `en`, `sv`, `ar`, `am`, `so`. At least one is required. Unknown locale keys fail the strict request. Text is trimmed only. Do not NFC-normalise or collapse inner whitespace; Quran wording must stay as the editor sent it. Lengths are Unicode code points (`Array.from`), not UTF-16 units.

`CreateQuestionRequest` (strict; server-owned keys are rejected):

- `difficulty`: `beginner` | `intermediate` | `scholar`
- `topic`: trimmed, 1–48 code points
- `locales`: strict object of optional locale keys. Each present locale is `{ title, prompt, choices, explanation }`
  - `title` 1–120, `prompt` 1–2000, `explanation` 0–2000 (empty string allowed)
  - `choices`: 2–6 strings, each 1–300 code points
  - every present locale has the same `choices.length`
- `answer`: strict `{ choiceIndex: int }`. `0 <= choiceIndex < choices.length`
- `sources`: 1–8 items of strict `{ kind: "quran" | "hadith" | "book", ref: string }`. `ref` is trimmed, 1–200 code points. Do not parse verse numbers.

`UpdateQuestionRequest` is the same fields, all optional, at least one key, no extras. The use case merges onto the stored question and runs `assertQuestion` on the result. `reviewStatus` is not a patch field.

`Question` (editor response, strict) adds:

- `id`, `tenantId` (ULIDs)
- `type`: literal `mcq`
- `reviewStatus`: literal `draft` for anything this slice writes. The schema also accepts `in_review` | `approved` | `rejected` so a later task can return them without a new response type. This slice never writes those three.
- `reviewNotes`: string, 0–2000. This slice always writes `""`.
- `authoredBy`: ULID (the editor). Do not accept `ai:<model>` yet.
- `createdAt`, `updatedAt`: UTC ISO timestamps ending in `Z`, the same pattern as `SeasonView`

`Question` omits `schemaVersion`. The route maps named fields and then `Question.parse`, the same way `seasonView` does.

`QuestionListResponse`: strict `{ questions: Question[] }`.

`MemberQuestionView` (strip object): `id`, `tenantId`, `type`, `difficulty`, `topic`, `locales` (`title`, `prompt`, `choices` only), `sources`. It has no `answer`, `explanation`, `reviewStatus`, `reviewNotes`, `authoredBy`, timestamps or `schemaVersion`.

Error codes, already mapped in `apps/api/src/errors.ts`:

| Case | Code | HTTP |
| --- | --- | --- |
| Bad JSON, strict-body extra key, choice/source/locale rule | `VALIDATION` | 400 |
| No token | `UNAUTHENTICATED` | 401 |
| Non-member, other tenant, member, scholar-reviewer | `FORBIDDEN` | 403 |
| No consent | `CONSENT_REQUIRED` | 403 |
| Unknown id, or id not in this tenant | `NOT_FOUND` | 404 |
| Duplicate question id in the repo | `CONFLICT` | 409 |

The public body stays `{ error: { code, message } }`. Do not echo choice text, sources or the answer in `details` that reach the client. `details` stay server-side.

Firestore `questions/{questionId}` (top-level, ULID id, flat). `QuestionRepo` methods take `tenantId` first on reads: `get(tenantId, questionId)`, `list(tenantId)`, `create(question)`, `update(question)`. `get` returns null when the doc is missing or `tenantId` differs. Timestamps and ids are arguments; the adapter does not read a clock or mint an id.

```jsonc
{
  "id": "01J…",
  "tenantId": "01J…",
  "type": "mcq",
  "difficulty": "beginner",
  "topic": "fasting",
  "locales": {
    "en": { "title": "…", "prompt": "…", "choices": ["…", "…"], "explanation": "…" }
  },
  "answer": { "choiceIndex": 0 },
  "sources": [{ "kind": "quran", "ref": "2:183" }],
  "reviewStatus": "draft",
  "reviewNotes": "",
  "authoredBy": "01J…",
  "createdAt": "2026-11-05T09:00:00.000Z",
  "updatedAt": "2026-11-05T09:00:00.000Z",
  "schemaVersion": 1
}
```

The adapter accepts `sources` length 0–8 so a later import can store a draft with `sources: []` without a schema bump. `createQuestion` and `updateQuestion` still require 1–8 sources. The repo contract includes one empty-sources draft round-trip; the HTTP tests do not.

`createQuestion` sets `type: "mcq"`, `reviewStatus: "draft"`, `reviewNotes: ""`, `authoredBy` from the membership user id, `schemaVersion: 1`, and `createdAt === updatedAt` from one `clock.now()`. The id comes from `ids.newId()` then `asQuestionId`. `tenantId` is the argument the route took from `c.var.membership.tenantId`, not from the body or a raw path string inside the use case. The route still uses `requireMember`, which checks the path.

`updateQuestion` reads with `get(tenantId, questionId)`. Null is `NOT_FOUND`. It does not change identity fields. `updatedAt` is a new clock read.

Routes, same middleware order as seasons:

- `POST /v1/t/:tenantId/questions` — `bodyLimit` 32768, `requireUser`, `requireConsent`, `requireMember('editor')`, `parseJsonBody(CreateQuestionRequest)`, 201 `Question`
- `GET /v1/t/:tenantId/questions` — `requireUser`, `requireConsent`, `requireMember('editor')`, 200 `QuestionListResponse`
- `PATCH /v1/t/:tenantId/questions/:questionId` — same write chain, `UpdateQuestionRequest`, 200 `Question`

Oversize body is `VALIDATION` (`body-too-large`), using the seasons `bodyLimit` pattern. 32768 is enough for five locales; do not copy the season 4096 cap.

## Hard rules that apply here

- **Core stays free of vendors (rule 1).** Use cases call `QuestionRepo` only. The Firestore converter lives under `apps/api/src/adapters/firebase/`.
- **New I/O is a port plus a fake plus one shared contract (rule 2).** `QuestionRepo` is added to `ports/repos.ts`, the fake is in testkit, and both the fake and the Firestore adapter run `runQuestionRepoContract`.
- **The browser never writes questions (rule 3).** Rules stay default deny. The new collection is only added to the rules test seeds.
- **Tenant isolation (rule 4).** Every document has `tenantId`. `get` and `list` take it. A cross-tenant id is `NOT_FOUND`, not the other tenant’s document. The route passes `c.var.membership.tenantId`.
- **Time comes from `Clock` (rule 5).** `createdAt` and `updatedAt` use `toIso(deps.clock.now())`. No `Date.now()` in core or the route.
- **Roles are server-side (rule 6).** `requireMember('editor')` reads the membership. `authoredBy`, `tenantId`, `reviewStatus` and `type` from the client are rejected, not trusted.
- **Our own ids (rule 8).** `questionId` is a ULID from `IdGenerator`.
- **Provenance (rule 11).** The editor write path requires at least one source (`quran`, `hadith` or `book` plus a specific `ref`). Create always stores `draft`. Nothing in this slice sets `approved`. Agents must not mark a question approved.
- **Answers stay off the member contract.** Editor HTTP responses parse with `Question` and include `answer`. `MemberQuestionView.parse` is what drops `answer` and `explanation`. Do not use the member view as the response of these three routes.

## Out of scope

- Review transitions, `in_review` / `approved` / `rejected` writes, `reviewedBy`, `reviewedAt` (T033).
- Season schedule and “only approved questions go live” (T033).
- `GET /v1/t/:tenantId/today` and any member HTTP question route (T034). `MemberQuestionView` is only a contract here.
- `scripts/import-questions.ts` and `true_false` / `free_text` / `ordering` (T035, T070).
- A question editor screen, translations workflow, or i18n strings (T100, T082).
- `authoredBy` of the form `ai:<model>` (T148).
- Delete, pagination, `GET` by id, entitlements, `custom_questions`, and a new `rateLimit` middleware.
- Client reads of `questions` in `firestore.rules`.
- Checking that a Quran quotation is exact, or looking up a hadith. The `ref` is stored as the editor wrote it.
