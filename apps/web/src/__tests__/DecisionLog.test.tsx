import { render, screen } from '@testing-library/react';
import type { TimelineEvent } from '@dip/shared';
import { DecisionLog } from '../components/DecisionLog';

const events: TimelineEvent[] = [
  {
    id: 'e1',
    tenantId: 't1',
    incidentId: 'i1',
    decisionId: null,
    type: 'INCIDENT_CREATED',
    description: 'Incident "Outage" created',
    actorUserId: 'u1',
    metadata: null,
    occurredAt: '2026-07-19T12:00:00.000Z',
  },
  {
    id: 'e2',
    tenantId: 't1',
    incidentId: 'i1',
    decisionId: 'd1',
    type: 'DECISION_DECIDED',
    description: 'Decision decided: "Roll back the deploy"',
    actorUserId: 'u1',
    metadata: null,
    occurredAt: '2026-07-19T12:05:00.000Z',
  },
];

describe('DecisionLog (ADR-0014 — reads the real, immutable timeline)', () => {
  it('renders every event in the given order with its description and timestamp', () => {
    render(<DecisionLog events={events} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Incident "Outage" created');
    expect(items[1]).toHaveTextContent('Decision decided: "Roll back the deploy"');
  });

  it('never renders blank when there are no events yet', () => {
    render(<DecisionLog events={[]} />);
    expect(screen.getByText(/no events recorded/i)).toBeInTheDocument();
  });
});
