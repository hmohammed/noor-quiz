VERDICT: PASS
# Security review — T021 round 2

## Findings
None.

Round 2 only changes the web invite panel and join page. Create still goes through `requireUser`, `requireConsent`, and `requireMember('admin')`, then `createInvite` checks the stored membership. The panel is inert while open and `openInvite` no-ops unless the panel is closed, so a second tap cannot start another create; a late response is dropped when the request id changes. The link and QR are built in the browser from the ULID returned by `CreateInviteResponse`. `GET /v1/invites/:token` is still unauthenticated and strict `{ name }`. HTTP 400 and 404 on that preview become the not-found state: no community name, no Join button, and no retry. HTTP 410 stays the gone state, also with no name and no Join. Sign-in, signing-in, and sign-in failure keep the name only after a successful preview. Join stays disabled while the session is loading, and Try again calls `signIn()` rather than accept. Accept still sends `{}`, uses the signed-in user id, and does not run until Join is clicked on a ready preview. `/join/:token` is not exempt from the consent gate. `firestore.rules` remains default deny.

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
