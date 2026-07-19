# Product Roadmap

## Phase 1 — Foundation (CURRENT)

Goal:
Create a production-ready architecture before writing business features.

Tasks

- Define project structure
- Define coding standards
- Define architecture
- Create ADR process
- Create Decision Log
- Create Memory folder
- Create documentation structure
- Configure CI/CD
- Configure Docker
- Configure linting
- Configure testing
- Configure formatting
- Configure security scanning

Deliverable

A clean enterprise-grade repository ready for development.

---

## Phase 2

Authentication

RBAC

Tenant Management

API Gateway

Core Database

---

## Phase 3

Executive Command Center

Incident Timeline

Decision Timeline

Executive Dashboard

### Phase 3 — Detailed Specification

> Note: this subsection was not present in the original file — it was provided directly by the user in chat on 2026-07-19 (the user referred to it as already documented here; it wasn't, on disk). Recorded here verbatim/paraphrased so it's not lost, per the same pattern as the original Phase 1–6 roadmap capture.

**§2. Domain Model** — Implement strictly the entities `Incident`, `Decision`, `Evidence`, `TimelineEvent`, and `Action` in the Prisma schema. Every table must carry an `organization_id`-equivalent field, indexed, guaranteeing the strict tenant isolation already validated in Phase 2 (see ADR-0004). _(Implementation note: this codebase's existing multi-tenancy concept is `tenantId` — see ADR-0006 for why `organization_id` is treated as the same concept rather than a parallel field.)_

**§2. State Transition Guards** — Build a state-transition validation engine in `apps/api`. Example: a request attempting to move a `Decision` to `Decided` must throw a `BadRequestException` if the payload does not contain a valid `human_decision` with a **named human Stakeholder**. **Principle 1: the AI validates nothing alone** — no state transition that represents a real-world decision may be completed without an explicitly named, verified human actor.

**§2. Interface Contract (Executive Command Center)** — On `apps/web` (Next.js), structure the main page to pass the **North Star test (30 seconds)**: a viewer must be able to understand the state of an incident within 30 seconds. If an incident has no open decision, the UI must force the display of the outcome of the last decision made. No blank screen state is permitted.

---

## Phase 4

Decision Intelligence Engine

Evidence Collection

Recommendation Engine

Confidence Model

Business Impact Analysis

---

## Phase 5

Executive Brief Generator

Decision Reports

Lessons Learned

Knowledge Base

---

## Phase 6

Enterprise Integrations

ServiceNow

Jira

Slack

Teams

AWS

Azure

GCP

Splunk

Datadog

Microsoft Sentinel
