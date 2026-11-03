# Spec — T013b Web: consent screen at first sign-in and a /privacy page

Web-only slice. T013a already ships the API (`GET /v1/me` returns `consent`, `POST /v1/me/consent`, `PATCH /v1/me` returns 403 `CONSENT_REQUIRED` without consent) and the contracts (`AcceptConsentRequest`, `MeConsent`, `MeResponse`). `timezoneDefault()` already returns `null` while `me.consent.required` is true. No change to `packages/*` or `apps/api`.

View tests follow the existing pattern: Vitest in `environment: 'node'`, `renderToStaticMarkup`, assertions against `en.json` values (see `ProfileFormView.test.tsx`). Components that render a `<Link>` are wrapped in react-router's `MemoryRouter` in the test.

## Acceptance tests

Task criterion 1 (new user sees the consent screen, reaches the app after agreeing, a reload does not show it again):

1. A new user signs in on the Auth emulator. The consent screen appears (heading `consent.title` visible), and the home page content (`api-status`) is not rendered. — e2e — `apps/web/e2e/consent.spec.ts`
2. In the same run, the user clicks "I agree". `POST /v1/me/consent` returns 200. The consent screen goes away and the home page shows `API ok`. — e2e — `apps/web/e2e/consent.spec.ts`
3. After `page.reload()` the consent screen does not appear, the home page shows, and the user can click the `Profile` nav link and see the profile form (`Display name` input). — e2e — `apps/web/e2e/consent.spec.ts`
4. The browser-timezone default fires no `PATCH /v1/me` while consent is pending. After the user accepts **on the screen**, exactly one `PATCH /v1/me` with `{ timezone: 'Africa/Addis_Ababa' }` is sent and returns 200. (Rewrite of the first test in `profile.spec.ts`, now using the screen instead of the API helper.) — e2e — `apps/web/e2e/profile.spec.ts`
5. `apiClient.acceptConsent({ idToken, body })` sends `POST /v1/me/consent` with `authorization: Bearer <token>`, `content-type: application/json`, and the JSON body `{ version }`. It resolves with the parsed `MeResponse`. — unit — `apps/web/src/api/client.test.ts`
6. `acceptConsent` throws `ApiError` with `status: 409` on a 409, `status: 401` on a 401, and throws `ApiError` when a 200 body breaks the `MeResponse` contract (for example a leaked `acceptedAt` inside `consent`). — unit — `apps/web/src/api/client.test.ts`
7. `acceptCurrentConsent()` posts `me.consent.currentVersion`, not a hard-coded version, and returns the new `me`. — unit — `apps/web/src/features/auth/accept-consent.test.ts`
8. `acceptCurrentConsent()` on a 409 calls `GET /v1/me` once and throws `ConsentOutdatedError` carrying the fresh `me`. If that `GET` also fails, it throws the `ApiError` from the `GET`, not `ConsentOutdatedError`. Any other POST failure (500, network) is rethrown unchanged, with no `GET`. — unit — `apps/web/src/features/auth/accept-consent.test.ts`

Task criterion 2 (`/privacy` is reachable signed out and while consent is pending):

9. `shouldShowConsentGate(state, pathname)` returns true only for `signed-in` with `consent.required: true` on a path other than `/privacy`. It returns false for `/privacy` (and `/privacy/`) while consent is pending, for `signed-in` with `required: false`, and for `loading`, `signed-out`, `unavailable` and `error` on any path. — unit — `apps/web/src/features/consent/consent-gate-rule.test.ts`
10. `PrivacyPage` renders without a session provider (so it is public by construction). It shows an `<h1>` with `privacy.title`, the placeholder notice, and one `<h2>` heading plus body per entry in `PRIVACY_SECTIONS`, in order. — view — `apps/web/src/features/privacy/PrivacyPage.test.tsx`
11. Every key in `PRIVACY_SECTIONS` exists in `en.json`, and the rendered page contains no raw `privacy.` key. — view — `apps/web/src/features/privacy/PrivacyPage.test.tsx`
12. Signed out: going to `/privacy` shows the privacy heading, and the footer `Privacy` link is visible on `/`. — e2e — `apps/web/e2e/consent.spec.ts`
13. While consent is pending, clicking the gate's privacy link opens `/privacy` and shows the privacy page, not the gate. Clicking the `Home` nav link then shows the gate again. — e2e — `apps/web/e2e/consent.spec.ts` (same test as 1–3, before accepting)

Task criterion 3 (view tests cover loading, error and outdated-terms states, every string is an i18n key):

14. `idle`: an `<h1>` with `consent.title`, the summary text, a `<Link>` to `/privacy` with `consent.privacyLink`, and an enabled `<button type="button">` with `consent.agree`. — view — `apps/web/src/features/consent/ConsentGateView.test.tsx`
15. `accepting` (loading): the button is `disabled` and says `consent.agreeing`, and there is a `role="status"` `aria-busy="true"` element. There is no alert. — view — `ConsentGateView.test.tsx`
16. `error`: a `role="alert"` with `consent.error.generic`, and the button is enabled again so the user can retry. — view — `ConsentGateView.test.tsx`
17. `outdated`: a `role="alert"` with `consent.error.outdated` (not the generic message), and the button is enabled. — view — `ConsentGateView.test.tsx`
18. No state renders a raw `consent.` key, and every `consent.*` and `privacy.*` key the views use exists in `en.json`. — view — `ConsentGateView.test.tsx`, `PrivacyPage.test.tsx`

RTL and existing specs:

19. With `document.documentElement.dir = 'rtl'` set through `page.evaluate`, the gate's heading, privacy link and "I agree" button are visible and their bounding boxes do not overlap. The same holds for the `/privacy` heading and the first section. (T080 adds the real `ar` locale switch. Until then, this is the RTL check.) — e2e — `apps/web/e2e/consent.spec.ts`
20. `profile.spec.ts` (all three tests) and `sign-in.spec.ts` pass with the new gate. Profile tests accept consent through the screen with the new helper `acceptConsentOnScreen(page)`. In the "unsaved edit" test, both users accept before they open `/profile`. — e2e — `apps/web/e2e/profile.spec.ts`, `apps/web/e2e/helpers/sign-in.ts`

There are no new routes, so no unauthorised or wrong-tenant API tests are needed. The server-side 401/403/409 behaviour is already covered by T013a route tests.

## Files and modules to touch

- `apps/web/src/api/client.ts`
  - Widen `request()`'s `method` to `'GET' | 'PATCH' | 'POST'`.
  - Add `acceptConsent(init: { idToken: string; body: AcceptConsentRequest; signal?: AbortSignal }): Promise<MeResponse>` to `ApiClient`. It calls `request('POST', '/v1/me/consent', MeResponse, { signal, headers: bearer(idToken), body })`.
  - Import the `AcceptConsentRequest` type from `@noor/contracts`.
- `apps/web/src/api/client.test.ts`: tests 5 and 6.
- `apps/web/src/features/auth/accept-consent.ts` (+ `.test.ts`, new): firebase-free and React-free, so it can be unit-tested with `createApiClient({ fetch })`.
  ```ts
  export class ConsentOutdatedError extends Error {
    override name = 'ConsentOutdatedError';
    constructor(readonly me: MeResponse) { super('Consent version is outdated'); }
  }
  /** POSTs `me.consent.currentVersion`. On 409, reloads `/v1/me` and throws ConsentOutdatedError(freshMe). */
  export async function acceptCurrentConsent(
    client: Pick<ApiClient, 'acceptConsent' | 'getMe'>,
    init: { idToken: string; me: MeResponse },
  ): Promise<MeResponse>;
  ```
- `apps/web/src/features/auth/session-context.tsx`
  - `Session` gains `acceptConsent(): Promise<MeResponse>`. It does the following:
    - Captures `generation.current`.
    - Reads the current `me` from state. If the state is not `signed-in`, it throws `ApiError('Not signed in', { status: 401 })`.
    - Gets the ID token with `getIdToken()` (null → the same 401 `ApiError`).
    - Calls `acceptCurrentConsent(apiClient, { idToken, me })`.
    - On success, if the generation still matches, it sets `{ kind: 'signed-in', me }` and runs the timezone default (below).
    - On `ConsentOutdatedError`, if the generation still matches, it sets `{ kind: 'signed-in', me: err.me }` and rethrows.
    - Any other error is rethrown and the state is left unchanged.
  - To read the current `me` without a stale closure, keep a `stateRef` that is updated with state, or use a functional read. Do not add `state` to the `useCallback` deps in a way that recreates the session on every render.
  - Lift the timezone-default logic out of the `onChange` effect into one helper used by both the first load and `acceptConsent`, for example `applyTimezoneDefault(idToken, me, { signal?, isCurrent })`. On first load, `timezoneDefault()` already returns null while consent is required, so no PATCH fires. After a successful accept it runs once with the post-consent `me`. Keep it fire-and-forget, with failures ignored as before.
- `apps/web/src/features/consent/consent-gate-rule.ts` (+ `.test.ts`, new): `shouldShowConsentGate(state: SessionState, pathname: string): boolean`. It treats `/privacy` and `/privacy/` as exempt (`PRIVACY_PATH` constant exported from `features/privacy/policy.ts`).
- `apps/web/src/features/consent/ConsentGateView.tsx` (+ `ConsentGateView.test.tsx`, new)
  - A pure view: `{ status: ConsentGateStatus; onAccept(): void }`, where `type ConsentGateStatus = 'idle' | 'accepting' | 'error' | 'outdated'`.
  - It renders `<main className="page consent">` with the `<h1>`, summary `<p>`s, `<Link to={PRIVACY_PATH}>`, the button and the status or alert lines. All text goes through `t()`.
- `apps/web/src/features/consent/ConsentGate.tsx` (new): the container.
  - It holds a local `status` and calls `useSession().acceptConsent()`. If `status === 'accepting'`, it ignores the click.
  - It maps errors to status: `ConsentOutdatedError` → `'outdated'`, anything else → `'error'`. On success it renders nothing special, because the session update removes the gate.
  - It is not a route.
- `apps/web/src/features/layout/AppLayout.tsx`
  - Add an inner `PageOutlet` that uses `useSession()` and `useLocation()`. It renders `<ConsentGate key={me.userId} />` when `shouldShowConsentGate(state, pathname)`, and otherwise `<Outlet />`.
  - `SiteNav` hides the `Profile` link while consent is required.
  - Add `<footer className="site-footer"><Link to="/privacy" className="site-nav__link">{t('nav.privacy')}</Link></footer>` after the page.
  - The header (including `AuthButton` / sign out) stays visible while the gate shows.
- `apps/web/src/features/privacy/policy.ts` (new): the placeholder content config.
  ```ts
  export const PRIVACY_PATH = '/privacy';
  export interface PrivacySection { readonly titleKey: string; readonly bodyKey: string }
  export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
    { titleKey: 'privacy.data.title', bodyKey: 'privacy.data.body' },        // what we store
    { titleKey: 'privacy.use.title', bodyKey: 'privacy.use.body' },          // why / how we use it
    { titleKey: 'privacy.rights.title', bodyKey: 'privacy.rights.body' },    // access, correction, deletion
    { titleKey: 'privacy.contact.title', bodyKey: 'privacy.contact.body' },
  ];
  ```
- `apps/web/src/features/privacy/PrivacyPage.tsx` (+ `PrivacyPage.test.tsx`, new)
  - `<main className="page privacy">` contains an `<h1>` with `privacy.title`, a `<p>` with `privacy.placeholder` (a notice that this is placeholder text), and one `<section>` with an `<h2>` and a `<p>` per `PRIVACY_SECTIONS` entry.
  - It does not use `useSession`, `Link` or any other router hook.
- `apps/web/src/router.tsx`: add `{ path: PRIVACY_PATH, element: <PrivacyPage /> }` under `AppLayout`.
- `apps/web/src/i18n/en.json`: add these keys.
  - `nav.privacy`
  - `consent.title`, `consent.summary`, `consent.privacyLink`, `consent.agree`, `consent.agreeing`, `consent.error.generic`, `consent.error.outdated`
  - `privacy.title`, `privacy.placeholder`, and the eight section keys above.
  - Keep the copy short and plain. Do not claim legal compliance or name a data controller. The placeholder notice says that the final text follows.
- `apps/web/src/styles.css`: add `.consent`, `.consent__summary`, `.consent__actions`, `.consent__status`, `.consent__error`, `.privacy__section` and `.site-footer`. Use logical properties only (`margin-block`, `padding-inline`, `border-block-start`, `gap`) and existing variables, with no `left`/`right`. Buttons reuse `.auth__button`.
- `apps/web/e2e/helpers/sign-in.ts`
  - Replace `acceptConsentViaApi` with `acceptConsentOnScreen(page): Promise<Response>`. It expects the `consent.title` heading, clicks the `I agree` button, waits for the `POST /v1/me/consent` response, expects status 200, and expects the heading to be gone.
  - Update the doc comment. Never log headers or tokens.
- `apps/web/e2e/profile.spec.ts`: switch to `acceptConsentOnScreen` (tests 4 and 20).
  - In test 1, no PATCH is seen before the click, and exactly one is seen after it, with no reload needed.
  - In test 3, both members accept before they open `/profile`.
- `apps/web/e2e/consent.spec.ts` (new): tests 1–3, 12, 13 and 19. Use a fresh email per run, as the other specs do.
- `docs/tasks/E01-identity-privacy.md` T013b Notes, and BOARD row (per Definition of Done): add notes for T013c/T080. Note that `useSession().acceptConsent()` exists, that `/privacy` and `PRIVACY_SECTIONS` are the place to put the real policy, that the RTL e2e check uses a forced `dir` until T080, and that T013c's delete flow should expect the gate after re-sign-in.

## Contracts and data shapes

No new zod schemas. These existing ones are used:

```ts
// packages/contracts/src/me.ts (T013a, unchanged)
AcceptConsentRequest = z.strictObject({ version: z.string().min(1).max(32) })
MeConsent = z.strictObject({ currentVersion: z.string(), acceptedVersion: z.string().nullable(), required: z.boolean() })
MeResponse = z.strictObject({ userId, displayName, locale, timezone, consent: MeConsent })
```

HTTP responses from `POST /v1/me/consent` and how the web handles them:

| Status | Meaning | Web behaviour |
| --- | --- | --- |
| 200 | `MeResponse` with `consent.required: false` | Replace `me`, the gate disappears, then the timezone default PATCH runs once |
| 409 `CONFLICT` | The version sent is not current (outdated terms) | `GET /v1/me`, replace `me` (new `currentVersion`), gate status `outdated`, user can agree again |
| 401 / 400 / 5xx / network / contract mismatch | Other failure | Gate status `error`, button enabled for retry, `me` unchanged |

Gate visibility rule:

```
show gate  ⇔  state.kind === 'signed-in' && state.me.consent.required && pathname ∉ {'/privacy', '/privacy/'}
```

No Firestore documents, rules or indexes change.

## Hard rules that apply here

- **Rule 3 (the browser never writes to Firestore) and Rule 6 (never trust the client).** Consent is recorded only through `POST /v1/me/consent`. The web sends only `{ version }`, taken from the server's `me.consent.currentVersion`. It never sends `acceptedAt`, the user id, or anything else, and the strict contract would reject them. The gate is UX only. The server's `requireConsent()` remains the real enforcement, so the spec adds no client-side "skip" or test mode.
- **Rule 5 (time from the `Clock`).** No timestamps are made in the web for consent. `acceptedAt` is set by the server's `Clock`.
- **Rule 9 (secrets) and no token leakage.** The e2e helpers stop reading the `authorization` header, because the screen-based flow removes the need. Nothing logs tokens or headers.
- **No Firebase in feature code.** `accept-consent.ts` and `client.ts` stay Firebase-free. Only `session-context.tsx` gets the token through `auth/session`, as now. The existing apps/web lint ban must keep passing.
- **i18n and RTL conventions.** Every user-facing string goes through `t()`, with keys in `en.json`. CSS uses logical properties only. Elements with Latin-only content have no direction-specific layout. Test 19 checks RTL until T080 adds real locale switching.
- **State races.** `acceptConsent` uses the same `generation` guard as `updateMe`, so a sign-out or user switch during the POST never puts the old user's `me` into state. The gate is keyed by `userId`, so its local status never carries over to another member.

## Out of scope

- Real privacy-policy text, legal review, versioned policy history, or showing the consent version or date to the user.
- Translations into sv/ar/am/so, `useI18n()`, `<html lang/dir>` switching, and the locale picker affecting the UI. That is T080. Only `en.json` is edited.
- Withdrawing consent, re-consent prompts mid-session (beyond the 409 path), and consent for cookies or analytics.
- `DELETE /v1/me` and the delete-account UI (T013c).
- Any change to `packages/contracts`, `packages/core`, `apps/api`, Firestore rules or indexes. If the builder finds the API behaving differently from T013a's spec, they record it in build.md rather than changing the API here.
- A general route-guard or auth-guard framework, new UI component library pieces, or a new dependency (no testing-library and no jsdom; keep the `renderToStaticMarkup` pattern).
- Hiding or changing the header `AuthButton` behaviour beyond hiding the `Profile` nav link while consent is pending.
