'use client';

import type { IncidentStatus, LessonLearned } from '@dip/shared';
import { BookOpen } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseCommaList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export interface LessonsLearnedPanelProps {
  incidentId: string;
  incidentStatus: IncidentStatus;
}

/**
 * Lessons Learned (Phase 5, see ADR-0011) — entirely human-authored; the
 * backend rejects creation unless the incident is CLOSED, since a
 * retrospective before closure isn't a retrospective. The form here mirrors
 * that gate rather than silently hiding it.
 */
export function LessonsLearnedPanel({ incidentId, incidentStatus }: LessonsLearnedPanelProps) {
  const [lessons, setLessons] = useState<LessonLearned[] | null>(null);
  const [title, setTitle] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatToImprove, setWhatToImprove] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLessons(null);
    apiClient
      .get<LessonLearned[]>(`/incidents/${incidentId}/lessons-learned`)
      .then(setLessons)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load lessons learned'),
      );
  }, [incidentId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const lesson = await apiClient.post<LessonLearned>(
        `/incidents/${incidentId}/lessons-learned`,
        {
          title,
          whatHappened,
          whatWentWell: parseLines(whatWentWell),
          whatToImprove: parseLines(whatToImprove),
          actionItems: parseLines(actionItems),
          tags: parseCommaList(tags),
        },
      );
      setLessons((current) => [lesson, ...(current ?? [])]);
      setTitle('');
      setWhatHappened('');
      setWhatWentWell('');
      setWhatToImprove('');
      setActionItems('');
      setTags('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record lesson learned');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-primary" />
          Lessons learned
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {lessons === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lesson learned recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lessons.map((lesson) => (
              <li key={lesson.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">{lesson.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{lesson.whatHappened}</p>
                {lesson.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lesson.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
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

      {incidentStatus !== 'CLOSED' ? (
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            Lessons learned can only be recorded once this incident is CLOSED (current status:{' '}
            {incidentStatus}).
          </p>
        </CardFooter>
      ) : (
        <form onSubmit={handleSubmit} className="contents">
          <CardContent className="flex flex-col gap-3 pt-0">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lessonTitle">Title</Label>
              <Input
                id="lessonTitle"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="whatHappened">What happened</Label>
              <Textarea
                id="whatHappened"
                required
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="whatWentWell">What went well (one per line)</Label>
              <Textarea
                id="whatWentWell"
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="whatToImprove">What to improve (one per line)</Label>
              <Textarea
                id="whatToImprove"
                value={whatToImprove}
                onChange={(e) => setWhatToImprove(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="actionItems">Action items (one per line)</Label>
              <Textarea
                id="actionItems"
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lessonTags">Tags (comma-separated)</Label>
              <Input id="lessonTags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Record lesson learned'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
