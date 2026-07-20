import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ExecutiveBrief } from '@dip/shared';
import { ExecutiveBriefsPanel } from '../components/ExecutiveBriefsPanel';
import { apiClient } from '../lib/api-client';

jest.mock('../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

const brief: ExecutiveBrief = {
  id: 'brief-1',
  tenantId: 't1',
  incidentId: 'incident-1',
  title: 'Executive Brief — Payments outage',
  incidentStatus: 'MITIGATED',
  incidentSeverity: 'HIGH',
  summary:
    'Incident "Payments outage" is currently MITIGATED (HIGH severity). 1 of 1 decision(s) made.',
  businessImpact: null,
  keyDecisions: [],
  openRisks: [],
  nextActions: [],
  additionalNotes: null,
  generatedByUserId: 'user-1',
  generatedAt: '2026-07-19T12:00:00.000Z',
};

describe('ExecutiveBriefsPanel (ADR-0011 — Phase 5 Reporting)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.post as jest.Mock).mockReset();
  });

  it('shows an explicit empty state when no brief exists yet', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    render(<ExecutiveBriefsPanel incidentId="incident-1" />);
    await waitFor(() => {
      expect(screen.getByText(/no executive brief generated yet/i)).toBeInTheDocument();
    });
  });

  it('generates a brief and prepends it to the list', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue(brief);

    render(<ExecutiveBriefsPanel incidentId="incident-1" />);
    await waitFor(() =>
      expect(screen.getByText(/no executive brief generated yet/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /generate executive brief/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/incidents/incident-1/executive-brief', {
        additionalNotes: undefined,
      });
    });
    expect(await screen.findByText(brief.title)).toBeInTheDocument();
  });
});
