'use client';

import type { IntegrationConfigStatus, IntegrationStatusSummary } from '@dip/shared';
import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { apiClient, ApiError } from '../lib/api-client';

const STATUS_VARIANT: Record<
  IntegrationStatusSummary['status'],
  'success' | 'destructive' | 'outline'
> = {
  ACTIVE: 'success',
  BROKEN: 'destructive',
  NOT_CONFIGURED: 'outline',
};

export interface IntegrationCardProps {
  summary: IntegrationStatusSummary;
  onChange: (summary: IntegrationStatusSummary) => void;
  onRemoved: (providerType: IntegrationStatusSummary['providerType']) => void;
}

/**
 * One Phase 6 provider's configuration state and admin actions (see
 * ADR-0012). No client-side role check — same pattern as `/simulation`
 * (ADR-0013): the backend's `@Roles(Role.ADMIN)` 403 is the only
 * enforcement, so a non-admin sees these actions but gets a rejected
 * request rather than a hidden button.
 */
export function IntegrationCard({ summary, onChange, onRemoved }: IntegrationCardProps) {
  const [showConfigureForm, setShowConfigureForm] = useState(false);
  const [credentialsJson, setCredentialsJson] = useState('{}');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function configure() {
    setError(null);
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      setError('Credentials must be valid JSON.');
      return;
    }

    setPending(true);
    try {
      const updated = await apiClient.post<IntegrationStatusSummary>(
        `/integrations/${summary.providerType}/config`,
        { credentials },
      );
      onChange(updated);
      setShowConfigureForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to configure integration');
    } finally {
      setPending(false);
    }
  }

  async function setStatus(status: IntegrationConfigStatus) {
    setError(null);
    setPending(true);
    try {
      const updated = await apiClient.patch<IntegrationStatusSummary>(
        `/integrations/${summary.providerType}/config/status`,
        { status },
      );
      onChange(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update integration status');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setError(null);
    setPending(true);
    try {
      await apiClient.delete(`/integrations/${summary.providerType}/config`);
      onRemoved(summary.providerType);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove integration');
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          {summary.displayName}
          <Badge variant={STATUS_VARIANT[summary.status]}>{summary.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">circuit: {summary.circuitState}</Badge>
          {summary.updatedAt && <span>Updated {new Date(summary.updatedAt).toLocaleString()}</span>}
        </div>

        {showConfigureForm && (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label={`${summary.displayName} credentials JSON`}
              value={credentialsJson}
              onChange={(e) => setCredentialsJson(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Fixture credentials only (see ADR-0012) — no real OAuth exists in this environment.
              Try{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {'{"simulateFailure":true}'}
              </code>{' '}
              to exercise the circuit breaker.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {!summary.configured ? (
          showConfigureForm ? (
            <>
              <Button type="button" size="sm" disabled={pending} onClick={configure}>
                {pending ? 'Saving…' : 'Save credentials'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowConfigureForm(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowConfigureForm(true)}
            >
              Configure
            </Button>
          )
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || summary.status === 'ACTIVE'}
              onClick={() => setStatus('ACTIVE')}
            >
              Set active
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || summary.status === 'BROKEN'}
              onClick={() => setStatus('BROKEN')}
            >
              Set broken
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              Remove
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
