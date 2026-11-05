VERDICT: PASS
# Security review — T021 round 4

## Findings
None.

`6e8bd7c` changes only `apps/web/package.json` and `package-lock.json`. `@playwright/test` moves from `1.51.1` to `1.61.0`, and the lockfile follows with `playwright` and `playwright-core` at the same version. All three stay `"dev": true`, resolve from `https://registry.npmjs.org`, and keep integrity hashes. No new dependency, script, or bin is added. `playwright.config.ts` is not in the diff. App and API source do not import Playwright; it is only the e2e runner (`apps/web/e2e/**`, `playwright.config.ts`, `test:e2e`).

`08a8fe6` and `51360f8` are factory records (`BOARD.md` status, job markdown, `merge.md`). They do not touch routes, use cases, adapters, rules, or the web client.

Invite behaviour on `origin/main...factory/T021-invite-and-join` is the same code round 3 passed. `POST /v1/t/:tenantId/invites` still uses a 4096-byte body limit, `requireUser`, `requireConsent`, and `requireMember('admin')`, then `createInvite` with `tenantId` and `userId` from `c.var.membership` and `c.var.user`. `GET /v1/invites/:token` stays unauthenticated and returns `InvitePreviewResponse` `{ name }` only. Accept parses `AcceptInviteRequest` and does not pass the body into `acceptInvite`; `userId` is `c.var.user.id`. `firebase/firestore.rules` is unchanged versus `origin/main`.

## Hard rules
1. core vendor-free — ok
2. ports + adapters + fakes — ok
3. no client Firestore writes — ok
4. tenant isolation — ok
5. time from Clock — ok
6. roles server-side — ok
7. entitlements, not plan name — ok
8. our own IDs — ok
9. secrets — ok
10. AI output untrusted — ok
11. religious content provenance — ok
