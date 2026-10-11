# ADR 0001 — Ports and adapters around every vendor

Date: 2026-10-11 · Status: accepted

## Context
We build on Firebase, Stripe and hosted AI models but must be able to move any of them as we grow, without rewriting business logic.

## Decision
- `packages/core` holds domain logic and port interfaces; it imports no vendor SDK (lint-enforced).
- Each vendor is an adapter in `apps/*`, with a fake in `packages/testkit`.
- Each port has one contract test suite run against both the fake and the real adapter (emulator / test mode).

## Consequences
- Slightly more code per integration (interface + adapter + fake).
- Swapping Firestore→Postgres, Stripe→another PSP, or one AI provider for another touches one adapter.
- Core is fast to test: no emulators needed.
