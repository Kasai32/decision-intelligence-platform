'use client';

import type { IntegrationStatusSummary } from '@dip/shared';
import { Radar, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { IntegrationCard } from '../../components/IntegrationCard';
import { apiClient, ApiError } from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-storage';

/**
 * Per-tenant configuration for the ten Phase 6 enterprise integrations (see
 * ADR-0012). No client-side role check — write actions are ADMIN-gated by
 * the backend only, same pattern as `/simulation` (ADR-0013).
 */
export default function IntegrationsPage() {
  const [summaries, setSummaries] = useState<IntegrationStatusSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    apiClient
      .get<IntegrationStatusSummary[]>('/integrations')
      .then(setSummaries)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load integrations'),
      );
  }, []);

  if (!getAccessToken()) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              You need to sign in to manage integrations.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  function updateSummary(updated: IntegrationStatusSummary) {
    setSummaries((current) =>
      (current ?? []).map((summary) =>
        summary.providerType === updated.providerType ? updated : summary,
      ),
    );
  }

  function removeSummary(providerType: IntegrationStatusSummary['providerType']) {
    setSummaries((current) =>
      (current ?? []).map((summary) =>
        summary.providerType === providerType
          ? {
              ...summary,
              configured: false,
              status: 'NOT_CONFIGURED',
              circuitState: 'CLOSED',
              updatedAt: null,
            }
          : summary,
      ),
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Radar className="h-4 w-4" />
            Command Center
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Ten enterprise systems (ServiceNow, Jira, Slack, Teams, AWS, Azure, GCP, Splunk, Datadog,
        Microsoft Sentinel), each independently circuit-breaker-protected. An unconfigured provider
        runs in a stub mode and never blocks an incident/decision action. ADMIN role required to
        configure, change status, or remove.
      </p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {summaries === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => (
            <IntegrationCard
              key={summary.providerType}
              summary={summary}
              onChange={updateSummary}
              onRemoved={removeSummary}
            />
          ))}
        </div>
      )}
    </main>
  );
}
