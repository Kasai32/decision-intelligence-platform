# 0001. Record architecture decisions as ADRs

Date: 2026-07-19

## Status

Accepted

## Context

The roadmap ([PREREQUIS.md](../../PREREQUIS.md)) explicitly requires an "ADR process" as a Phase 1 deliverable, alongside a Decision Log. The project is being built across six phases by an AI agent operating autonomously (no human review gate per decision, per explicit user instruction), so decisions need to be durably recorded for a human to audit later — both the fine-grained "what was decided" (Decision Log) and the coarse-grained "what was decided and why it's hard to reverse" (ADRs).

## Decision

Use lightweight Markdown ADRs (Michael Nygard style) stored in `docs/adr/`, numbered sequentially, indexed in `docs/adr/README.md`. Not every decision gets one — only decisions that are architecturally significant and costly to reverse (frameworks, data model shape, security boundaries, integration patterns). Routine decisions go in `DECISION_LOG.md` only.

## Consequences

- Future contributors (human or agent) can find the _why_ behind a hard-to-change choice without archaeology through commit history.
- Adds minor overhead per significant decision (one more file to write) — acceptable given the alternative is losing the rationale entirely.
- Requires discipline to keep the index in `docs/adr/README.md` in sync; this is a manual step until/unless a lint rule is added.

## Alternatives considered

- ADRs only, no separate Decision Log — rejected, too heavyweight for the volume of small decisions made during autonomous Phase 1 scaffolding.
- Decision Log only, no ADRs — rejected, the roadmap explicitly calls out "Create ADR process" as its own deliverable, and ADRs are more discoverable for the handful of truly load-bearing decisions.
