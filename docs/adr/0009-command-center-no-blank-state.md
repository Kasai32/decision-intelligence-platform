# 0009. Executive Command Center: server-shaped "no blank state" contract

Date: 2026-07-19

## Status

Accepted

## Context

Phase 3's spec (see `PREREQUIS.md` §2 — Interface Contract) requires the Executive Command Center to pass a "30-second North Star test": a viewer must understand an incident's state almost immediately, and if there is no open decision, the UI must show the outcome of the last decision made instead of nothing. The question is where this "what should be shown" logic lives: computed ad hoc in the frontend from raw lists, or shaped by the API.

## Decision

`GET /incidents/:id/command-center` (`IncidentsService.getCommandCenterSummary`) returns a single, pre-shaped payload: `{ incident, openDecision, lastDecision }`, where `openDecision` is the most recent `Decision` with `status = OPEN` for that incident (or `null`), and `lastDecision` is the most recent `Decision` with `status = DECIDED` (or `null`), regardless of whether `openDecision` is set. `apps/web`'s command center page renders strictly from this shape:

- `openDecision` present → show it as the primary "decision required" state.
- `openDecision` absent, `lastDecision` present → show the last decision's outcome (`humanDecision`, decided by whom, when) as the primary state — the spec's explicit requirement.
- both absent → an explicit "no decisions recorded yet for this incident" message — content, not an empty screen.

## Consequences

- The "never blank" rule is enforced once, server-side, rather than reimplemented (and potentially gotten wrong) in every frontend surface that shows an incident's decision status.
- The frontend component logic is a straightforward three-way render on a shape it doesn't have to compute itself, which is also what makes it straightforward to unit-test (see `apps/web` command-center tests) — the three states above map directly to three test cases.
- Coupling the frontend contract to this specific endpoint shape means a future UI change to "what counts as the headline decision" is a backend change, not scattered frontend logic — consistent with keeping business rules server-side.

## Alternatives considered

- Have the frontend fetch the full decisions list and compute open-vs-last itself — rejected: duplicates a business rule client-side, and every future consumer (mobile app, another dashboard) would have to reimplement the same "never blank" logic correctly.
