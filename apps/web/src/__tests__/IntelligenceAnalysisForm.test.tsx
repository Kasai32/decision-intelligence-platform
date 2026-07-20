import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntelligenceAnalysisForm } from '../components/IntelligenceAnalysisForm';
import { apiClient, ApiError } from '../lib/api-client';
import { streamSse } from '../lib/sse';

jest.mock('../lib/api-client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

jest.mock('../lib/sse', () => ({ streamSse: jest.fn() }));

/** Builds the async generator streamSse() returns, for mocking in tests. */
async function* fakeSseStream(
  events: { event?: string; data: string }[],
): AsyncGenerator<{ event?: string; data: string }, void, void> {
  for (const evt of events) {
    yield evt;
  }
}

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
    (apiClient.get as jest.Mock).mockReset().mockResolvedValue({ available: false });
  });

  it('submits the qualitative fields to POST /incidents/:id/analyze and passes the flat persisted response straight through', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
      tenantId: 't1',
      incidentId: 'incident-1',
      situationSummary: 'Payments API returning 500s.',
      businessImpact: {
        level: 'MEDIUM',
        description: 'Checkout degraded for all customers.',
        affectedSystems: [],
      },
      criticalRisks: [],
      conflictingInformation: [],
      recommendedDecision: {
        label: 'Roll back deploy',
        description: 'Revert to previous stable release.',
      },
      alternativeDecisions: [],
      expectedConsequences: 'Brief downtime, then recovery.',
      immediateNextActions: [],
      executiveSummary: 'Recommend immediate rollback.',
      evidenceUsed: ['ev-1'],
      missingInformation: [],
      evidenceCompleteness: 60,
      sourceReliability: 80,
      dataFreshness: 90,
      aiCertainty: 55,
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
  });

  it('shows the backend error message and does not call onCreated when submission fails', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(
      new ApiError(400, 'situationSummary must not be empty'),
    );

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

describe('IntelligenceAnalysisForm — AI drafting (ADR-0018, streamed live per ADR-0020)', () => {
  const VALID_DRAFT = {
    situationSummary: 'Payments API returning elevated 5xx rates.',
    businessImpact: {
      level: 'HIGH',
      description: 'Checkout failures for a subset of customers.',
      affectedSystems: ['payments-api', 'checkout-web'],
    },
    criticalRisks: [{ description: 'Revenue loss', likelihood: 'HIGH', impact: 'HIGH' }],
    conflictingInformation: [],
    recommendedDecision: { label: 'Roll back', description: 'Roll back the 11:35 deploy.' },
    alternativeDecisions: [],
    expectedConsequences: 'Brief additional downtime, then recovery.',
    immediateNextActions: ['Page on-call'],
    executiveSummary: 'Recommend rollback.',
  };

  beforeEach(() => {
    (apiClient.post as jest.Mock).mockReset();
    (apiClient.get as jest.Mock).mockReset();
    (streamSse as jest.Mock).mockReset();
  });

  it('does not show a "Draft with AI" button when AI drafting is unavailable', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ available: false });

    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={jest.fn()} />);

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/decision-intelligence/ai-status'),
    );
    expect(screen.queryByRole('button', { name: /draft with ai/i })).not.toBeInTheDocument();
  });

  it('pre-fills every field from the final streamed result, without touching confidence dimensions', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ available: true });
    (streamSse as jest.Mock).mockReturnValue(
      fakeSseStream([
        { data: '{"situationSummary": "Payments API..."' },
        { event: 'result', data: JSON.stringify(VALID_DRAFT) },
      ]),
    );

    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={jest.fn()} />);

    const draftButton = await screen.findByRole('button', { name: /draft with ai/i });
    fireEvent.click(draftButton);

    expect(streamSse).toHaveBeenCalledWith('/incidents/incident-1/analyze/draft/stream');
    expect(await screen.findByText(/generated by ai/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/situation summary/i)).toHaveValue(
      'Payments API returning elevated 5xx rates.',
    );
    expect(screen.getByLabelText(/recommended decision label/i)).toHaveValue('Roll back');
    expect(screen.getByLabelText(/affected systems/i)).toHaveValue('payments-api, checkout-web');
  });

  it('shows the raw model text live as it streams in, before the result event resolves it into form fields', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ available: true });
    let releaseResult: () => void = () => {};
    const resultGate = new Promise<void>((resolve) => {
      releaseResult = resolve;
    });

    async function* controlledStream(): AsyncGenerator<
      { event?: string; data: string },
      void,
      void
    > {
      yield { data: 'Reading incident evidence and drafting…' };
      await resultGate;
      yield { event: 'result', data: JSON.stringify(VALID_DRAFT) };
    }
    (streamSse as jest.Mock).mockReturnValue(controlledStream());

    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={jest.fn()} />);
    const draftButton = await screen.findByRole('button', { name: /draft with ai/i });
    fireEvent.click(draftButton);

    // The raw stream is visible while still in progress — the form hasn't populated yet.
    expect(await screen.findByText(/Reading incident evidence and drafting…/)).toBeInTheDocument();
    expect(screen.getByLabelText(/situation summary/i)).toHaveValue('');

    releaseResult();

    expect(await screen.findByText(/generated by ai/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/situation summary/i)).toHaveValue(
      'Payments API returning elevated 5xx rates.',
    );
  });

  it('shows the server-sent error message when the stream reports one mid-generation', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ available: true });
    (streamSse as jest.Mock).mockReturnValue(
      fakeSseStream([
        { data: 'partial...' },
        { event: 'error', data: "The AI model's draft did not match the required shape" },
      ]),
    );

    render(<IntelligenceAnalysisForm incidentId="incident-1" onCreated={jest.fn()} />);

    const draftButton = await screen.findByRole('button', { name: /draft with ai/i });
    fireEvent.click(draftButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The AI model's draft did not match the required shape",
    );
    expect(screen.getByLabelText(/situation summary/i)).toHaveValue('');
  });
});
