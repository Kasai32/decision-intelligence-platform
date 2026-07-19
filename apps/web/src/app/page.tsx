'use client';

import type { CommandCenterSummary, Incident } from '@dip/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../lib/api-client';
import { getAccessToken } from '../lib/auth-storage';
import { IncidentDecisionPanel } from '../components/IncidentDecisionPanel';

type LoadState = 'checking-auth' | 'loading' | 'ready' | 'error';

export default function CommandCenterPage() {
  const [loadState, setLoadState] = useState<LoadState>('checking-auth');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null);

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
      return;
    }
    apiClient
      .get<CommandCenterSummary>(`/incidents/${selectedIncidentId}/command-center`)
      .then(setSummary)
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to load incident');
      });
  }, [selectedIncidentId]);

  if (loadState === 'checking-auth' || loadState === 'loading') {
    return (
      <main>
        <h1>Executive Command Center</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!getAccessToken()) {
    return (
      <main>
        <h1>Executive Command Center</h1>
        <p>
          You need to sign in to view incidents. <Link href="/login">Sign in</Link>
        </p>
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main>
        <h1>Executive Command Center</h1>
        <p role="alert">{errorMessage}</p>
      </main>
    );
  }

  if (incidents.length === 0) {
    return (
      <main>
        <h1>Executive Command Center</h1>
        <p>No incidents recorded yet.</p>
      </main>
    );
  }

  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId);

  return (
    <main>
      <h1>Executive Command Center</h1>
      <p>
        <Link href="/simulation">User validation test scenarios</Link>
      </p>
      <nav aria-label="Incidents">
        <ul>
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button type="button" onClick={() => setSelectedIncidentId(incident.id)}>
                {incident.title} — {incident.status} ({incident.severity})
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {selectedIncident && (
        <article>
          <h2>{selectedIncident.title}</h2>
          <p>
            Status: {selectedIncident.status} · Severity: {selectedIncident.severity}
          </p>
          {summary ? (
            <IncidentDecisionPanel
              openDecisions={summary.openDecisions}
              lastDecision={summary.lastDecision}
            />
          ) : (
            <p>Loading decision status…</p>
          )}
        </article>
      )}
    </main>
  );
}
