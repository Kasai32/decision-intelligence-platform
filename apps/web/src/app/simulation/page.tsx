'use client';

import type { Incident, SimulationScenario } from '@dip/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-storage';

interface SimulationTriggerResult {
  scenario: SimulationScenario;
  incident: Incident;
}

const SCENARIOS: Array<{
  scenario: SimulationScenario;
  label: string;
  description: string;
}> = [
  {
    scenario: 'CYBER_RANSOMWARE',
    label: 'Scenario A — Ransomware attack',
    description:
      'Creates a CRITICAL security-breach incident with two simultaneously open decisions ' +
      '(isolate the network vs. communicate publicly), left undecided — exercises the ' +
      'multi-decision Command Center panel.',
  },
  {
    scenario: 'CLOUD_OUTAGE_PARTIAL_EVIDENCE',
    label: 'Scenario B — Cloud outage, partial evidence',
    description:
      'Creates a HIGH cloud-outage incident with only partial evidence attached and trips the ' +
      "tenant's Datadog integration circuit breaker — exercises the \"not enough evidence\" state.",
  },
];

/**
 * ADMIN-only facilitator panel for user-validation test sessions (see
 * ADR-0013). The backend enforces the ADMIN role regardless of what this
 * page shows — a non-admin who navigates here simply gets a 403 from the
 * API when they click a button.
 */
export default function SimulationPage() {
  const router = useRouter();
  const [pendingScenario, setPendingScenario] = useState<SimulationScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!getAccessToken()) {
    return (
      <main>
        <h1>User validation test scenarios</h1>
        <p>
          You need to sign in as a tenant admin to trigger scenarios. <Link href="/login">Sign in</Link>
        </p>
      </main>
    );
  }

  async function trigger(scenario: SimulationScenario) {
    setError(null);
    setPendingScenario(scenario);
    try {
      // Command Center orders incidents newest-first and auto-selects the
      // first one, so the just-triggered incident is what loads next.
      await apiClient.post<SimulationTriggerResult>('/simulation/trigger', { scenario });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to trigger scenario');
      setPendingScenario(null);
    }
  }

  return (
    <main>
      <h1>User validation test scenarios</h1>
      <p>
        Each button below instantly creates a disposable, tenant-scoped test incident (titled
        with a <code>[SIMULATION]</code> prefix) in the Command Center. ADMIN role required.
      </p>
      <ul aria-label="Simulation scenarios">
        {SCENARIOS.map(({ scenario, label, description }) => (
          <li key={scenario}>
            <h2>{label}</h2>
            <p>{description}</p>
            <button
              type="button"
              onClick={() => trigger(scenario)}
              disabled={pendingScenario !== null}
            >
              {pendingScenario === scenario ? 'Triggering…' : `Trigger ${label}`}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
