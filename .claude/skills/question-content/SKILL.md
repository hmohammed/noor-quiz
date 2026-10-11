---
name: question-content
description: Author, import, translate or schedule quiz questions using the Noor Quiz question schema with sources and review status. Use when creating question banks, importing old data.json, drafting with AI, or scheduling questions into a season.
---

# Question content

## Schema (see `packages/contracts/src/question.ts`)
```jsonc
{
  "id": "01J...",                 // ULID
  "tenantId": "global",           // or a community id
  "type": "mcq" | "true_false" | "free_text" | "ordering",
  "difficulty": "beginner" | "intermediate" | "scholar",
  "topic": "fasting",
  "locales": {
    "en": { "title": "...", "prompt": "...", "choices": ["..."], "explanation": "..." },
    "ar": { ... }
  },
  "answer": { "choiceIndex": 2 } | { "rubric": "...", "modelAnswer": "..." },
  "sources": [{ "kind": "quran", "ref": "2:183" }, { "kind": "hadith", "ref": "Bukhari 1904" }, { "kind": "book", "ref": "Tafsir Ibn Kathir, 2:183" }],
  "reviewStatus": "draft" | "in_review" | "approved" | "rejected",
  "reviewNotes": "",
  "authoredBy": "userId|ai:<model>"
}
```
Answers live with the question in storage but are **never** returned by member endpoints before the question closes (contracts enforce separate `MemberQuestionView`).

## Rules
- Every question needs at least one specific source. No source → stays `draft`.
- Agents may create `draft` and move to `in_review` (via the `content-reviewer` agent). Only a human `scholar-reviewer` sets `approved`.
- Only `approved` questions can be scheduled into a season that is live or starts within 7 days.
- Quran quotations are exact; translations name the translation used.
- Keep wording neutral; avoid sectarian disputes unless a community authors its own bank.

## Import
`scripts/import-questions.ts <file.json> --tenant=global --dry-run` validates against the schema and reports problems; without `--dry-run` writes `draft`/`in_review` questions. The old `../ramadan/data.json` imports as `free_text`, `reviewStatus: draft`, with `sources: []` flagged for review.

## Scheduling
A `schedule` entry maps `(seasonId, dayIndex) → questionId` (optionally per track). Check: each day has one question per track, no question reused within a season.
