-- Least-privilege application role (see ADR-0015).
--
-- The role that runs migrations (and owns every table — `dip` in
-- docker-compose.yml, and the equivalent bootstrap user in every ephemeral
-- testcontainers instance the e2e suite starts) is a Postgres SUPERUSER:
-- the official postgres Docker image's POSTGRES_USER becomes the
-- cluster's bootstrap superuser. Postgres RLS — even WITH the FORCE
-- option from the previous migration — is unconditionally bypassed by
-- superusers; there is no policy or setting that changes this. Without a
-- second, genuinely unprivileged role for the RUNNING APPLICATION to
-- connect as (distinct from the role that runs migrations), the entire
-- previous migration is a silent no-op for the exact connection the app
-- actually uses. This was caught by an adversarial e2e test attempting a
-- direct, unfiltered raw query — see DECISION_LOG.md.
--
-- `dip_app` gets ordinary DML (SELECT/INSERT/UPDATE/DELETE) on every
-- current AND future table (via ALTER DEFAULT PRIVILEGES) — nothing
-- structural, so it cannot run migrations, create/alter/drop tables, or
-- manage roles. apps/api's PrismaService connects as this role via
-- APP_DATABASE_URL (see apps/api/.env.example); DATABASE_URL (the
-- superuser role) remains what `prisma migrate deploy` uses.
--
-- The password below is a disclosed, dev-only default — same pattern as
-- JWT_ACCESS_SECRET/INTEGRATION_CREDENTIALS_ENCRYPTION_KEY in
-- apps/api/.env.example. Any non-local environment must use a real,
-- distinct password (ALTER ROLE dip_app WITH PASSWORD '...').

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dip_app') THEN
    CREATE ROLE dip_app WITH LOGIN PASSWORD 'dip-app-dev-only-change-me' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO dip_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dip_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dip_app;

-- Covers tables/sequences added by any migration that runs after this one.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dip_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dip_app;
