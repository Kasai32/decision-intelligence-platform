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
