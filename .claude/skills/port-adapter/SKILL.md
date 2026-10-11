---
name: port-adapter
description: Add a new port (interface we own) with its fake, vendor adapter and shared contract test, keeping Noor Quiz free of vendor lock-in. Use when a task introduces new external I/O (database collection, queue, AI provider, notifier, payment, storage).
---

# Add a port and adapter

## 1. Interface in core
`packages/core/src/ports/<name>.ts` — small, intention-revealing, in domain terms:
```ts
export interface Notifier {
  send(msg: { tenantId: TenantId; userId: UserId; channel: Channel; template: TemplateId; vars: Record<string,string> }): Promise<SendResult>;
}
```
Rules: no vendor types in signatures; return domain results; idempotency key where retries are possible.

## 2. Fake in testkit
`packages/testkit/src/fake-<name>.ts` — in-memory, deterministic, with helpers for assertions (`sent()`, `failNext()`).

## 3. Contract test (shared)
`packages/testkit/src/contracts/<name>.contract.ts` exports `runNotifierContract(makeImpl)`. It encodes behaviour every implementation must have (idempotency, error mapping, tenant scoping).
- Fake runs it in `packages/testkit`.
- Real adapter runs it in `apps/api/src/adapters/<vendor>/<name>.contract.test.ts` (emulator or vendor test mode; skipped in CI when credentials are absent, never against production).

## 4. Adapter
`apps/api/src/adapters/<vendor>/<name>.ts` implements the interface. All vendor SDK imports stay in this folder. Map vendor errors to domain errors. Read config from a typed `config.ts`, secrets from Secret Manager.

## 5. Wire it
Register in `apps/api/src/composition.ts` (the only place that knows which adapter is used). Tests build their own composition with fakes.

## 6. Record it
If it introduces a new vendor, add an ADR in `docs/decisions/` with the exit path.
