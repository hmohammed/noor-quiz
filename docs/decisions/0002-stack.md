# ADR 0002 — Node + Vite + Hono on Firebase

Date: 2026-10-11 · Status: accepted

## Decision
- Web: Vite + React + React Router; no UI component kit.
- API: Hono (Web-standard Request/Response) deployed as a Firebase Cloud Function (2nd gen); same code can run on Cloud Run or any Node host.
- Data: Firestore behind repositories; flat, SQL-mappable documents.
- Monorepo with npm workspaces; TypeScript strict.

## Why
Small, portable dependencies; Firebase gives auth, data, hosting and jobs with low ops; Hono keeps the HTTP layer vendor-neutral.
