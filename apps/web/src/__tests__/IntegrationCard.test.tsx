import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { IntegrationStatusSummary } from '@dip/shared';
import { IntegrationCard } from '../components/IntegrationCard';
import { apiClient } from '../lib/api-client';

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

const activeSummary: IntegrationStatusSummary = {
  providerType: 'DATADOG',
  displayName: 'Datadog',
  configured: true,
  status: 'ACTIVE',
  circuitState: 'CLOSED',
  updatedAt: '2026-07-19T12:00:00.000Z',
};

describe('IntegrationCard (ADR-0012 — per-provider admin actions)', () => {
  beforeEach(() => {
    (apiClient.patch as jest.Mock).mockReset();
  });

  it('sets a configured provider to BROKEN via PATCH', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ ...activeSummary, status: 'BROKEN' });
    const onChange = jest.fn();

    render(<IntegrationCard summary={activeSummary} onChange={onChange} onRemoved={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /set broken/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/integrations/DATADOG/config/status', {
        status: 'BROKEN',
      });
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'BROKEN' }));
  });

  it('disables the "set active" action when already ACTIVE', () => {
    render(<IntegrationCard summary={activeSummary} onChange={jest.fn()} onRemoved={jest.fn()} />);
    expect(screen.getByRole('button', { name: /set active/i })).toBeDisabled();
  });
});
