## T012

**Firestore rules baseline: deny every client write**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002) · Tags: `sec`
Skills: `firestore-data`

**Goal.** The database is closed by default, so the old app's direct-write exploits are impossible.

**Scope**

- `firebase/firestore.rules`: default deny read+write
- `firebase/rules.test.ts` with `@firebase/rules-unit-testing`
- Lint rule in apps/web banning imports of Firestore write APIs (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`, `runTransaction`)

**Acceptance criteria**

- [ ] Rules tests: unauthenticated and authenticated clients cannot read or write `users`, `identities` or an arbitrary collection
- [ ] Lint fails on a fixture that imports `setDoc` in apps/web

**Notes**

_(implementer adds notes for the next task here)_

---
BOARD row: Tags: sec · Phase: P1
