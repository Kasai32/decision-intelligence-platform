'use client';

import type { DecisionReport } from '@dip/shared';
import { FileStack } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { apiClient, ApiError } from '../lib/api-client';

export interface DecisionSummary {
  id: string;
  question: string;
}

export interface DecisionReportsPanelProps {
  decisions: DecisionSummary[];
}

/**
 * Per-decision immutable report snapshots (Phase 5, see ADR-0011). `decisions`
 * is fetched by the caller from `GET /incidents/:id/decisions`.
 */
export function DecisionReportsPanel({ decisions }: DecisionReportsPanelProps) {
  const [reportsByDecision, setReportsByDecision] = useState<Record<string, DecisionReport[]>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReportsByDecision({});
    decisions.forEach((decision) => {
      apiClient
        .get<DecisionReport[]>(`/decisions/${decision.id}/reports`)
        .then((reports) =>
          setReportsByDecision((current) => ({ ...current, [decision.id]: reports })),
        )
        .catch((err) =>
          setError(err instanceof ApiError ? err.message : 'Failed to load decision reports'),
        );
    });
  }, [decisions.map((d) => d.id).join(',')]);

  async function generate(decisionId: string) {
    setError(null);
    setGeneratingId(decisionId);
    try {
      const report = await apiClient.post<DecisionReport>(`/decisions/${decisionId}/report`, {});
      setReportsByDecision((current) => ({
        ...current,
        [decisionId]: [report, ...(current[decisionId] ?? [])],
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate decision report');
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileStack className="h-4 w-4 text-primary" />
          Decision reports
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No decisions opened for this incident yet.
          </p>
        ) : (
          decisions.map((decision) => {
            const reports = reportsByDecision[decision.id] ?? [];
            return (
              <div key={decision.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{decision.question}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={generatingId === decision.id}
                    onClick={() => generate(decision.id)}
                  >
                    {generatingId === decision.id ? 'Generating…' : 'Generate report'}
                  </Button>
                </div>
                {reports.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {reports.map((report) => (
                      <li key={report.id} className="text-xs text-muted-foreground">
                        Report generated {new Date(report.generatedAt).toLocaleString()} — status{' '}
                        {report.status}
                        {report.humanDecision ? `: "${report.humanDecision}"` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
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
