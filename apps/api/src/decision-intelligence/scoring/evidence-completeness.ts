import { EvidenceSourceCategory, IncidentType } from '@prisma/client';

/**
 * Which evidence source categories are required to consider an incident's
 * evidence "complete" for its type (see ADR-0010). OTHER requires nothing —
 * an unclassified incident is never penalized for a checklist that doesn't
 * apply to it.
 */
export const REQUIRED_EVIDENCE_SOURCES: Record<IncidentType, EvidenceSourceCategory[]> = {
  [IncidentType.CLOUD_OUTAGE]: [
    EvidenceSourceCategory.MONITORING,
    EvidenceSourceCategory.CLOUD_PROVIDER,
  ],
  [IncidentType.SECURITY_BREACH]: [
    EvidenceSourceCategory.MONITORING,
    EvidenceSourceCategory.LOG_AGGREGATOR,
    EvidenceSourceCategory.HUMAN,
  ],
  [IncidentType.DATA_LOSS]: [
    EvidenceSourceCategory.LOG_AGGREGATOR,
    EvidenceSourceCategory.CLOUD_PROVIDER,
  ],
  [IncidentType.PERFORMANCE_DEGRADATION]: [
    EvidenceSourceCategory.MONITORING,
    EvidenceSourceCategory.LOG_AGGREGATOR,
  ],
  [IncidentType.OTHER]: [],
};

/**
 * Ratio of required evidence source categories actually present, as a
 * percentage (0-100). Example from ADR-0010: CLOUD_OUTAGE requires
 * [MONITORING, CLOUD_PROVIDER] — if only one is present, this returns 50.
 */
export function computeEvidenceCompleteness(
  incidentType: IncidentType,
  presentCategories: EvidenceSourceCategory[],
): number {
  const required = REQUIRED_EVIDENCE_SOURCES[incidentType];
  if (required.length === 0) {
    return 100;
  }

  const present = new Set(presentCategories);
  const satisfied = required.filter((category) => present.has(category)).length;
  return Math.round((satisfied / required.length) * 100);
}
