import type { Decision } from '@dip/shared';

export interface IncidentDecisionPanelProps {
  openDecisions: Decision[];
  lastDecision: Decision | null;
}

/**
 * Renders the "30-second North Star" decision state for an incident
 * (see ADR-0009 / PREREQUIS.md §2 — Interface Contract, amended by
 * ADR-0013 to support multiple simultaneously open decisions). Never
 * renders nothing: if there are no open decisions, it shows the outcome of
 * the last decided one; if there has never been a decision at all, it
 * renders an explicit empty-state message instead of a blank panel.
 */
export function IncidentDecisionPanel({ openDecisions, lastDecision }: IncidentDecisionPanelProps) {
  if (openDecisions.length > 0) {
    return (
      <section aria-label="Decisions required" data-state="open-decision">
        <h2>
          {openDecisions.length === 1
            ? 'Decision required'
            : `${openDecisions.length} decisions required`}
        </h2>
        <ul>
          {openDecisions.map((decision) => (
            <li key={decision.id} data-decision-id={decision.id}>
              <p>{decision.question}</p>
              <p>Status: awaiting a named human decision.</p>
            </li>
          ))}
        </ul>
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
