import type { IncidentStatus, TimelineEvent } from '@dip/shared';
import { useMemo } from 'react';
import { DecisionReportsPanel, type DecisionSummary } from './DecisionReportsPanel';
import { ExecutiveBriefsPanel } from './ExecutiveBriefsPanel';
import { LessonsLearnedPanel } from './LessonsLearnedPanel';

const DECISION_OPENED_PATTERN = /^Decision opened: "(.*)"$/;

/** `timeline` already carries every `DECISION_OPENED` event's `decisionId` — no new "list decisions" endpoint needed. */
function decisionsFromTimeline(timeline: TimelineEvent[]): DecisionSummary[] {
  return timeline
    .filter((event): event is TimelineEvent & { decisionId: string } => event.type === 'DECISION_OPENED' && event.decisionId !== null)
    .map((event) => ({
      id: event.decisionId,
      question: DECISION_OPENED_PATTERN.exec(event.description)?.[1] ?? event.description,
    }));
}

export interface ReportsPanelProps {
  incidentId: string;
  incidentStatus: IncidentStatus;
  timeline: TimelineEvent[];
}

/** Composes the three Phase 5 reporting surfaces for the selected incident (see ADR-0011). */
export function ReportsPanel({ incidentId, incidentStatus, timeline }: ReportsPanelProps) {
  const decisions = useMemo(() => decisionsFromTimeline(timeline), [timeline]);

  return (
    <div className="flex flex-col gap-4">
      <ExecutiveBriefsPanel incidentId={incidentId} />
      <DecisionReportsPanel decisions={decisions} />
      <LessonsLearnedPanel incidentId={incidentId} incidentStatus={incidentStatus} />
    </div>
  );
}
