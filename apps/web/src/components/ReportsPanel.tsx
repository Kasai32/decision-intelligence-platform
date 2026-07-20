import type { Decision, IncidentStatus } from '@dip/shared';
import { useEffect, useState } from 'react';
import { DecisionOutcomePanel } from './DecisionOutcomePanel';
import { DecisionReportsPanel } from './DecisionReportsPanel';
import { ExecutiveBriefsPanel } from './ExecutiveBriefsPanel';
import { LessonsLearnedPanel } from './LessonsLearnedPanel';
import { apiClient, ApiError } from '../lib/api-client';

export interface ReportsPanelProps {
  incidentId: string;
  incidentStatus: IncidentStatus;
}

/** Composes the three Phase 5 reporting surfaces for the selected incident (see ADR-0011). */
export function ReportsPanel({ incidentId, incidentStatus }: ReportsPanelProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDecisions([]);
    apiClient
      .get<Decision[]>(`/incidents/${incidentId}/decisions`)
      .then(setDecisions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load decisions'));
  }, [incidentId]);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ExecutiveBriefsPanel incidentId={incidentId} />
      <DecisionReportsPanel decisions={decisions} />
      <DecisionOutcomePanel decisions={decisions} incidentStatus={incidentStatus} />
      <LessonsLearnedPanel incidentId={incidentId} incidentStatus={incidentStatus} />
    </div>
  );
}
