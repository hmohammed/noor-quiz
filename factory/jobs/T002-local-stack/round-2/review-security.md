VERDICT: PASS
# Security review — T002 round 2

Scope: `git diff main...factory/T002-local-stack`. The branch tip is `a836c71`, which is the only commit since round 1. `git diff a836c71~1 factory/T002-local-stack` touches one file, `apps/web/src/features/home/HomePage.tsx`, with one line changed. The worktree is clean. I did not start the emulators or run network commands.

## Findings
None at P0–P2.

- `apps/web/src/features/home/HomePage.tsx:31`: adds `role="status"` to the existing status `<p>`. This is a static ARIA attribute. The text is still rendered through `t(statusKey[status])`, which comes from a fixed enum, so there is no new client input, no `dangerouslySetInnerHTML`, no new fetch target, no Firebase SDK, no clock and no logging. It has no security impact.
- Everything else matches round 1: deny-all `firebase/firestore.rules`, emulators bound to loopback with `demo-noor`, public `GET /v1/health` behind the strict contract, the Vite proxy limited to loopback, and no secrets or `.env*` files. My round-1 verdict stands.

## Hard rules
1. core vendor-free — ok (core not touched; contracts imports only zod)
2. ports + adapters + fakes — ok (firebase-functions only in `apps/api/src/function.ts`; no new port)
3. no client Firestore writes — ok (rules deny all reads and writes; web has no Firebase SDK)
4. tenant isolation — ok (n/a: no tenant data; the only route is public and returns constants)
5. time from Clock — ok (no Date in routes, contracts or web; no test mode)
6. roles server-side — ok (no client input accepted as authority)
7. entitlements not plan names — ok (n/a: nothing gated)
8. own IDs — ok (n/a: no IDs introduced)
9. secrets — ok (demo-noor only; no .firebaserc, .env*, service account or credentials; nothing logged)
10. AI output untrusted — ok (n/a: no AI code)
11. religious content provenance — ok (n/a: no question content)

## Nits (non-blocking)
The round-1 P3 items still apply and are unchanged. They are deferred to T004: the uuid 9.0.1 runtime transitive via firebase-admin, the @playwright/test bump before CI browser installs, explicit `invoker` and `maxInstances` on `onRequest`, and the build version exposed on `/v1/health`.
