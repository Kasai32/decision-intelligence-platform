'use client';

import type { LessonLearned } from '@dip/shared';
import { BookOpen, Radar } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiClient, ApiError } from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-storage';

/**
 * Knowledge Base search (Phase 5, see ADR-0011) — GET /knowledge-base/search,
 * ILIKE + tag filter over every tenant `LessonLearned`. No results shown
 * before a search is run, rather than the full tenant history by default.
 */
export default function KnowledgeBasePage() {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState('');
  const [results, setResults] = useState<LessonLearned[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!getAccessToken()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Knowledge base</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">You need to sign in to search the knowledge base.</p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('query', query.trim());
      if (tags.trim()) params.set('tags', tags.trim());
      const found = await apiClient.get<LessonLearned[]>(`/knowledge-base/search?${params.toString()}`);
      setResults(found);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Knowledge base</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Radar className="h-4 w-4" />
            Command Center
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSearch}>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="kb-query">Search</Label>
              <Input
                id="kb-query"
                placeholder="Matched against title and what happened"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="kb-tags">Tags (comma-separated)</Label>
              <Input
                id="kb-tags"
                placeholder="database, timeout"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </CardContent>
        </Card>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {results !== null && (
        <div className="flex flex-col gap-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons learned match this search.</p>
          ) : (
            results.map((lesson) => (
              <Card key={lesson.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{lesson.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{lesson.whatHappened}</p>
                  {lesson.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {lesson.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </main>
  );
}
