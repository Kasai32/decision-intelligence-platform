'use client';

import type { DecisionOutcome, DecisionOutcomeQuality, IncidentStatus } from '@dip/shared';
import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DecisionSummary } from './DecisionReportsPanel';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';

const QUALITY_OPTIONS: DecisionOutcomeQuality[] = ['GOOD', 'BAD', 'MIXED', 'UNKNOWN'];

const QUALITY_VARIANT: Record<
  DecisionOutcomeQuality,
  'success' | 'destructive' | 'medium' | 'outline'
> = {
  GOOD: 'success',
  BAD: 'destructive',
  MIXED: 'medium',
  UNKNOWN: 'outline',
};

export interface DecisionOutcomePanelProps {
  decisions: DecisionSummary[];
  incidentStatus: IncidentStatus;
}

/**
 * Records a human's retrospective judgment of whether each DECIDED decision
 * turned out well — the raw material for the Decision Intelligence Engine's
 * calibration report (see ADR-0016, `/calibration`). Entirely human-authored,
 * like Lessons Learned — this UI never lets the system grade its own
 * recommendation, and (matching LessonsLearnedPanel) only offers the form
 * once the incident is CLOSED.
 */
export function DecisionOutcomePanel({ decisions, incidentStatus }: DecisionOutcomePanelProps) {
  const [outcomeByDecision, setOutcomeByDecision] = useState<
    Record<string, DecisionOutcome | null>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutcomeByDecision({});
    decisions.forEach((decision) => {
      apiClient
        .get<DecisionOutcome>(`/decisions/${decision.id}/outcome`)
        .then((outcome) =>
          setOutcomeByDecision((current) => ({ ...current, [decision.id]: outcome })),
        )
        .catch((err) => {
          if (err instanceof ApiError && err.statusCode === 404) {
            setOutcomeByDecision((current) => ({ ...current, [decision.id]: null }));
            return;
          }
          setError(err instanceof ApiError ? err.message : 'Failed to load decision outcomes');
        });
    });
  }, [decisions.map((d) => d.id).join(',')]);

  function handleRecorded(decisionId: string, outcome: DecisionOutcome) {
    setOutcomeByDecision((current) => ({ ...current, [decisionId]: outcome }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Target className="h-4 w-4 text-primary" />
          Decision outcomes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No decisions opened for this incident yet.
          </p>
        ) : (
          decisions.map((decision) => (
            <div key={decision.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{decision.question}</p>
              <div className="mt-2">
                {outcomeByDecision[decision.id] === undefined ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : outcomeByDecision[decision.id] ? (
                  <RecordedOutcome outcome={outcomeByDecision[decision.id]!} />
                ) : incidentStatus === 'CLOSED' ? (
                  <RecordOutcomeForm decisionId={decision.id} onRecorded={handleRecorded} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Outcomes can only be recorded once this incident is CLOSED (current status:{' '}
                    {incidentStatus}).
                  </p>
                )}
              </div>
            </div>
          ))
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecordedOutcome({ outcome }: { outcome: DecisionOutcome }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={QUALITY_VARIANT[outcome.outcomeQuality]}>{outcome.outcomeQuality}</Badge>
        <span className="text-xs text-muted-foreground">
          Recorded {new Date(outcome.recordedAt).toLocaleString()}
        </span>
      </div>
      {outcome.notes && <p className="text-sm text-foreground">{outcome.notes}</p>}
    </div>
  );
}

function RecordOutcomeForm({
  decisionId,
  onRecorded,
}: {
  decisionId: string;
  onRecorded: (decisionId: string, outcome: DecisionOutcome) => void;
}) {
  const [quality, setQuality] = useState<DecisionOutcomeQuality>('GOOD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await apiClient.post<DecisionOutcome>(`/decisions/${decisionId}/outcome`, {
        outcomeQuality: quality,
        notes: notes.trim() || undefined,
      });
      onRecorded(decisionId, outcome);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record outcome');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Outcome quality"
          value={quality}
          onChange={(e) => setQuality(e.target.value as DecisionOutcomeQuality)}
          className="w-auto"
        >
          {QUALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Recording…' : 'Record outcome'}
        </Button>
      </div>
      <Textarea
        aria-label="Outcome notes"
        placeholder="Optional notes on what actually happened…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
