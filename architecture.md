# II-VMS Architecture Overview

## High-Level Layers
- Frontend (React + Vite + TS): Landing marketing surface, visitor portal, management console, biometric preview, scanner.
- Backend (Express + PostgreSQL): Visitor CRUD, QR check-in, ledger hashing, AI gateway, analytics events.
- Database (PostgreSQL): Tables: visitors, audit_ledger, (optional) analytics_events, future biometric_metadata.

## Request Flow Examples
1. Visitor Registration
   - UI calls `POST /api/visitors` (unauthenticated) with minimal fields.
   - Backend inserts visitor, returns QR token.
   - Service records ledger event chain (created -> hash + optional prev_hash).
2. Visitor Check-In
   - Admin-scanner obtains QR token, calls `POST /api/visitors/:token/check-in` with admin key.
   - Ledger event hashed with previous hash forming chain.
3. AI Suggestion Demo
   - Landing page button triggers `POST /api/ai/generate`.
   - Backend service validates prompt length, timeout, calls Gemini REST if enabled.
4. Analytics Event
   - Frontend fires `POST /api/analytics/events` for key interactions (page view, AI demo).
   - Backend attempts DB insert; falls back to in-memory buffer if table absent.

## Security / Admin
- Admin endpoints protected via `x-admin-key` header; key stored locally after verification.
- Interceptor clears invalid key and triggers re-auth UI flow.
- Future: Rotate admin keys + add short-lived session tokens.

## Ledger Hardening
- Each visitor event (created, checked_in, deleted) produces a payload.
- Chained: `prev_hash` + current event JSON -> SHA-256 -> stored.
- Fallback: If `prev_hash` column missing, store simple event hash.
- Validation routine (future): Re-compute chain to verify integrity.

## AI Integration
- Feature flags: `GEMINI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Timeout & max prompt guards: `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_PROMPT_CHARS`.
- Extraction of `usageMetadata` tokens for observability.
- Roadmap: risk scoring JSON, embeddings retrieval, vision spoof detection.

## Biometric Capture (Preview)
- Local webcam capture into base64 PNG (not uploaded).
- Next phases: quality heuristics, consent workflow, hashing metadata into ledger.
- Future privacy: anonymize or encrypt raw images at rest.

## Analytics Pipeline
- Minimal event ingestion with name + JSON payload.
- Table schema suggestion:
```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Roadmap: rate limiting, aggregation (daily unique visitors, avg check-in latency), export.

## Design System & Accessibility
- Single `styles.css` includes dark app shell + light marketing overrides.
- Tokens: accent gradients, radii, shadow sets.
- Accessibility: Reduced motion disables carousel auto-advance; focus-visible outlines added.
- Toast system for non-blocking feedback.

## Observability & Metrics (Planned)
- Counters: `visitor_create_total`, `visitor_checkin_total`, `ai_requests_total`.
- Histograms: `ai_latency_ms`, `db_query_ms`.
- Chain integrity verification job daily -> alerts.

## Resilience
- AI failures degrade gracefully with `error` field and no user-blocking.
- Analytics writes fall back to memory buffer.
- Ledger insertion fallback removes prev_hash to maintain minimal audit continuity.

## Future Enhancements
- Multi-tenant separation via organization_id in tables.
- Message queue for async host notifications.
- WebSocket live presence feed.
- Kiosk build packaging & offline cache.

---
This document will evolve; use it as baseline for onboarding and roadmap alignment.
