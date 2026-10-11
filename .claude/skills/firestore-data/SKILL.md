---
name: firestore-data
description: Model a new Firestore collection, implement its repository adapter, indexes and security rules, and test them on the emulator. Use when a task adds or changes persisted data.
---

# Firestore data, repositories and rules

## Model
- Top-level collection, plural noun, flat document, our own ULID as doc id (or a deterministic composite id for uniqueness, e.g. `answers/{questionId}_{userId}`).
- Always: `id`, `tenantId` (if tenant-owned), `createdAt`, `updatedAt` (ISO strings from `Clock`), `schemaVersion`.
- Only scalar fields, arrays of scalars and shallow maps — anything must map to SQL columns.
- Document the shape in the repo interface's JSDoc and in the task.

## Repository
- Interface in `packages/core/src/ports/repos.ts`; every method takes `tenantId` first for tenant-owned data.
- Adapter in `apps/api/src/adapters/firebase/<name>-repo.ts`; converter maps Firestore ↔ domain type; no Firestore types leak out.
- Uniqueness and counters via transactions; hot counters via sharded counter docs or rollups (never one hot doc written per answer at scale).
- In-memory version in `packages/testkit`; both pass the shared repo contract.

## Indexes
Add composite indexes to `firebase/firestore.indexes.json` in the same task that adds the query.

## Rules
`firebase/firestore.rules` — default deny. Client writes: never. Client reads: only collections explicitly designed for realtime (`leaderboardViews`, `liveRounds`), scoped to members:
```
match /leaderboardViews/{id} {
  allow read: if request.auth != null
    && exists(/databases/$(database)/documents/memberships/$(request.auth.token.noorUserId + '_' + resource.data.tenantId));
  allow write: if false;
}
```
Add rules tests in `firebase/rules.test.ts` for every new collection: unauthenticated read denied, other-tenant read denied, any client write denied.

## Migrations
Additive changes only during a season. Bump `schemaVersion`; write a one-off script in `scripts/migrations/NNNN-*.ts` that is idempotent and dry-run by default.
