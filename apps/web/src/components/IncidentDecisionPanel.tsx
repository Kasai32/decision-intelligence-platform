import type { Decision, IncidentSeverity } from '@dip/shared';
import { CheckCircle2, HelpCircle, Inbox } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { computeDecisionDeadline } from '../lib/sla-policy';

export interface IncidentDecisionPanelProps {
  openDecisions: Decision[];
  lastDecision: Decision | null;
  /** Drives each open decision's SLA countdown (see ADR-0014). */
  severity: IncidentSeverity;
}

/**
 * Renders the "30-second North Star" decision state for an incident
 * (see ADR-0009 / PREREQUIS.md §2 — Interface Contract, amended by
 * ADR-0013 to support multiple simultaneously open decisions, restyled per
 * ADR-0014). Never renders nothing: if there are no open decisions, it
 * shows the outcome of the last decided one; if there has never been a
 * decision at all, it renders an explicit empty-state message instead of a
 * blank panel.
 */
export function IncidentDecisionPanel({
  openDecisions,
  lastDecision,
  severity,
}: IncidentDecisionPanelProps) {
  if (openDecisions.length > 0) {
    return (
      <section
        aria-label="Decisions required"
        data-state="open-decision"
        className="flex flex-col gap-3"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <HelpCircle className="h-5 w-5 text-medium" />
          {openDecisions.length === 1
            ? 'Decision required'
            : `${openDecisions.length} decisions required`}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {openDecisions.map((decision) => (
            <Card key={decision.id} data-decision-id={decision.id} className="border-medium/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium leading-snug">
                  {decision.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Awaiting a named human decision.
              </CardContent>
              <CardFooter>
                <CountdownTimer
                  createdAt={decision.createdAt}
                  deadline={computeDecisionDeadline(decision.createdAt, severity)}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (lastDecision) {
    return (
      <section aria-label="Last decision" data-state="last-decision">
        <Card className="border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Last decision
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{lastDecision.question}</p>
            <p className="text-sm text-muted-foreground">{lastDecision.humanDecision}</p>
            {lastDecision.decidedAt && (
              <p className="text-xs text-muted-foreground">
                Decided {new Date(lastDecision.decidedAt).toLocaleString()}
                {lastDecision.rationale ? ` — ${lastDecision.rationale}` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-label="No decisions" data-state="empty">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Inbox className="h-4 w-4" />
            No decisions recorded yet for this incident
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Open a decision to start tracking one.
        </CardContent>
      </Card>
    </section>
  );
}
