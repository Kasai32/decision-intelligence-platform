import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntelligenceAnalysisForm } from '../components/IntelligenceAnalysisForm';
import { apiClient, ApiError } from '../lib/api-client';

jest.mock('../lib/api-client', () => ({
  apiClient: { post: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/situation summary/i), {
    target: { value: 'Payments API returning 500s.' },
  });
  fireEvent.change(screen.getByLabelText(/business impact description/i), {
    target: { value: 'Checkout degraded for all customers.' },
  });
  fireEvent.change(screen.getByLabelText(/recommended decision label/i), {
    target: { value: 'Roll back deploy' },
  });
  fireEvent.change(screen.getByLabelText(/recommended decision description/i), {
    target: { value: 'Revert to previous stable release.' },
  });
  fireEvent.change(screen.getByLabelText(/expected consequences/i), {
    target: { value: 'Brief downtime, then recovery.' },
  });
  fireEvent.change(screen.getByLabelText(/executive summary/i), {
    target: { value: 'Recommend immediate rollback.' },
  });
}

describe('IntelligenceAnalysisForm (ADR-0010 — human-supplied qualitative fields)', () => {
  beforeEach(() => {
    (apiClient.post as jest.Mock).mockReset();
  });

  it('submits the qualitative fields to POST /incidents/:id/analyze and normalizes the nested confidenceDimensions response', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
      tenantId: 't1',
      incidentId: 'incident-1',
      situationSummary: 'Payments API returning 500s.',
      businessImpact: { level: 'MEDIUM', description: 'Checkout degraded for all customers.', affectedSystems: [] },
      criticalRisks: [],
      conflictingInformation: [],
      recommendedDecision: { label: 'Roll back deploy', description: 'Revert to previous stable release.' },
      alternativeDecisions: [],
      expectedConsequences: 'Brief downtime, then recovery.',
      immediateNextActions: [],
      executiveSummary: 'Recommend immediate rollback.',
      evidenceUsed: ['ev-1'],
      missingInformation: [],
      confidenceDimensions: {
        evidenceCompleteness: 60,
        sourceReliability: 80,
        dataFreshness: 90,
        aiCertainty: 55,
      },
      submittedByUserId: 'user-1',
      createdAt: '2026-07-19T12:00:00.000Z',
    });

    const onCreated = jest.fn();
    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={onCreated} />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit analysis/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/incidents/incident-1/analyze',
        expect.objectContaining({
          situationSummary: 'Payments API returning 500s.',
          recommendedDecision: {
            label: 'Roll back deploy',
            description: 'Revert to previous stable release.',
          },
        }),
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'analysis-1',
          evidenceCompleteness: 60,
          sourceReliability: 80,
          dataFreshness: 90,
          aiCertainty: 55,
        }),
      );
    });
    // The nested shape from the API must not leak into the normalized caller-facing object.
    expect(onCreated.mock.calls[0][0].confidenceDimensions).toBeUndefined();
  });

  it('shows the backend error message and does not call onCreated when submission fails', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new ApiError(400, 'situationSummary must not be empty'));

    const onCreated = jest.fn();
    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={onCreated} />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /submit analysis/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('situationSummary must not be empty');
    });
    expect(onCreated).not.toHaveBeenCalled();
  });
});
