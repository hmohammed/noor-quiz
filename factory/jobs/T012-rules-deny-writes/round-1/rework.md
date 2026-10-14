# Human rework — T012 (from hmohammed via /factory)

Port 8080 is permanently taken on the developer's machine (Docker Desktop). Move the Firestore emulator off it for good.

1. `firebase/firebase.json`: Firestore emulator port 8080 → **8180** (127.0.0.1). Leave auth 9099, functions 5001 and ui 4000 unchanged.
2. Update every other reference to the Firestore emulator port: README.md line 43 ("port 8080 must be free" → 8180), and anything else (e2e config, scripts, docs, tests) that hard-codes 8080 for Firestore. `git grep 8080` currently finds only those two files.
3. Run `npm run test:emulator` **unchanged, as committed**, and record the result (expect 67/67). 8180 is free on this host. Also run lint, typecheck, `npm test`.
4. Commit on `factory/T012-rules-deny-writes`; append a `## Round 2` section to build.md.

Do not touch any other scope. The P3 lint nits from the security review are not part of this rework.
