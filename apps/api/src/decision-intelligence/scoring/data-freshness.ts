import { IncidentSeverity } from '@prisma/client';

/**
 * Degradation factor `k` in `freshness = max(0, 100 - Δt × k)` (Δt in
 * minutes) — see ADR-0010. Higher severity degrades faster: a CRITICAL
 * incident's information goes stale in ~20 minutes, a LOW one over hours.
 */
export const FRESHNESS_DEGRADATION_FACTOR: Record<IncidentSeverity, number> = {
  [IncidentSeverity.CRITICAL]: 5,
  [IncidentSeverity.HIGH]: 2,
  [IncidentSeverity.MEDIUM]: 1,
  [IncidentSeverity.LOW]: 0.3,
};

export interface FreshnessEvidenceInput {
  createdAt: Date;
}

/**
 * Freshness of the most recent evidence, as a percentage (0-100). `now` is
 * an explicit parameter (not read from the system clock internally) so
 * decay is exactly reproducible in tests — see ADR-0010 for why "most
 * recent evidence" is the chosen interpretation of "most critical evidence".
 */
export function computeDataFreshness(
  evidence: FreshnessEvidenceInput[],
  severity: IncidentSeverity,
  now: Date = new Date(),
): number {
  if (evidence.length === 0) {
    return 0;
  }

  const mostRecent = evidence.reduce((latest, item) =>
    item.createdAt > latest.createdAt ? item : latest,
  );
  const deltaMinutes = (now.getTime() - mostRecent.createdAt.getTime()) / 60_000;
  const k = FRESHNESS_DEGRADATION_FACTOR[severity];

  return Math.max(0, Math.round(100 - deltaMinutes * k));
}

export interface FreshnessEvidenceIdentifiedInput extends FreshnessEvidenceInput {
  id: string;
}

/** The auditable "show your work" trace behind a dataFreshness score — see ADR-0019. */
export interface DataFreshnessBreakdown {
  mostRecentEvidenceId: string | null;
  mostRecentEvidenceAt: string | null;
  minutesSinceMostRecent: number | null;
  severity: IncidentSeverity;
  degradationFactorPerMinute: number;
  score: number;
}

/** Same computation as computeDataFreshness, plus which evidence and how much time decayed the score — see ADR-0019. */
export function explainDataFreshness(
  evidence: FreshnessEvidenceIdentifiedInput[],
  severity: IncidentSeverity,
  now: Date = new Date(),
): DataFreshnessBreakdown {
  const k = FRESHNESS_DEGRADATION_FACTOR[severity];
  if (evidence.length === 0) {
    return {
      mostRecentEvidenceId: null,
      mostRecentEvidenceAt: null,
      minutesSinceMostRecent: null,
      severity,
      degradationFactorPerMinute: k,
      score: 0,
    };
  }

  const mostRecent = evidence.reduce((latest, item) =>
    item.createdAt > latest.createdAt ? item : latest,
  );
  const minutesSinceMostRecent = (now.getTime() - mostRecent.createdAt.getTime()) / 60_000;

  return {
    mostRecentEvidenceId: mostRecent.id,
    mostRecentEvidenceAt: mostRecent.createdAt.toISOString(),
    minutesSinceMostRecent: Math.round(minutesSinceMostRecent),
    severity,
    degradationFactorPerMinute: k,
    score: computeDataFreshness(evidence, severity, now),
  };
}
