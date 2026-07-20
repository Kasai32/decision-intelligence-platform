'use client';

import type { Incident, SimulationScenario } from '@dip/shared';
import { Flame, Radar, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-storage';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

interface SimulationTriggerResult {
  scenario: SimulationScenario;
  incident: Incident;
}

const SCENARIOS: Array<{
  scenario: SimulationScenario;
  label: string;
  description: string;
  icon: typeof Flame;
}> = [
  {
    scenario: 'CYBER_RANSOMWARE',
    label: 'Scenario A — Ransomware attack',
    description:
      'Creates a CRITICAL security-breach incident with two simultaneously open decisions ' +
      '(isolate the network vs. communicate publicly), left undecided — exercises the ' +
      'multi-decision Command Center panel.',
    icon: Flame,
  },
  {
    scenario: 'CLOUD_OUTAGE_PARTIAL_EVIDENCE',
    label: 'Scenario B — Cloud outage, partial evidence',
    description:
      'Creates a HIGH cloud-outage incident with only partial evidence attached and trips the ' +
      'tenant\'s Datadog integration circuit breaker — exercises the "not enough evidence" state.',
    icon: ShieldOff,
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>User validation test scenarios</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              You need to sign in as a tenant admin to trigger scenarios.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">User validation test scenarios</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Each button below instantly creates a disposable, tenant-scoped test incident (titled with a{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">[SIMULATION]</code> prefix)
        in the Command Center. ADMIN role required.
      </p>

      <ul aria-label="Simulation scenarios" className="grid gap-4 sm:grid-cols-2">
        {SCENARIOS.map(({ scenario, label, description, icon: Icon }) => (
          <li key={scenario}>
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-critical" />
                  {label}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => trigger(scenario)}
                  disabled={pendingScenario !== null}
                >
                  {pendingScenario === scenario ? 'Triggering…' : `Trigger ${label}`}
                </Button>
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
