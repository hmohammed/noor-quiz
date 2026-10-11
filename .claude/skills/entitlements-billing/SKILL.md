---
name: entitlements-billing
description: Gate features with plans/entitlements/quotas, meter usage, and integrate payments through the PaymentProvider port (Stripe adapter, webhooks). Use for any task touching plans, limits, paid features, usage counters, checkout or subscriptions.
---

# Entitlements and billing

## Concepts
- **Plan** (`plans/{planId}`, data): `features: string[]`, `limits: { members, aiCreditsPerMonth, messagesPerMonth, customQuestions }`, `billing: { interval: 'month'|'year'|'season', providerPriceIds }`.
- **Subscription** (`subscriptions/{tenantId}`): `planId`, `status`, `currentPeriodEnd`, `provider`, `providerRef`. Written only by the webhook handler / admin tools.
- **Entitlements** (`entitlements/{tenantId}`): computed = plan features/limits + overrides (sponsorship, grace). The **only** thing features read.
- **Usage** (`usageEvents`, `usageCounters/{tenantId}_{period}`): one event per metered action; counters rolled up.

## In code
```ts
requireFeature('ai_scoring')                 // middleware: 402 FEATURE_NOT_IN_PLAN if missing
const ok = await consumeQuota(deps, tenantId, 'ai_credits', 1)  // core use case, atomic
if (!ok) return fallback()                   // never hard-fail a member mid-season
```
- Feature names and quota keys are constants in `packages/core/src/billing/catalog.ts`.
- Never branch on `planId === 'community'`; always on features/limits.
- Fallbacks are part of the feature's acceptance criteria: AI → queued human review or MCQ-only; WhatsApp → push/email; member cap → join request waits for admin.

## Payments
- Port `PaymentProvider`: `createCheckout`, `createPortalLink`, `parseWebhook(rawBody, headers) → BillingEvent`.
- Stripe adapter only in `apps/api/src/adapters/stripe/`. Test mode keys only in dev/staging.
- Webhook route: verify signature → store `billingEvents/{eventId}` (idempotent) → update subscription → `recomputeEntitlements(tenantId)`.
- Season pass = one-off payment that sets a subscription with `currentPeriodEnd = season end + 7 days`.

## Tests
- Core: entitlement computation, quota race (two consumers, one credit left), fallback paths.
- Webhook: replay of the same event is a no-op; bad signature → 400; out-of-order events resolve to the latest state.
