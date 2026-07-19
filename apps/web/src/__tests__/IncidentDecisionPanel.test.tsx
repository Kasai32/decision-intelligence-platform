import { render, screen } from '@testing-library/react';
import type { Decision } from '@dip/shared';
import { IncidentDecisionPanel } from '../components/IncidentDecisionPanel';

const openDecision: Decision = {
  id: 'd1',
  tenantId: 't1',
  incidentId: 'i1',
  question: 'Do we roll back the deploy?',
  status: 'OPEN',
  humanDecision: null,
  rationale: null,
  decidedByUserId: null,
  decidedAt: null,
  createdByUserId: 'u1',
  createdAt: '2026-07-19T12:00:00.000Z',
  updatedAt: '2026-07-19T12:00:00.000Z',
};

const decidedDecision: Decision = {
  ...openDecision,
  id: 'd2',
  status: 'DECIDED',
  humanDecision: 'We rolled back the deploy at 14:32.',
  rationale: 'Error rate exceeded threshold.',
  decidedByUserId: 'stakeholder-1',
  decidedAt: '2026-07-19T14:32:00.000Z',
};

describe('IncidentDecisionPanel — North Star / no-blank-state contract (ADR-0009)', () => {
  it('shows the open decision when one exists, even if a past decision also exists', () => {
    render(<IncidentDecisionPanel openDecision={openDecision} lastDecision={decidedDecision} />);
    expect(screen.getByRole('heading', { name: /decision required/i })).toBeInTheDocument();
    expect(screen.getByText(openDecision.question)).toBeInTheDocument();
  });

  it('shows the outcome of the last decided decision when there is no open one', () => {
    render(<IncidentDecisionPanel openDecision={null} lastDecision={decidedDecision} />);
    expect(screen.getByRole('heading', { name: /last decision/i })).toBeInTheDocument();
    expect(screen.getByText(decidedDecision.humanDecision as string)).toBeInTheDocument();
  });

  it('never renders a blank panel when there are no decisions at all — shows an explicit empty state', () => {
    const { container } = render(<IncidentDecisionPanel openDecision={null} lastDecision={null} />);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /no decisions recorded/i })).toBeInTheDocument();
  });

  it('exposes a stable data-state attribute per state for future e2e assertions', () => {
    const { rerender, container } = render(
      <IncidentDecisionPanel openDecision={openDecision} lastDecision={null} />,
    );
    expect(container.querySelector('[data-state="open-decision"]')).not.toBeNull();

    rerender(<IncidentDecisionPanel openDecision={null} lastDecision={decidedDecision} />);
    expect(container.querySelector('[data-state="last-decision"]')).not.toBeNull();

    rerender(<IncidentDecisionPanel openDecision={null} lastDecision={null} />);
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
  });
});
