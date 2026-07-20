import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { IntegrationStatusSummary } from '@dip/shared';
import IntegrationsPage from '../app/integrations/page';
import { apiClient } from '../lib/api-client';
import { getAccessToken } from '../lib/auth-storage';

jest.mock('../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

jest.mock('../lib/auth-storage', () => ({
  getAccessToken: jest.fn(() => 'a-token'),
}));

const summaries: IntegrationStatusSummary[] = [
  {
    providerType: 'SLACK',
    displayName: 'Slack',
    configured: false,
    status: 'NOT_CONFIGURED',
    circuitState: 'CLOSED',
    updatedAt: null,
  },
  {
    providerType: 'DATADOG',
    displayName: 'Datadog',
    configured: true,
    status: 'ACTIVE',
    circuitState: 'CLOSED',
    updatedAt: '2026-07-19T12:00:00.000Z',
  },
];

describe('IntegrationsPage (ADR-0012 — Phase 6 per-tenant configuration)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.post as jest.Mock).mockReset();
    (apiClient.patch as jest.Mock).mockReset();
    (apiClient.delete as jest.Mock).mockReset();
    (getAccessToken as jest.Mock).mockReturnValue('a-token');
  });

  it('never renders blank when unauthenticated — shows a sign-in prompt instead', () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<IntegrationsPage />);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('lists all providers returned by GET /integrations with their status', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(summaries);
    render(<IntegrationsPage />);

    expect(await screen.findByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('Datadog')).toBeInTheDocument();
    expect(screen.getByText('NOT_CONFIGURED')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('configures an unconfigured provider with JSON credentials', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(summaries);
    (apiClient.post as jest.Mock).mockResolvedValue({
      ...summaries[0],
      configured: true,
      status: 'ACTIVE',
      updatedAt: '2026-07-19T12:30:00.000Z',
    });

    render(<IntegrationsPage />);
    await screen.findByText('Slack');

    fireEvent.click(screen.getByRole('button', { name: /^configure$/i }));
    fireEvent.change(screen.getByLabelText(/slack credentials json/i), {
      target: { value: '{"apiKey":"fixture"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save credentials/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/integrations/SLACK/config', {
        credentials: { apiKey: 'fixture' },
      });
    });
  });

  it('rejects invalid JSON credentials without calling the API', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(summaries);
    render(<IntegrationsPage />);
    await screen.findByText('Slack');

    fireEvent.click(screen.getByRole('button', { name: /^configure$/i }));
    fireEvent.change(screen.getByLabelText(/slack credentials json/i), {
      target: { value: 'not json' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save credentials/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid json/i);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('removes a configured provider', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(summaries);
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);

    render(<IntegrationsPage />);
    await screen.findByText('Datadog');

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/integrations/DATADOG/config');
    });
  });
});
