# E09 · Entitlements and billing

Plans as data, quotas, Stripe behind a port, graceful limits.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T090

**Plans as data and entitlements**

Phase: P2 · Depends on: [T020](E02-communities.md#t020) · Tags: —
Skills: `entitlements-billing`, `firestore-data`

**Goal.** Every community has computed entitlements from a plan, starting with Free.

**Scope**

- Feature/quota catalog in core; `plans` collection seeded with Free and Community (limits only, no prices)
- `entitlements/{tenantId}` computed by `recomputeEntitlements` (plan + overrides); created with Free on community creation
- `GET /v1/t/:tenantId/entitlements` (admin+)

**Acceptance criteria**

- [ ] Core tests for computation including overrides with expiry
- [ ] Changing a plan's limit and recomputing updates entitlements without a deploy

**Notes**

_(implementer adds notes for the next task here)_

## T091

**Gate features and member cap via entitlements**

Phase: P2 · Depends on: [T090](E09-billing.md#t090), [T032](E03-seasons-questions.md#t032), [T021](E02-communities.md#t021) · Tags: `sec`
Skills: `entitlements-billing`, `api-endpoint`

**Goal.** Free communities get Free limits; going over degrades gracefully.

**Scope**

- Middleware `requireFeature()`; apply to custom questions (`custom_questions`)
- Member cap on invite accept: over the cap → join request pending admin, not an error page
- Web: upgrade prompts where a feature is missing

**Acceptance criteria**

- [ ] Free community creating a custom question → 402 `FEATURE_NOT_IN_PLAN` and an upgrade prompt in UI
- [ ] Joining a full community creates a join request; admin can approve after upgrading
- [ ] No code branches on plan names (lint/grep check in review)

**Notes**

_(implementer adds notes for the next task here)_

## T092

**Usage metering and AI credit quotas**

Phase: P2 · Depends on: [T090](E09-billing.md#t090), [T071](E07-ai-scoring.md#t071) · Tags: —
Skills: `entitlements-billing`

**Goal.** AI scoring consumes credits; when credits run out the season continues.

**Scope**

- `usageEvents` + `usageCounters/{tenantId}_{yyyymm}`; `consumeQuota` atomic in core with repo transaction
- Scoring worker consumes `ai_credits`; on exhaustion routes answers to the human review queue
- Organiser usage panel (credits used / limit)

**Acceptance criteria**

- [ ] Race test: two workers, one credit left → exactly one AI call
- [ ] Exhausted quota never fails a member request

**Notes**

_(implementer adds notes for the next task here)_

## T093

**Stripe checkout behind PaymentProvider (test mode)**

Phase: P3 · Depends on: [T090](E09-billing.md#t090) · Tags: `sec`
Skills: `entitlements-billing`, `port-adapter`, `api-endpoint`

**Goal.** An owner upgrades their community to Community monthly with a test card.

**Scope**

- Port `PaymentProvider` (createCheckout, createPortalLink, parseWebhook); Stripe adapter; fake
- `POST /v1/t/:tenantId/billing/checkout` (owner only) → redirect URL
- Web plan page listing plans from data with upgrade button

**Acceptance criteria**

- [ ] Only owners can start checkout
- [ ] Fake provider used in tests; Stripe adapter contract test runs in test mode when keys exist

**Notes**

_(implementer adds notes for the next task here)_

## T094

**Stripe webhook updates subscription and entitlements**

Phase: P3 · Depends on: [T093](E09-billing.md#t093) · Tags: `sec`
Skills: `entitlements-billing`, `api-endpoint`

**Goal.** Paying immediately unlocks features; cancellations and failures are reflected.

**Scope**

- `POST /v1/billing/webhook`: verify signature, store `billingEvents/{eventId}`, update `subscriptions/{tenantId}`, recompute entitlements

**Acceptance criteria**

- [ ] Replayed event is a no-op; bad signature → 400
- [ ] Out-of-order events end in the correct latest state (tests with fixture events)
- [ ] e2e with Stripe CLI in staging documented in PR

**Notes**

_(implementer adds notes for the next task here)_

## T095

**Customer portal, downgrade and cancel**

Phase: P3 · Depends on: [T094](E09-billing.md#t094) · Tags: —
Skills: `entitlements-billing`

**Goal.** Owners manage billing themselves; cancelling returns to Free at period end with data kept.

**Scope**

- `POST .../billing/portal` → portal link
- At period end, entitlements fall back to Free; over-limit data stays readable but new creations gated

**Acceptance criteria**

- [ ] Cancel → features remain until currentPeriodEnd (FakeClock test), then Free
- [ ] No data deleted on downgrade

**Notes**

_(implementer adds notes for the next task here)_

## T096

**Season pass one-off purchase**

Phase: P3 · Depends on: [T094](E09-billing.md#t094), [T031](E03-seasons-questions.md#t031) · Tags: —
Skills: `entitlements-billing`

**Goal.** A mosque pays once for Ramadan only.

**Scope**

- One-off checkout for a selected season; subscription with `currentPeriodEnd = season end + 7 days`

**Acceptance criteria**

- [ ] Entitlements active from payment until season end + 7 days
- [ ] Buying a pass when already on a yearly plan is blocked with an explanation

**Notes**

_(implementer adds notes for the next task here)_

## T097

**Sponsored communities (platform grant)**

Phase: P3 · Depends on: [T090](E09-billing.md#t090) · Tags: —
Skills: `entitlements-billing`, `api-endpoint`

**Goal.** A donor sponsors a community's plan; platform admin grants it.

**Scope**

- `entitlementOverrides` with source `sponsorship`, sponsor display name, expiry; platform-admin endpoint
- Community page shows a small thank-you credit (optional)

**Acceptance criteria**

- [ ] Override expires automatically (FakeClock)
- [ ] Only platform admins (custom claim) can grant

**Notes**

_(implementer adds notes for the next task here)_

## T098

**Legal entity, Stripe live mode and VAT**

Phase: P3 · Depends on: — · Tags: `human`
Skills: `entitlements-billing`

**Goal.** Decide the legal entity and switch payments to live before selling Season passes.

**Scope**

- Choose non-profit association or company (with an accountant); register; VAT registration
- Activate Stripe live account for that entity; enable Stripe Tax; set prices in Stripe and plan data
- Terms of service and privacy policy final text

**Acceptance criteria**

- [ ] Live keys stored as prod secrets by a human
- [ ] Target: done by mid-December 2026

**Notes**

_(implementer adds notes for the next task here)_
