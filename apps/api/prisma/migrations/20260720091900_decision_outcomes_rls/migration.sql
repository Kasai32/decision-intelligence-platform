-- Extends ADR-0015's Postgres RLS coverage to the new decision_outcomes
-- table (see ADR-0016). Same policy shape as the row_level_security
-- migration; dip_app already has DML on this table via that migration's
-- ALTER DEFAULT PRIVILEGES (it applies to tables created by later
-- migrations too, since they all run as the same role) — only the
-- table-specific RLS policy needs to be added explicitly here.

ALTER TABLE "decision_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision_outcomes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "decision_outcomes"
  USING ("tenantId" = current_setting('app.tenant_id', true));
