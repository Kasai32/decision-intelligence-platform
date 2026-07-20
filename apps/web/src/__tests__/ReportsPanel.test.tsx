import { render, screen, waitFor } from '@testing-library/react';
import type { Decision } from '@dip/shared';
import { ReportsPanel } from '../components/ReportsPanel';
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

const decisions: Decision[] = [
  {
    id: 'decision-1',
    tenantId: 't1',
    incidentId: 'incident-1',
    question: 'Roll back the deploy?',
    status: 'OPEN',
    humanDecision: null,
    rationale: null,
    decidedByUserId: null,
    decidedAt: null,
    createdByUserId: 'u1',
    createdAt: '2026-07-19T12:01:00.000Z',
    updatedAt: '2026-07-19T12:01:00.000Z',
  },
];

describe('ReportsPanel (fetches decisions from GET /incidents/:id/decisions)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/incidents/incident-1/decisions') return Promise.resolve(decisions);
      if (path.endsWith('/outcome')) {
        return Promise.reject(new ApiError(404, 'No outcome recorded for this decision'));
      }
      return Promise.resolve([]);
    });
  });

  it('fetches decisions for the incident and passes them to the child panels', async () => {
    render(<ReportsPanel incidentId="incident-1" incidentStatus="OPEN" />);

    expect(await screen.findAllByText('Roll back the deploy?')).toHaveLength(2); // Decision Reports panel + Decision Outcomes panel
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/incidents/incident-1/decisions');
    });
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/decisions/decision-1/reports');
    });
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/decisions/decision-1/outcome');
    });
  });
});
