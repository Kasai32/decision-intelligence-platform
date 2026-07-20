-- Extends ADR-0015's Postgres RLS coverage to the six new tables added by
-- entity_relationship_graph_and_audit_log (see ADR-0021). Same policy
-- shape as every other RLS migration; dip_app already has DML on these
-- tables via the app_role_least_privilege migration's
-- ALTER DEFAULT PRIVILEGES (it covers tables created by later migrations
-- too, since they all run as the same role) — only the table-specific RLS
-- policy needs to be added explicitly here.

ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entities"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "relationships"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "entity_evidence_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_evidence_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entity_evidence_links"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "relationship_evidence_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationship_evidence_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "relationship_evidence_links"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "entity_merge_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entity_merge_suggestions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entity_merge_suggestions"
  USING ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_log_entries"
  USING ("tenantId" = current_setting('app.tenant_id', true));
