'use client';

import type { ExecutiveBrief } from '@dip/shared';
import { FileText } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';

export interface ExecutiveBriefsPanelProps {
  incidentId: string;
}

/**
 * Executive Briefs (Phase 5, see ADR-0011) — every field except
 * `additionalNotes` is assembled server-side from real rows at generation
 * time; nothing here is client-computed or fabricated.
 */
export function ExecutiveBriefsPanel({ incidentId }: ExecutiveBriefsPanelProps) {
  const [briefs, setBriefs] = useState<ExecutiveBrief[] | null>(null);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBriefs(null);
    apiClient
      .get<ExecutiveBrief[]>(`/incidents/${incidentId}/executive-briefs`)
      .then(setBriefs)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load executive briefs'),
      );
  }, [incidentId]);

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setGenerating(true);
    try {
      const brief = await apiClient.post<ExecutiveBrief>(
        `/incidents/${incidentId}/executive-brief`,
        {
          additionalNotes: notes.trim() || undefined,
        },
      );
      setBriefs((current) => [brief, ...(current ?? [])]);
      setNotes('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate executive brief');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          Executive briefs
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {briefs === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : briefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No executive brief generated yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {briefs.map((brief) => (
              <li key={brief.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{brief.title}</p>
                  <Badge variant="outline">{brief.incidentStatus}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{brief.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Generated {new Date(brief.generatedAt).toLocaleString()}
                </p>
                {brief.additionalNotes && (
                  <p className="mt-2 text-sm text-foreground">{brief.additionalNotes}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
      <form onSubmit={handleGenerate} className="contents">
        <CardFooter className="flex flex-col items-stretch gap-2">
          <Textarea
            aria-label="Additional notes"
            placeholder="Optional additional notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button type="submit" disabled={generating}>
            {generating ? 'Generating…' : 'Generate executive brief'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
