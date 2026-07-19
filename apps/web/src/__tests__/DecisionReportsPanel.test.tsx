import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DecisionReport } from '@dip/shared';
import { DecisionReportsPanel } from '../components/DecisionReportsPanel';
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

const report: DecisionReport = {
  id: 'report-1',
  tenantId: 't1',
  decisionId: 'decision-1',
  incidentId: 'incident-1',
  question: 'Roll back the deploy?',
  status: 'DECIDED',
  humanDecision: 'Roll back',
  rationale: 'Error rate spiked after deploy',
  decidedByUserId: 'user-1',
  decidedAt: '2026-07-19T12:00:00.000Z',
  evidenceSummary: [],
  timelineSummary: [],
  additionalNotes: null,
  generatedByUserId: 'user-1',
  generatedAt: '2026-07-19T12:05:00.000Z',
};

describe('DecisionReportsPanel (ADR-0011 — per-decision snapshots)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.post as jest.Mock).mockReset();
  });

  it('shows an explicit empty state when the incident has no decisions', () => {
    render(<DecisionReportsPanel decisions={[]} />);
    expect(screen.getByText(/no decisions opened for this incident yet/i)).toBeInTheDocument();
  });

  it('lists a generate button per decision and loads its existing reports', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    render(<DecisionReportsPanel decisions={[{ id: 'decision-1', question: 'Roll back the deploy?' }]} />);

    expect(screen.getByText('Roll back the deploy?')).toBeInTheDocument();
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/decisions/decision-1/reports');
    });
  });

  it('generates a report for a decision and shows it in that decision\'s list', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    (apiClient.post as jest.Mock).mockResolvedValue(report);

    render(<DecisionReportsPanel decisions={[{ id: 'decision-1', question: 'Roll back the deploy?' }]} />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/decisions/decision-1/report', {});
    });
    expect(await screen.findByText(/status DECIDED/)).toBeInTheDocument();
  });
});
