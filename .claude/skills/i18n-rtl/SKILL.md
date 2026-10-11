---
name: i18n-rtl
description: Add or change user-facing text, locales and right-to-left layout in the web app and notifications (English, Swedish, Arabic, Amharic, Somali). Use whenever a task adds UI strings, a new locale, or layout that must work in RTL.
---

# i18n and RTL

## Strings
- No literal user-facing strings in components. `const { t } = useI18n(); t('quiz.submit')`.
- Keys are dotted by feature: `quiz.*`, `community.*`, `billing.*`. Add new keys to `apps/web/src/i18n/en.json`; other locales fall back to English until translated.
- Plurals and numbers via `Intl.PluralRules` / `Intl.NumberFormat`; dates via `Intl.DateTimeFormat` with the user's timezone. Hijri dates with `calendar: 'islamic-umalqura'` where shown.
- Server-generated text (notifications, share cards, AI feedback) uses the same keys from `packages/contracts/i18n` and the member's `locale`.

## RTL
- `<html dir>` is set from the locale (`ar` → `rtl`).
- CSS uses logical properties only: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`. Lint flags `left/right` in new CSS.
- Icons with direction (arrows, chevrons) flip via `[dir=rtl] .icon-directional { transform: scaleX(-1) }`.
- Test: every new screen gets a Playwright check in `ar` that key elements are visible and not overlapping.

## Fonts and scripts
- System font stack plus Noto Sans Arabic and Noto Sans Ethiopic (self-hosted, subset) for Arabic and Amharic.
- Display names accept any Unicode letters/marks; validate with `\p{L}\p{M}` in the contract, 2–32 chars, trimmed, normalised NFC.

## Adding a locale
1. Add `<code>.json` with at least `common.*` translated.
2. Register in `apps/web/src/i18n/locales.ts` (code, native name, dir).
3. Add to the locale picker and notification templates.
