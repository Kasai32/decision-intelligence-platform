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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const secondOpenDecision: Decision = {
  ...openDecision,
  id: 'd3',
  question: 'Do we notify customers publicly?',
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

describe('IncidentDecisionPanel — North Star / no-blank-state contract (ADR-0009, amended by ADR-0013/ADR-0014)', () => {
  it('shows the open decision when one exists, even if a past decision also exists', () => {
    render(
      <IncidentDecisionPanel
        openDecisions={[openDecision]}
        lastDecision={decidedDecision}
        severity="HIGH"
      />,
    );
    expect(screen.getByRole('heading', { name: /decision required/i })).toBeInTheDocument();
    expect(screen.getByText(openDecision.question)).toBeInTheDocument();
  });

  it('shows ALL open decisions when several are simultaneously open (see ADR-0013), each with a live SLA countdown (ADR-0014)', () => {
    render(
      <IncidentDecisionPanel
        openDecisions={[openDecision, secondOpenDecision]}
        lastDecision={null}
        severity="CRITICAL"
      />,
    );
    expect(screen.getByRole('heading', { name: /2 decisions required/i })).toBeInTheDocument();
    expect(screen.getByText(openDecision.question)).toBeInTheDocument();
    expect(screen.getByText(secondOpenDecision.question)).toBeInTheDocument();
    expect(screen.getAllByRole('timer')).toHaveLength(2);
  });

  it('shows the outcome of the last decided decision when there is no open one', () => {
    render(
      <IncidentDecisionPanel openDecisions={[]} lastDecision={decidedDecision} severity="LOW" />,
    );
    expect(screen.getByRole('heading', { name: /last decision/i })).toBeInTheDocument();
    expect(screen.getByText(decidedDecision.humanDecision as string)).toBeInTheDocument();
  });

  it('never renders a blank panel when there are no decisions at all — shows an explicit empty state', () => {
    const { container } = render(
      <IncidentDecisionPanel openDecisions={[]} lastDecision={null} severity="LOW" />,
    );
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /no decisions recorded/i })).toBeInTheDocument();
  });

  it('exposes a stable data-state attribute per state for future e2e assertions', () => {
    const { rerender, container } = render(
      <IncidentDecisionPanel
        openDecisions={[openDecision]}
        lastDecision={null}
        severity="MEDIUM"
      />,
    );
    expect(container.querySelector('[data-state="open-decision"]')).not.toBeNull();

    rerender(
      <IncidentDecisionPanel openDecisions={[]} lastDecision={decidedDecision} severity="MEDIUM" />,
    );
    expect(container.querySelector('[data-state="last-decision"]')).not.toBeNull();

    rerender(<IncidentDecisionPanel openDecisions={[]} lastDecision={null} severity="MEDIUM" />);
    expect(container.querySelector('[data-state="empty"]')).not.toBeNull();
  });
});
