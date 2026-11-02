## T010c

**Web: sign in with Google and see my name**

Phase: P1 · Depends on: [T010b](E01-identity-privacy.md#t010b) · Tags: `sec`
Skills: `vertical-slice`, `i18n-rtl`

**Goal.** A visitor clicks sign in, completes Google sign-in, and the header shows their display name from `/v1/me`. They can sign out.

**Scope**

- Add `firebase` (the client SDK, `firebase/auth` only) as an `apps/web` dependency. Justification: Google sign-in popup and ID token refresh. Exit path: any OIDC client behind `apps/web/src/auth/session.ts`.
- `apps/web/src/auth/session.ts` is the only file that imports `firebase/auth`. It exposes `signIn()`, `signOut()`, `onChange(cb)` and `getIdToken()`. It connects to the Auth emulator when `VITE_AUTH_EMULATOR_HOST` is set. Add the Firebase web config and the emulator host as `VITE_*` keys in `apps/web/.env.example`. The web config is public, not a secret.
- `apiClient.getMe()` sends `Authorization: Bearer <idToken>` and parses `MeResponse`.
- `apps/web/src/features/auth/AuthButton.tsx` goes in the existing layout or HomePage header. It has signed-out, loading, signed-in (display name, or a `t('auth.noName')` fallback) and error states. All strings go through `t()`, and it uses logical CSS properties.
- e2e `apps/web/e2e/sign-in.spec.ts` runs against the Auth emulator, which `dev:emulators` already starts.

**Acceptance criteria**

- [ ] e2e with the auth emulator: sign in → see my name.

Tags: `sec`
Phase: P1
