import { render, screen } from '@testing-library/react';
import type { IntelligenceAnalysis } from '@dip/shared';
import { IntelligenceAnalysisPanel } from '../components/IntelligenceAnalysisPanel';

const analysis: IntelligenceAnalysis = {
  id: 'analysis-1',
  tenantId: 't1',
  incidentId: 'incident-1',
  situationSummary: 'Payments API returning 500s for 12 minutes.',
  businessImpact: {
    level: 'HIGH',
    description: 'Checkout is degraded for all customers.',
    affectedSystems: ['payments-api', 'checkout-web'],
  },
  criticalRisks: [
    { description: 'Revenue loss during peak hours', likelihood: 'HIGH', impact: 'HIGH' },
  ],
  conflictingInformation: ['Datadog shows recovery; PagerDuty still open'],
  recommendedDecision: {
    label: 'Roll back deploy',
    description: 'Revert to previous stable release.',
  },
  alternativeDecisions: [
    { label: 'Scale up', description: 'Add replicas instead of rolling back.' },
  ],
  expectedConsequences: 'Brief downtime during rollback, then recovery.',
  immediateNextActions: ['Page on-call SRE', 'Notify status page'],
  executiveSummary: 'Recommend immediate rollback — high confidence, evidence-backed.',
  evidenceUsed: ['ev-1', 'ev-2'],
  missingInformation: ['Missing evidence source: LOG_AGGREGATOR'],
  evidenceCompleteness: 60,
  sourceReliability: 80,
  dataFreshness: 90,
  aiCertainty: 55,
  confidenceBreakdown: {
    evidenceCompleteness: {
      requiredSources: ['MONITORING', 'LOG_AGGREGATOR', 'HUMAN'],
      presentRequiredSources: ['MONITORING', 'LOG_AGGREGATOR'],
      missingRequiredSources: ['HUMAN'],
      score: 67,
    },
    sourceReliability: {
      perEvidence: [
        { evidenceId: 'ev-1', source: 'Datadog', sourceCategory: 'MONITORING', reliability: 90 },
        {
          evidenceId: 'ev-2',
          source: 'CloudWatch',
          sourceCategory: 'LOG_AGGREGATOR',
          reliability: 85,
        },
      ],
      score: 88,
    },
    dataFreshness: {
      mostRecentEvidenceId: 'ev-2',
      mostRecentEvidenceAt: '2026-07-19T11:52:00.000Z',
      minutesSinceMostRecent: 8,
      severity: 'HIGH',
      degradationFactorPerMinute: 2,
      score: 84,
    },
    aiCertainty: {
      evidenceCount: 2,
      uniqueSourceCategoryCount: 2,
      conflictCount: 1,
      volumeContribution: 30,
      diversityContribution: 14,
      conflictPenalty: 15,
      score: 29,
    },
  },
  submittedByUserId: 'user-1',
  createdAt: '2026-07-19T12:00:00.000Z',
};

describe('IntelligenceAnalysisPanel (ADR-0010 — Decision Intelligence Engine)', () => {
  it('shows an explicit empty state instead of rendering nothing', () => {
    render(<IntelligenceAnalysisPanel analyses={[]} />);
    expect(screen.getByText(/no intelligence analysis recorded yet/i)).toBeInTheDocument();
  });

  it('renders all four confidence dimensions as separate values, never merged into one score', () => {
    render(<IntelligenceAnalysisPanel analyses={[analysis]} />);
    expect(screen.getByRole('progressbar', { name: /evidence completeness/i })).toHaveAttribute(
      'aria-valuenow',
      '60',
    );
    expect(screen.getByRole('progressbar', { name: /source reliability/i })).toHaveAttribute(
      'aria-valuenow',
      '80',
    );
    expect(screen.getByRole('progressbar', { name: /data freshness/i })).toHaveAttribute(
      'aria-valuenow',
      '90',
    );
    expect(screen.getByRole('progressbar', { name: /ai certainty/i })).toHaveAttribute(
      'aria-valuenow',
      '55',
    );
  });

  it('always surfaces missing information, never hides it by omission (Principle 3)', () => {
    render(<IntelligenceAnalysisPanel analyses={[analysis]} />);
    expect(screen.getByText('Missing evidence source: LOG_AGGREGATOR')).toBeInTheDocument();
  });

  it('renders business impact, risks, and recommended decision', () => {
    render(<IntelligenceAnalysisPanel analyses={[analysis]} />);
    expect(screen.getByText('Checkout is degraded for all customers.')).toBeInTheDocument();
    expect(screen.getByText('payments-api')).toBeInTheDocument();
    expect(screen.getByText('Revenue loss during peak hours')).toBeInTheDocument();
    expect(screen.getByText('Roll back deploy')).toBeInTheDocument();
  });

  it('never shows a confidence score as a bare unexplained number — every dimension has a "Why this score?" trace (ADR-0019)', () => {
    render(<IntelligenceAnalysisPanel analyses={[analysis]} />);

    const disclosures = screen.getAllByText(/why this score\?/i);
    expect(disclosures).toHaveLength(4);

    // Evidence completeness: names exactly which required sources are present/missing.
    expect(screen.getByText(/Monitoring, Log aggregator/)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 required sources present/)).toBeInTheDocument();

    // Source reliability: shows each contributing evidence item by name.
    expect(screen.getByText(/Datadog \(Monitoring\)/)).toBeInTheDocument();
    expect(screen.getByText(/CloudWatch \(Log aggregator\)/)).toBeInTheDocument();

    // Data freshness: shows the actual elapsed time and decay formula.
    expect(screen.getByText(/100 − 8 × 2 = 84%/)).toBeInTheDocument();

    // AI certainty: shows the volume/diversity/conflict terms, not just the final number.
    expect(screen.getByText(/minus 15 for 1 flagged conflict\(s\)/)).toBeInTheDocument();
  });
});
