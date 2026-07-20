# 0014. Frontend design system: Tailwind v4 + CVA/Radix primitives, dark command-center theme, deterministic SLA countdowns

Date: 2026-07-19

## Status

Accepted

## Context

The Dry Run validated the backend end-to-end (all 6 roadmap phases + ADR-0013's simulation scenarios), but the user judged the frontend experience unacceptable for an enterprise demo: `apps/web` had zero CSS framework — every page (`/`, `/login`, `/simulation`) was unstyled, browser-default HTML. The user's explicit, scoped instruction: stop all backend work; make Command Center UI + a new "Decision Log UI" the only objective; adopt a professional design system (naming Tremor or shadcn/ui as reference points, leaving room for a better fit); go dark-themed with clear severity color coding; and add **visually live countdown timers** on open decisions to convey urgency. The goal stated explicitly: the next demo must "inspire confiance et urgence."

Two concrete gaps had to be resolved to satisfy this:

1. **No CSS/component system existed at all** — not even Tailwind. `apps/web/package.json` had only `next`/`react`/`react-dom`.
2. **Nothing in the domain model represents "how much time is left" on a decision.** `Decision` (see ADR-0006) has no deadline/SLA field, and adding one would be a schema change — squarely backend work, explicitly out of scope for this task. A countdown timer needs a deadline to count down to.

## Decision

### Design system: Tailwind CSS v4 + hand-authored shadcn-style primitives (not the shadcn CLI, not Tremor)

- **Tailwind CSS v4** (`tailwindcss` + `@tailwindcss/postcss`, CSS-first config via `@theme` in `globals.css`, no `tailwind.config.ts` needed) — utility-first, zero runtime cost, pairs natively with Next.js App Router.
- **shadcn/ui's approach, not its CLI**: shadcn/ui is not an npm package — it's a code generator that copies component source (Button, Badge, Card, Tabs, …) into the repo, built on Radix UI primitives + `class-variance-authority` (CVA) for variants + `tailwind-merge`/`clsx` for class composition. The CLI is interactive and assumes a scaffolding flow this environment can't drive non-interactively, so the same output was hand-authored directly: `src/components/ui/{button,badge,card,separator,tabs,input,label}.tsx`, `src/lib/utils.ts` (`cn()`), using the same CVA-variant pattern shadcn generates. Result is identical in spirit and fully compatible with the real `shadcn` CLI later if the team wants to add more components that way.
- **Tremor was considered and rejected for this phase**: Tremor is excellent for chart-heavy analytics dashboards, but Phase 4's actual surface (incident list, decision cards, a chronological log, countdown badges) is composition of cards/badges/tabs, not charts — CVA/Radix primitives are a better fit and lighter weight. Nothing here blocks adding Tremor later for a metrics/trends dashboard.
- **`lucide-react`** for icons (alert-triangle, shield, clock, radio) — the same icon set shadcn/ui ships with by convention.
- **Dark-only, not a light/dark toggle.** The product is explicitly framed as a command-center/incident-response tool — the user asked for "sombre" as the identity, not a togglable preference. All color tokens are defined once as CSS custom properties on `:root` in `globals.css` (no `.dark` class, no `prefers-color-scheme` branch, no toggle component) — this also avoids any light/dark flash-of-unstyled-content or hydration-mismatch risk since there's exactly one theme to render, server or client.

### Severity color coding

A fixed, semantic token mapping — not ad hoc Tailwind classes scattered per component — defined once in `src/lib/severity.ts` and consumed by `SeverityBadge`:

| `IncidentSeverity` | Color semantic          | Rationale                |
| ------------------ | ----------------------- | ------------------------ |
| `CRITICAL`         | red (`--critical`)      | Immediate, active threat |
| `HIGH`             | orange/amber (`--high`) | Urgent, not yet critical |
| `MEDIUM`           | yellow (`--medium`)     | Degraded, monitored      |
| `LOW`              | slate/blue (`--low`)    | Informational            |

Applied consistently: incident list left-border + badge, Command Center header accent, and decision cards inherit their parent incident's severity color — one glance at color tells you what's on fire.

### Countdown timers: a deterministic, disclosed SLA policy computed entirely client-side — not a backend change

Since `Decision` has no deadline field and adding one is backend work explicitly out of scope, `CountdownTimer` counts down to a deadline **computed, not stored**: `deadline = decision.createdAt + SLA_MINUTES[incident.severity]`, using a fixed, documented response-window table (`src/lib/sla-policy.ts`):

| Severity   | SLA response window |
| ---------- | ------------------- |
| `CRITICAL` | 15 minutes          |
| `HIGH`     | 60 minutes          |
| `MEDIUM`   | 4 hours             |
| `LOW`      | 24 hours            |

This follows the same anti-fabrication discipline as every prior phase (Principle 3 — see ADR-0010/0011/0013): the countdown is never a fake/random number, it's a deterministic function of two real fields (`decision.createdAt`, `incident.severity`) against an explicit, disclosed policy — exactly like `evidenceCompleteness`'s scoring tables. **It is, however, a genuinely new business assumption this task introduces on the frontend alone** (no product/ops stakeholder specified these exact windows) — flagged here rather than silently presented as if it came from a real SLA configuration. `CountdownTimer` ticks client-side (`setInterval`, 1s), color-escalates (calm → amber under 50% remaining → red pulsing under 20% → a red "OVERDUE" state past the deadline), and is purely presentational: it reads `Decision`/`Incident` fields already returned by the existing (unmodified) `GET /incidents/:id/command-center` endpoint. No new endpoint, no schema change, no DTO change — zero backend surface touched, per the user's explicit constraint.

**Follow-up flagged, not built now:** a real product decision on configurable, per-tenant SLA policy (stored server-side, editable by an admin) belongs in a future phase — see `memory/context.md` open questions. This ADR's table is a reasonable, labeled placeholder that makes the UI honest about urgency using real timestamps, not a permanent policy design.

### Decision Log UI

A new `DecisionLog` component/tab renders the incident's existing `GET /incidents/:id/timeline` feed (already real, already tenant-scoped, already an immutable audit trail — see ADR-0006) as a styled chronological log, distinct from the live "what needs a decision right now" Command Center view. This is a presentation-only addition: no new endpoint. `TimelineEvent` gains a plain-interface type in `packages/shared/src/types.ts` (mirroring the existing `Incident`/`Decision`/`CommandCenterSummary` types already there) so the frontend can type the response — this is a type-only addition with zero runtime/behavioral change to `apps/api`, consistent with `packages/shared`'s existing purpose (see ADR-0006), not "backend work" in the sense the user meant to halt.

## Consequences

- Every page in `apps/web` (`/`, `/login`, `/simulation`) is restyled with the same primitives for visual consistency — not just the Command Center — since a demo mixing a polished dashboard with unstyled `/login` would look broken, not professional.
- `IncidentDecisionPanel` (ADR-0009/ADR-0013's "never blank" contract) keeps its exact state logic (open / last-decided / empty) — only its rendering changes. The countdown timer only ever needs `decision.createdAt` and the parent `incident.severity`, both already present in every `CommandCenterSummary` response.
- Zero new backend endpoints, DTOs, guards, or migrations. `packages/shared`'s only change is one additive, type-only interface.
- Bundle cost: Tailwind v4 adds no runtime JS (compiles to static CSS); CVA/Radix Tabs/Slot/clsx/tailwind-merge/lucide-react are small, tree-shakeable, standard shadcn-ecosystem dependencies.

## Alternatives considered

- **Tremor** — rejected for this phase (see above); revisit if/when a metrics/trends dashboard is built.
- **Store a real `Decision.respondBy` deadline in the database** — rejected: requires a Prisma migration and service change, explicitly forbidden by "arrête toute tâche sur le backend" for this task. Revisit as a real feature once product defines an actual SLA policy.
- **`prefers-color-scheme` / light+dark toggle** — rejected: the user asked for a dark-identity product, not a preference; a toggle adds state, a settings surface, and FOUC risk for no requested benefit.
- **Plain inline Tailwind utility classes with no component layer** — rejected: would make severity color usage inconsistent across the app and impossible to audit in one place; CVA-based primitives keep every variant enumerable and centrally defined.
