# Standing Context

Last updated: 2026-07-19.

## Current phase

**Phase 2 — Platform core is complete** (Authentication, RBAC, Tenant Management, API Gateway, Core Database), per [PREREQUIS.md](../PREREQUIS.md). Phase 1 (Foundation) was completed and committed first (`e197079`). Both phases are verified end-to-end: lint/format/test/build all green, and the full stack (Postgres + api + web) was built and smoke-tested live via `docker compose up --build`, including the actual auth flow (register/login/refresh/logout) and RBAC (tenant member add/remove, owner-removal protection) against a real running API + database. See [DECISION_LOG.md](../DECISION_LOG.md) for the full record.

**Next up per the roadmap: Phase 3 — Executive Command Center, Incident Timeline, Decision Timeline, Executive Dashboard.** Not started. Flagged as a good checkpoint to pause at: Phase 3 requires designing the actual `Incident`/`Decision` data model, which is more of a product-design decision than Phases 1–2's well-established engineering patterns (repo scaffolding, auth, multi-tenancy) — a human should sanity-check the shape of that model before it's built and migrated, since getting it wrong is expensive to unwind once Phase 4/5 build on top of it.

## Operating mode

This repository is being built by an AI agent (Claude Code) operating autonomously end-to-end, per explicit user instruction: no per-decision human approval, errors handled inline, every technical decision logged to `DECISION_LOG.md` as it was made. If you are a human picking this up: read `DECISION_LOG.md` top to bottom before assuming any stack/structure/business-logic choice was discussed with you — most weren't, by design.

## Known constraints at time of writing

- No git remote configured — repository is local-only until one is added.
- No cloud provider, hosting target, or deployment environment specified anywhere in the source roadmap.
- No specific compliance/regulatory requirement (SOC2, HIPAA, etc.) was specified, despite the enterprise-integration surface (Sentinel, Splunk, etc.) suggesting one may eventually apply. Revisit before Phase 6.
- **Phase 6 (Enterprise Integrations: ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog, Microsoft Sentinel) cannot be built without real credentials/OAuth app registrations for each service — none exist in this environment.**
- **Phase 4 (Decision Intelligence Engine — Recommendation Engine, Confidence Model, Business Impact Analysis) requires actual business/algorithmic decisions that are product decisions, not technical ones.**
- **Phase 3's Incident/Decision data model is a product-design decision, not a purely technical one — see "Next up" above.**

## Decisions made in Phase 2 (see DECISION_LOG.md / docs/adr for full rationale)

- ORM: Prisma, pinned to latest stable **6.x (6.19.3)**, not the newly-released 7.x (breaking config-model change — see DECISION_LOG.md).
- Multi-tenancy: shared schema, `tenantId` column scoping (ADR-0004).
- Auth: self-hosted email/password + JWT, argon2 password hashing, revocable rotating refresh tokens (ADR-0005).
- Core Database models: `Tenant`, `User`, `Membership` (role: OWNER/ADMIN/MEMBER), `RefreshToken`.
- API Gateway: global `ValidationPipe`, global `AllExceptionsFilter`, `/api/v1` prefix, Swagger at `/api/v1/docs`.
- Known Phase 2 limitation (by design, not a bug): a user with memberships in more than one tenant cannot currently log in — `/auth/login` requires exactly one membership. Multi-tenant login/tenant-selection is explicitly deferred; see `docs/api/README.md`.

## Open questions for later phases

- Hosting/deployment target (needed before CI/CD can deploy anything, not just build/test it).
- Email delivery provider (needed for real invite/password-reset flows — Phase 2 ships invite-by-membership-row only, no email sending yet).
- Multi-tenant login/tenant-selection flow (see limitation above).
- Phase 3 Incident/Decision data model — needs product input, see "Next up" above.
- Phase 4 confidence-scoring methodology — needs product input.
- Phase 6 — needs real credentials per integration, see constraint above.
