VERDICT: PASS
# UI design review — T013a round 1

## Findings
None. The diff `main...factory/T013a-record-consent -- apps/web` adds no visible UI, so none of the six design-system checks has anything to flag. I read all of the web changes:

- `apps/web/src/features/auth/timezone-default.ts` — logic only: returns `null` while `me.consent.required`.
- `apps/web/src/features/auth/timezone-default.test.ts`, `apps/web/src/api/client.test.ts` — unit tests and fixtures only.
- `apps/web/e2e/helpers/sign-in.ts`, `apps/web/e2e/profile.spec.ts` — Playwright helper and spec only.

Per check:
1. **Components**: none added or changed. The spec keeps the consent screen and `ConsentGate` for T013b.
2. **Tokens**: no CSS, inline style, colour, spacing or radius values touched.
3. **Logical CSS**: no CSS in the diff, so there is no `left`/`right`.
4. **Contrast and legibility**: no text, strings or fonts added.
5. **Responsive**: no markup or layout changed, so 360px behaviour is unchanged.
6. **Consistency**: no screens or states changed. The profile and header still render as before, and the e2e still asserts `auth-name` and the Profile link.

## Nits (non-blocking)
- None. For T013b, which adds the consent screen: build it from the existing components and CSS variables, use logical properties, and check it at 360px and in RTL. Consent text in Arabic and Amharic needs a font stack that covers those scripts and a suitable line height.
