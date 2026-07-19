# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 1 — Foundation**, per [PREREQUIS.md](../PREREQUIS.md). No business logic, auth, database schema, or real UI exists yet by design. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record of what was decided while building this phase.

## Operating mode

This repository's Phase 1 scaffold was built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure choice was discussed with you — it wasn't, by design, and several choices (see "Open questions" below) were made with reasonable defaults in the absence of explicit requirements and should be revisited against actual product/business needs.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply. Revisit before Phase 6.

## Open questions for the next phase (Phase 2)

- ORM/migration tool for PostgreSQL (Prisma is the likely default; not yet decided — see DECISION_LOG.md database entry).
- Multi-tenancy isolation strategy: shared-schema with `tenant_id` scoping vs. schema-per-tenant vs. database-per-tenant. Needs an ADR before Phase 2 schema work starts.
- Auth provider: build vs. buy (e.g. Auth0/Clerk) vs. self-hosted (e.g. NestJS Passport + JWT). Not decided.
- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
