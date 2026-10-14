# Spec — T012 Firestore rules baseline: deny every client write

Size: fits one task. It adds no port, no route, no screen, and no migration. It has three parts: the rules file (already deny-all), the rules tests with the emulator script they need, and one ESLint block with its test.

## Acceptance tests

Rules tests run on the Firestore emulator through `npm run test:emulator` (created by this task, see below). Every case uses `assertFails` from `@firebase/rules-unit-testing`. Each collection is seeded first with `testEnv.withSecurityRulesDisabled`, so get, update and delete hit a doc that exists. Collections under test: `users`, `identities`, and one arbitrary collection (`anything`). For `users` and `identities` the seeded doc id equals the authenticated uid, which is the "own doc" case.

1. Unauthenticated `getDoc` on `users/{id}`, `identities/{id}` and `anything/{id}` is denied — rules — `firebase/rules.test.ts`
2. Unauthenticated `getDocs(collection(...))` (list) on all three collections is denied — rules — `firebase/rules.test.ts`
3. Unauthenticated `setDoc` (create new doc), `updateDoc` (existing doc) and `deleteDoc` (existing doc) on all three collections are denied — rules — `firebase/rules.test.ts`
4. Authenticated client (`testEnv.authenticatedContext('uid-alice')`) `getDoc` on its own `users/uid-alice` and `identities/uid-alice`, and on `anything/x`, is denied — rules — `firebase/rules.test.ts`
5. Authenticated client list query on all three collections is denied — rules — `firebase/rules.test.ts`
6. Authenticated client `setDoc` / `updateDoc` / `deleteDoc` on its own doc in all three collections, and an `addDoc` to `anything`, is denied — rules — `firebase/rules.test.ts`
7. An authenticated client with a forged custom claim (`{ platformAdmin: true, tenantId: 'x', role: 'owner' }`) still cannot read or write any of the three collections (AGENT.md rule 6: claims do not open client access) — rules — `firebase/rules.test.ts`
8. A batched write (`writeBatch`) and a `runTransaction` from an authenticated client are denied — rules — `firebase/rules.test.ts`
9. Sanity: the seeded doc exists when read through `withSecurityRulesDisabled`. This proves the denials come from the rules and not from a missing doc — rules — `firebase/rules.test.ts`
10. Lint fails (rule `no-restricted-imports`, severity 2) on a virtual fixture `apps/web/src/__lint_fixture__.ts` containing `import { setDoc } from 'firebase/firestore'` — tooling — `tooling/src/eslint-web-firestore-writes.test.ts`
11. Same failure for each of `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `runTransaction` (`it.each`), from both `firebase/firestore` and `firebase/firestore/lite` — tooling — same file
12. Same failure for a `.tsx` fixture (`apps/web/src/__lint_fixture__.tsx`), an aliased import (`import { setDoc as s }`), a namespace import (`import * as fs from 'firebase/firestore'`) and a re-export (`export { setDoc } from 'firebase/firestore'`) — tooling — same file
13. Read APIs stay allowed in apps/web: `import { getDoc, onSnapshot, doc, collection, query } from 'firebase/firestore'` gives no `no-restricted-imports` message. Later realtime reads of `leaderboardViews` / `liveRounds` need this — tooling — same file
14. The ban does not apply outside apps/web: `import { setDoc } from 'firebase/firestore'` in a virtual `apps/api/src/__lint_fixture__.ts` gives no message. The existing core-boundary tests still pass unchanged — tooling — same file and `tooling/src/eslint-core-boundary.test.ts`
15. `tooling/src/docs-commands.test.ts` still passes after `test:emulator` is added to `package.json` and to the AGENT.md / README command lists — tooling — existing file

Mapping: AC "Rules tests: unauthenticated and authenticated clients cannot read or write users, identities or an arbitrary collection" maps to tests 1–9. AC "Lint fails on a fixture that imports setDoc in apps/web" maps to tests 10–14. There are no new routes, so unauthorised and wrong-tenant route tests do not apply.

## Files and modules to touch

- `firebase/firestore.rules`: keep the single `match /{document=**} { allow read, write: if false; }`. Update the comment so it says this is the baseline and that every future allow must be narrow, read-only, come with its own rules tests (per the `firestore-data` skill), and use no wildcard allow. No functional change.
- `firebase/rules.test.ts` (new): uses `initializeTestEnvironment({ projectId: 'demo-noor', firestore: { rules: readFileSync(<repo>/firebase/firestore.rules, 'utf8') } })`. Host and port come from `FIRESTORE_EMULATOR_HOST`, which `emulators:exec` sets. Do not hard-code them. Read the rules from the real file and never inline a copy. Use `clearFirestore()` in `beforeEach` and `cleanup()` in `afterAll`. Use the modular `firebase/firestore` API on `context.firestore()`.
- `firebase/vitest.config.ts` (new): `defineConfig({ test: { name: 'rules', include: ['rules.test.ts'], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false } })`. Do NOT add `firebase` to the root `vitest.config.ts` `projects`. `npm test` must stay emulator-free.
- `firebase/tsconfig.json` (new): extends `../tsconfig.base.json` with `rootDir: "."`, `outDir: "dist"`, `tsBuildInfoFile: "dist/tsconfig.tsbuildinfo"`, `types: ["node"]`, and includes `rules.test.ts` and `vitest.config.ts`. Add `{ "path": "firebase" }` to the root `tsconfig.json` references so `npm run typecheck` covers the test. Check that `firebase/dist` is git-ignored (the existing `dist` pattern should already cover it).
- `package.json` (root):
  - Add the script `"test:emulator": "firebase emulators:exec --only firestore --config firebase/firebase.json --project demo-noor \"vitest run --config firebase/vitest.config.ts\""`.
  - Add devDependencies `@firebase/rules-unit-testing` and `firebase`, which is its required peer. Justification: this is the official emulator client for rules tests. Exit path: the package is only used in `firebase/rules.test.ts`.
  - Do not add `firebase` to `apps/web` in this task.
- `eslint.config.js`: add one block `{ files: ['apps/web/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', webFirestoreWrites] } }`. `webFirestoreWrites` has `paths` entries for `firebase/firestore`, `firebase/firestore/lite` and `@firebase/firestore`, each with `importNames: ['setDoc','addDoc','updateDoc','deleteDoc','writeBatch','runTransaction']`. The message is "The browser never writes to Firestore (AGENT.md rule 3). Call the API." Keep the core block as it is. The two blocks target disjoint globs, so neither overrides the other.
- `tooling/src/eslint-web-firestore-writes.test.ts` (new): copy the structure of `eslint-core-boundary.test.ts` (virtual fixture paths that must not exist on disk, `ESLint#lintText`, warm-up in `beforeAll`).
- `AGENT.md` Commands block: remove `# not yet — T004` from the `npm run test:emulator` line, because this task creates the script. Keep the `deploy:staging` marker.
- `README.md`: add a `npm run test:emulator` line to the commands list, noting that it needs Java 21 (already listed as a prerequisite).
- `docs/tasks/E01-identity-privacy.md` T012 Notes: a short note for the next task saying that `test:emulator` exists and that T004 only needs to wire it into CI.

## Contracts and data shapes

No zod contracts, routes or error codes. Test-only data:

- Seed `users/uid-alice`: `{ id: 'uid-alice', displayName: 'Alice', createdAt: '2026-01-01T00:00:00.000Z', schemaVersion: 1 }`
- Seed `identities/uid-alice`: `{ provider: 'firebase', uid: 'uid-alice', userId: '01J...', schemaVersion: 1 }`
- Seed `anything/x`: `{ v: 1 }`

These docs are fixtures only. They do not define the real `users` / `identities` schema, which a later identity task owns. Use fixed ISO strings and no `new Date()`.

## Hard rules that apply here

- **Rule 3 (browser never writes):** the rules stay deny-all, and the lint block stops write APIs from even being imported in apps/web. Do not add any `allow` statement in this task.
- **Rule 6 (never trust client role/claims):** test 7 proves that forged claims open nothing.
- **Rule 4 (tenant isolation):** there are no tenant-readable collections yet, so nothing is exposed. Do not pre-create `leaderboardViews` / `liveRounds` read rules here.
- **Rule 9 (secrets):** the emulator runs with project `demo-noor`. It needs no credentials and no service account, and no `.env` is touched.
- **Rule 1:** nothing goes into `packages/core`. The new dependencies are root devDependencies only.
- **Testing expectations:** rules tests live in `firebase/rules.test.ts` as AGENT.md says, and `npm test` stays runnable without Java or emulators.

## Out of scope

- The CI job that runs `npm run test:emulator`. That belongs to T004, which only has to call the script.
- Any read rules (`leaderboardViews`, `liveRounds`, membership `exists()` checks) and any real `users` / `identities` schema or repository.
- Adding the Firebase web SDK to `apps/web` or wiring a Firestore client in the browser.
- Banning dynamic `import('firebase/firestore')` or wrapper packages (e.g. `reactfire`) through custom ESLint rules. Note it in T012 Notes as a possible follow-up if needed.
- Changes to `firebase.json` emulator ports, `firestore.indexes.json`, or deploying rules to any cloud project.
