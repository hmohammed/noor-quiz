# ADR 0003 — Features check entitlements, not plans or Stripe

Date: 2026-10-11 · Status: accepted

## Decision
Plans are data (`plans` collection: features + limits). A tenant's `entitlements` document is computed from its subscription and is the only thing features check (`requireFeature`, `consumeQuota`). Stripe is reached only through `PaymentProvider` and its webhook.

## Consequences
Pricing changes are data changes; the payment provider is replaceable; quota exhaustion degrades gracefully instead of failing.
