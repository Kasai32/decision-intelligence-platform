import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DecisionOutcome } from '@dip/shared';
import { DecisionOutcomePanel } from '../components/DecisionOutcomePanel';
import { apiClient, ApiError } from '../lib/api-client';

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

const decisions = [{ id: 'decision-1', question: 'Roll back the deploy?' }];

const recordedOutcome: DecisionOutcome = {
  id: 'outcome-1',
  tenantId: 't1',
  decisionId: 'decision-1',
  intelligenceAnalysisId: 'analysis-1',
  outcomeQuality: 'GOOD',
  notes: 'Resolved within 10 minutes.',
  recordedByUserId: 'user-1',
  recordedAt: '2026-07-20T12:00:00.000Z',
};

describe('DecisionOutcomePanel (ADR-0016 — human-attested outcomes)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockReset();
    (apiClient.post as jest.Mock).mockReset();
  });

  it('shows an explicit empty state when the incident has no decisions', () => {
    render(<DecisionOutcomePanel decisions={[]} incidentStatus="OPEN" />);
    expect(screen.getByText(/no decisions opened for this incident yet/i)).toBeInTheDocument();
  });

  it('explains the CLOSED gate instead of showing a form for a non-CLOSED incident', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(
      new ApiError(404, 'No outcome recorded for this decision'),
    );
    render(<DecisionOutcomePanel decisions={decisions} incidentStatus="RESOLVED" />);

    await waitFor(() => expect(screen.getByText(/current status: RESOLVED/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /record outcome/i })).not.toBeInTheDocument();
  });

  it('shows the already-recorded outcome instead of a form', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(recordedOutcome);
    render(<DecisionOutcomePanel decisions={decisions} incidentStatus="CLOSED" />);

    expect(await screen.findByText('GOOD')).toBeInTheDocument();
    expect(screen.getByText('Resolved within 10 minutes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record outcome/i })).not.toBeInTheDocument();
  });

  it('records a new outcome for a CLOSED incident and shows it immediately', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(
      new ApiError(404, 'No outcome recorded for this decision'),
    );
    (apiClient.post as jest.Mock).mockResolvedValue(recordedOutcome);

    render(<DecisionOutcomePanel decisions={decisions} incidentStatus="CLOSED" />);
    await screen.findByRole('button', { name: /record outcome/i });

    fireEvent.click(screen.getByRole('button', { name: /record outcome/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/decisions/decision-1/outcome', {
        outcomeQuality: 'GOOD',
        notes: undefined,
      });
    });
    expect(await screen.findByText('Resolved within 10 minutes.')).toBeInTheDocument();
  });
});
