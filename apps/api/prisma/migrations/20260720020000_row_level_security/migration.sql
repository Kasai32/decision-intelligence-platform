-- Row-Level Security: defense-in-depth for tenant isolation (see ADR-0015).
--
-- ADR-0004's tenant isolation relies entirely on every apps/api query
-- remembering `where: { tenantId }`. This migration adds a second,
-- database-enforced layer: every statement against these ten tables is
-- filtered by Postgres itself against a session variable
-- (`app.tenant_id`), set per-request by apps/api's TenantRlsInterceptor
-- (JWT-authenticated routes) or explicitly by WebhookSignatureGuard /
-- WebhooksController (the one route authenticated by HMAC, not a JWT).
-- A query that runs with no tenant context set (or the wrong one) sees
-- zero rows and can insert/update zero rows, even if the application code
-- forgot a WHERE clause entirely.
--
-- FORCE ROW LEVEL SECURITY is required, not just ENABLE: the app's own
-- Postgres role owns these tables (it ran the migrations), and table
-- owners bypass RLS by default. Without FORCE, this migration would be a
-- no-op for the exact role that needs it enforced against.
--
-- Deliberately excludes `memberships` and `refresh_tokens`: both are
-- queried during the auth flow itself (login/refresh/logout), before any
-- tenant context can exist — see ADR-0015's "What's not covered" section.

ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "incidents"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "decisions"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "evidence"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timeline_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "timeline_events"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "actions"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "intelligence_analyses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intelligence_analyses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "intelligence_analyses"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "executive_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "executive_briefs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "executive_briefs"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "decision_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "decision_reports"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "lessons_learned" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lessons_learned" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "lessons_learned"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "integration_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "integration_configs"
  USING ("tenantId" = current_setting('app.tenant_id', true));
