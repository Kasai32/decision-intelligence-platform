'use client';

import type { AuthTokens, TenantOption, TenantSelectionRequired } from '@dip/shared';
import { Radar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { storeTokens } from '../../lib/auth-storage';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';

function isTenantSelectionRequired(
  response: AuthTokens | TenantSelectionRequired,
): response is TenantSelectionRequired {
  return 'tenantSelectionRequired' in response;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set only once an account with more than one tenant membership has
  // passed the password check — the account's tenants to pick from, and the
  // short-lived token proving that check already happened (see ADR-0017).
  const [tenantSelection, setTenantSelection] = useState<{
    token: string;
    tenants: TenantOption[];
  } | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await apiClient.post<AuthTokens | TenantSelectionRequired>('/auth/login', {
        email,
        password,
      });
      if (isTenantSelectionRequired(response)) {
        setTenantSelection({ token: response.tenantSelectionToken, tenants: response.tenants });
        setSelectedTenantId(response.tenants[0]?.id ?? '');
        return;
      }
      storeTokens(response);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectTenant(event: FormEvent) {
    event.preventDefault();
    if (!tenantSelection) return;
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await apiClient.post<AuthTokens>('/auth/select-tenant', {
        tenantSelectionToken: tenantSelection.token,
        tenantId: selectedTenantId,
      });
      storeTokens(tokens);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to continue with that tenant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Radar className="h-5 w-5 text-primary" />
            Sign in
          </CardTitle>
          <CardDescription>Decision Intelligence Platform</CardDescription>
        </CardHeader>
        <CardContent>
          {tenantSelection ? (
            <form onSubmit={handleSelectTenant} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tenant">This account belongs to multiple tenants</Label>
                <Select
                  id="tenant"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  required
                >
                  {tenantSelection.tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? 'Continuing…' : 'Continue'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => {
                  setTenantSelection(null);
                  setError(null);
                }}
              >
                Back
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
