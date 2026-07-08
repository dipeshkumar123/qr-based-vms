# Migration Rollback Plan

This document defines rollback procedures for recent schema additions:
- typed analytics columns
- schema metadata table
- archive tables
- indexes for analytics and retention

## Preconditions
1. Confirm application impact and incident scope.
2. Put write-heavy jobs into maintenance mode.
3. Create a fresh database backup before rollback.

## Rollback Strategy
1. Application rollback first:
- Deploy previous backend and analytics service images that do not depend on the newest schema additions.

2. Data safety:
- Keep new tables as-is unless there is corruption.
- Prefer disabling features over destructive schema drops.

3. Optional schema rollback (controlled window only):
- If required, drop only non-critical additive structures:
  - `analytics_events_archive`
  - `audit_ledger_archive`
  - non-essential indexes introduced by latest migration
- Do not drop `schema_meta` unless explicitly needed.

## SQL Examples (Use Carefully)
```sql
-- Example: disable archive-only indexes
DROP INDEX IF EXISTS idx_analytics_events_archive_created;
DROP INDEX IF EXISTS idx_audit_ledger_archive_created;

-- Example: remove archive tables (only if confirmed safe)
DROP TABLE IF EXISTS analytics_events_archive;
DROP TABLE IF EXISTS audit_ledger_archive;
```

## Verification After Rollback
1. Run `npm run migration:smoke`.
2. Verify backend startup passes schema checks.
3. Validate critical endpoints:
- `/health`
- `/health/dependencies`
- `/api/visitors`
- `/api/analytics/dashboard`

## Recovery
If rollback fails or data mismatch is detected:
1. Restore from backup.
2. Re-apply stable migration set.
3. Re-run smoke tests and health checks.
