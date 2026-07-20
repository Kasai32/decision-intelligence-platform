import { render, screen, waitFor } from '@testing-library/react';
import type { TimelineEvent } from '@dip/shared';
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

const timeline: TimelineEvent[] = [
  {
    id: 'e1',
    tenantId: 't1',
    incidentId: 'incident-1',
    decisionId: null,
    type: 'INCIDENT_CREATED',
    description: 'Incident "Payments outage" created',
    actorUserId: 'u1',
    metadata: null,
    occurredAt: '2026-07-19T12:00:00.000Z',
  },
  {
    id: 'e2',
    tenantId: 't1',
    incidentId: 'incident-1',
    decisionId: 'decision-1',
    type: 'DECISION_OPENED',
    description: 'Decision opened: "Roll back the deploy?"',
    actorUserId: 'u1',
    metadata: null,
    occurredAt: '2026-07-19T12:01:00.000Z',
  },
];

describe('ReportsPanel (derives decisions from the timeline — no new list-decisions endpoint)', () => {
  beforeEach(() => {
    (apiClient.get as jest.Mock).mockImplementation((path: string) =>
      path.endsWith('/outcome')
        ? Promise.reject(new ApiError(404, 'No outcome recorded for this decision'))
        : Promise.resolve([]),
    );
  });

  it('extracts the decision question from the DECISION_OPENED event description', async () => {
    render(<ReportsPanel incidentId="incident-1" incidentStatus="OPEN" timeline={timeline} />);

    expect(await screen.findAllByText('Roll back the deploy?')).toHaveLength(2); // Decision Reports panel + Decision Outcomes panel
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/decisions/decision-1/reports');
    });
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/decisions/decision-1/outcome');
    });
  });
});
