import type { TimelineEvent, TimelineEventType } from '@dip/shared';
import {
  AlertOctagon,
  CheckCircle2,
  CircleDot,
  FileText,
  Flame,
  HelpCircle,
  ListTree,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

const EVENT_ICON: Record<TimelineEventType, typeof Flame> = {
  INCIDENT_CREATED: Flame,
  INCIDENT_STATUS_CHANGED: CircleDot,
  DECISION_OPENED: HelpCircle,
  DECISION_DECIDED: CheckCircle2,
  DECISION_CANCELLED: XCircle,
  EVIDENCE_ADDED: FileText,
  ACTION_CREATED: ListTree,
  ACTION_STATUS_CHANGED: ListTree,
  INTELLIGENCE_ANALYSIS_GENERATED: Sparkles,
  EXECUTIVE_BRIEF_GENERATED: FileText,
  DECISION_REPORT_GENERATED: FileText,
  LESSON_LEARNED_CREATED: FileText,
  INTEGRATION_BLOCKED: AlertOctagon,
};

const EVENT_ACCENT: Record<TimelineEventType, string> = {
  INCIDENT_CREATED: 'text-critical',
  INCIDENT_STATUS_CHANGED: 'text-primary',
  DECISION_OPENED: 'text-medium',
  DECISION_DECIDED: 'text-success',
  DECISION_CANCELLED: 'text-muted-foreground',
  EVIDENCE_ADDED: 'text-low',
  ACTION_CREATED: 'text-primary',
  ACTION_STATUS_CHANGED: 'text-primary',
  INTELLIGENCE_ANALYSIS_GENERATED: 'text-low',
  EXECUTIVE_BRIEF_GENERATED: 'text-primary',
  DECISION_REPORT_GENERATED: 'text-primary',
  LESSON_LEARNED_CREATED: 'text-primary',
  INTEGRATION_BLOCKED: 'text-destructive',
};

export interface DecisionLogProps {
  events: TimelineEvent[];
}

/**
 * Chronological, read-only audit trail for an incident (see ADR-0014 —
 * "Decision Log UI"). Renders GET /incidents/:id/timeline, already a real
 * append-only feed (ADR-0006) — nothing here is synthesized.
 */
export function DecisionLog({ events }: DecisionLogProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No events recorded for this incident yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision log</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4" aria-label="Incident event history, most recent last">
          {events.map((event) => {
            const Icon = EVENT_ICON[event.type];
            return (
              <li key={event.id} className="flex gap-3">
                <span className={cn('mt-0.5 shrink-0', EVENT_ACCENT[event.type])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-foreground">{event.description}</p>
                  <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
