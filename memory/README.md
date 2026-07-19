# Project Memory

This folder is the project's own institutional memory — standing context and vocabulary that any contributor (human or AI agent) working on this repository should read before making changes. It is distinct from `DECISION_LOG.md` (chronological, append-only record of individual decisions) and `docs/adr/` (deep-dive rationale for specific hard-to-reverse decisions): this folder is the current-state summary, kept up to date rather than appended to.

## Contents

- [`glossary.md`](glossary.md) — domain terms specific to this platform (Decision Intelligence, Confidence Model, etc.) and their precise meaning in this codebase.
- [`context.md`](context.md) — standing facts about the project that don't belong in code comments or architecture docs but that anyone picking up work needs to know (current phase, known constraints, open questions).

## Maintenance rule

Update these files in place when a fact changes (e.g. moving from Phase 1 to Phase 2). Do not accumulate history here — history belongs in `DECISION_LOG.md` and git.
