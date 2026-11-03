VERDICT: PASS
# Security review — T013b round 1

Scope: `git diff main...factory/T013b-consent-screen-privacy` (web only: API client `acceptConsent`, `accept-consent.ts`, `session-context.tsx`, consent gate, `/privacy` page, e2e helpers). No change to `apps/api`, `packages/*`, Firestore rules or indexes.

## Findings
None at P0–P2.

What I checked and verified in code:
- **Consent is recorded server-side only.** The web sends `POST /v1/me/consent` with only `{ version }` taken from the server's `me.consent.currentVersion` (`apps/web/src/features/auth/accept-consent.ts:20`). The server parses it with the strict `AcceptConsentRequest`, uses `c.var.user.id` from `requireUser()`, and sets the timestamp itself (`apps/api/src/routes/me.ts:63-66`). `meBody` builds the response from named fields, so `acceptedAt` stays server-side. The client `MeResponse` parse rejects a leaked `acceptedAt` (covered by client.test.ts).
- **The gate is UX only, and real enforcement is unchanged.** `shouldShowConsentGate` is documented as UX only (`consent-gate-rule.ts:7`). `PATCH /v1/me` still has `requireUser(), requireConsent()` (`me.ts:57`). There is no client-side skip, override or test mode. The `/privacy` exemption only shows static, public text.
- **No token leakage.** The e2e helper no longer reads the `authorization` header or calls the API with a copied token (`e2e/helpers/sign-in.ts`). `client.ts` error messages contain only method, path and status. No new `console.*`, `localStorage` or `sessionStorage` use appears in the diff.
- **State races.** `acceptConsent` captures `generation` before any await, and it only writes state when `isCurrent()`. Both the success path and the `ConsentOutdatedError` path are guarded. `ConsentGate` is keyed by `userId`. If the user switches during `getIdToken()`, the POST goes out with the new user's own token and the global current version. The server authorises it by token, and the generation guard drops the result. No cross-user state write is possible.
- **Retry abuse.** The button ignores clicks while accepting. The server has `limitBody()` on the route. Accepting consent is idempotent, so repeated calls add no risk.
- **XSS and redirects.** There is no `dangerouslySetInnerHTML`. All text goes through `t()`. The privacy link is a fixed internal `PRIVACY_PATH`.

## Hard rules
1. core vendor-free — ok (no `packages/core` change)
2. ports + adapters + fakes — ok (no new external I/O; `accept-consent.ts` takes a `Pick<ApiClient>` and is tested with a fetch fake)
3. no client Firestore writes — ok (consent goes through the API only; no Firebase use in the new feature code)
4. tenant isolation — ok (n/a: user-scoped `/v1/me` only; userId comes from the token on the server)
5. time from Clock — ok (no timestamps made in the web; `acceptedAt` is set by the server)
6. roles server-side / never trust client — ok (the client sends only the version; the server validates it and returns 409 if it's not current)
7. entitlements, not plan names — ok (n/a)
8. own IDs — ok (gate keyed by `me.userId`, not the Firebase uid)
9. secrets — ok (e2e no longer handles auth headers; nothing is logged)
10. AI output untrusted — ok (n/a)
11. religious content provenance — ok (n/a)

## Nits (non-blocking)
- [P3] `apps/web/src/i18n/en.json` `privacy.*`: this placeholder copy is fine for now. The final policy (the owner of `PRIVACY_SECTIONS`) should state that participation in religious quizzes may reveal religious belief, which is GDPR special-category data. It should also name the lawful basis and the controller contact. Track this with the real policy text, not in this task.
- [P3] `apps/web/src/i18n/en.json` `privacy.rights.body` promises account deletion "from your profile". That depends on T013c shipping `DELETE /v1/me`. Do not ship this copy to production before T013c, or reword it. The build notes already flag this.
