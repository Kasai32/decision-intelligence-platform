'use client';

import type {
  CommandCenterSummary,
  Incident,
  IntelligenceAnalysis,
  TimelineEvent,
} from '@dip/shared';
import { FileText, LogOut, Radar, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DecisionLog } from '../components/DecisionLog';
import { IncidentDecisionPanel } from '../components/IncidentDecisionPanel';
import { IntelligenceAnalysisForm } from '../components/IntelligenceAnalysisForm';
import { IntelligenceAnalysisPanel } from '../components/IntelligenceAnalysisPanel';
import { LiveSyncIndicator } from '../components/LiveSyncIndicator';
import { ReportsPanel } from '../components/ReportsPanel';
import { SeverityBadge } from '../components/SeverityBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { apiClient, ApiError } from '../lib/api-client';
import { clearTokens, getAccessToken } from '../lib/auth-storage';
import { severityBorderClass } from '../lib/severity';
import { cn } from '../lib/utils';

type LoadState = 'checking-auth' | 'loading' | 'ready' | 'error';

/**
 * Background refresh interval for the selected incident's command-center
 * summary/timeline/analyses (see ADR-0020) — so a decision, evidence, or
 * analysis someone else adds shows up without a manual reload. Short
 * enough to feel live, long enough to stay well under the app-wide
 * 100-req/min rate limit even with several tabs open (3 requests/poll).
 */
const LIVE_REFRESH_INTERVAL_MS = 8000;

export default function CommandCenterPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('checking-auth');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [analyses, setAnalyses] = useState<IntelligenceAnalysis[] | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoadState('ready');
      return;
    }
    setLoadState('loading');
    apiClient
      .get<Incident[]>('/incidents')
      .then((list) => {
        setIncidents(list);
        setSelectedIncidentId(list[0]?.id ?? null);
        setLoadState('ready');
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to load incidents');
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    if (!selectedIncidentId) {
      setSummary(null);
      setTimeline(null);
      setAnalyses(null);
      setLastSyncedAt(null);
      return;
    }

    let cancelled = false;
    // Reset only on incident change, not on every background poll below —
    // a poll silently replaces already-shown data, it never blanks it out.
    setSummary(null);
    setTimeline(null);
    setAnalyses(null);
    setLastSyncedAt(null);

    function refresh() {
      Promise.all([
        apiClient.get<CommandCenterSummary>(`/incidents/${selectedIncidentId}/command-center`),
        apiClient.get<TimelineEvent[]>(`/incidents/${selectedIncidentId}/timeline`),
        apiClient.get<IntelligenceAnalysis[]>(`/incidents/${selectedIncidentId}/analyses`),
      ])
        .then(([summaryResult, timelineResult, analysesResult]) => {
          if (cancelled) return;
          setSummary(summaryResult);
          setTimeline(timelineResult);
          setAnalyses(analysesResult);
          setLastSyncedAt(Date.now());
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMessage(err instanceof ApiError ? err.message : 'Failed to load incident');
        });
    }

    refresh();
    const interval = setInterval(refresh, LIVE_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedIncidentId]);

  function signOut() {
    clearTokens();
    router.push('/login');
  }

  if (loadState === 'checking-auth' || loadState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading command center…</p>
      </main>
    );
  }

  if (!getAccessToken()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle as="h1" className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Executive Command Center
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">You need to sign in to view incidents.</p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm border-destructive/40">
          <CardHeader>
            <CardTitle as="h1">Executive Command Center</CardTitle>
          </CardHeader>
          <CardContent>
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-px bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Radar className="h-5 w-5 text-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="text-kicker text-muted-foreground">
              Decision Intelligence Platform
            </span>
            <h1 className="text-lg font-semibold tracking-tight">Executive Command Center</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/calibration">Calibration</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/integrations">Integrations</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/knowledge-base">Knowledge base</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/simulation">User validation scenarios</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      {incidents.length === 0 ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No incidents recorded yet.
            </CardContent>
          </Card>
        </main>
      ) : (
        <div className="flex flex-1">
          <nav
            aria-label="Incidents"
            className="w-80 shrink-0 overflow-y-auto border-r border-border bg-black/25 p-3"
          >
            <ul className="flex flex-col gap-2">
              {incidents.map((incident) => (
                <li key={incident.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    aria-current={incident.id === selectedIncidentId}
                    className={cn(
                      'w-full rounded border border-border border-l-4 bg-card p-3 text-left shadow-sm ' +
                        'transition-colors hover:border-ring/50 hover:bg-accent',
                      severityBorderClass(incident.severity),
                      incident.id === selectedIncidentId
                        ? 'border-ring bg-accent ring-1 ring-ring'
                        : '',
                    )}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{incident.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <Badge variant="outline">{incident.status}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {selectedIncident && (
            <main className="flex-1 overflow-y-auto p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    {selectedIncident.title}
                  </h2>
                  <SeverityBadge severity={selectedIncident.severity} />
                  <Badge variant="outline">{selectedIncident.status}</Badge>
                </div>
                <LiveSyncIndicator lastSyncedAt={lastSyncedAt} />
              </div>

              {summary ? (
                <Tabs defaultValue="command-center">
                  <TabsList>
                    <TabsTrigger value="command-center">
                      <Radar className="mr-1.5 h-4 w-4" />
                      Command Center
                    </TabsTrigger>
                    <TabsTrigger value="decision-log">
                      <ScrollText className="mr-1.5 h-4 w-4" />
                      Decision Log
                    </TabsTrigger>
                    <TabsTrigger value="intelligence">
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Decision Intelligence
                    </TabsTrigger>
                    <TabsTrigger value="reports">
                      <FileText className="mr-1.5 h-4 w-4" />
                      Reports
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="command-center">
                    <IncidentDecisionPanel
                      openDecisions={summary.openDecisions}
                      lastDecision={summary.lastDecision}
                      severity={selectedIncident.severity}
                    />
                  </TabsContent>
                  <TabsContent value="decision-log">
                    <DecisionLog events={timeline ?? []} />
                  </TabsContent>
                  <TabsContent value="intelligence" className="flex flex-col gap-4">
                    <IntelligenceAnalysisPanel analyses={analyses ?? []} />
                    <IntelligenceAnalysisForm
                      incidentId={selectedIncident.id}
                      onCreated={(analysis) =>
                        setAnalyses((current) => [analysis, ...(current ?? [])])
                      }
                    />
                  </TabsContent>
                  <TabsContent value="reports">
                    <ReportsPanel
                      incidentId={selectedIncident.id}
                      incidentStatus={selectedIncident.status}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-sm text-muted-foreground">Loading decision status…</p>
              )}
            </main>
          )}
        </div>
      )}
    </div>
  );
}
