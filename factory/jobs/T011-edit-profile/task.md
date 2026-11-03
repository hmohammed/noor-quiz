## T011

**Edit my profile: display name, locale, timezone**

Phase: P1 · Depends on: [T010](E01-identity-privacy.md#t010) · Tags: —
Skills: `api-endpoint`, `i18n-rtl`

**Goal.** Members choose how their name appears, their language and timezone.

**Scope**

- Contract `UpdateMeRequest`: displayName (Unicode letters/marks/spaces, NFC, 2–32), locale (supported list), timezone (valid IANA)
- `PATCH /v1/me`; timezone defaulted from browser on first sign-in
- Web profile page

**Acceptance criteria**

- [ ] Names in Amharic (ሀሰን), Arabic (حسن), Swedish (Åsa) accepted; empty, emoji-only, >32 chars rejected
- [ ] Invalid timezone and unsupported locale rejected with 400
- [ ] e2e: change name → shown in header

**Notes**

_(implementer adds notes for the next task here)_

Tags: —
Phase: P1
