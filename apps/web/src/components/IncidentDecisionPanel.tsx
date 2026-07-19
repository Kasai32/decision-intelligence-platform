import type { Decision } from '@dip/shared';

export interface IncidentDecisionPanelProps {
  openDecision: Decision | null;
  lastDecision: Decision | null;
}

/**
 * Renders the "30-second North Star" decision state for an incident
 * (see ADR-0009 / PREREQUIS.md §2 — Interface Contract). Never renders
 * nothing: if there is no open decision, it shows the outcome of the last
 * decided one; if there has never been a decision at all, it renders an
 * explicit empty-state message instead of a blank panel.
 */
export function IncidentDecisionPanel({ openDecision, lastDecision }: IncidentDecisionPanelProps) {
  if (openDecision) {
    return (
      <section aria-label="Decision required" data-state="open-decision">
        <h2>Decision required</h2>
        <p>{openDecision.question}</p>
        <p>Status: awaiting a named human decision.</p>
      </section>
    );
  }

  if (lastDecision) {
    return (
      <section aria-label="Last decision" data-state="last-decision">
        <h2>Last decision</h2>
        <p>{lastDecision.question}</p>
        <p>{lastDecision.humanDecision}</p>
        {lastDecision.decidedAt && (
          <p>
            Decided {new Date(lastDecision.decidedAt).toLocaleString()}
            {lastDecision.rationale ? ` — ${lastDecision.rationale}` : ''}
          </p>
        )}
      </section>
    );
  }

  return (
    <section aria-label="No decisions" data-state="empty">
      <h2>No decisions recorded yet for this incident</h2>
      <p>Open a decision to start tracking one.</p>
    </section>
  );
}
