import { EvidenceSourceCategory } from '@prisma/client';

/**
 * Intrinsic reliability per evidence source category (see ADR-0010), e.g.
 * an immutable cloud-provider log (CloudTrail-like) is far more reliable
 * than an unverified chat message. A static, explicit, auditable table —
 * not a learned weighting.
 */
export const RELIABILITY_BY_SOURCE_CATEGORY: Record<EvidenceSourceCategory, number> = {
  [EvidenceSourceCategory.CLOUD_PROVIDER]: 95,
  [EvidenceSourceCategory.MONITORING]: 90,
  [EvidenceSourceCategory.LOG_AGGREGATOR]: 85,
  [EvidenceSourceCategory.TICKETING]: 70,
  [EvidenceSourceCategory.HUMAN]: 60,
  [EvidenceSourceCategory.CHAT]: 40,
  [EvidenceSourceCategory.OTHER]: 50,
};

/**
 * Mean intrinsic reliability across all evidence linked to the incident
 * (see ADR-0010: "sum divided by count"). No evidence -> 0, an honest
 * absence, not a fabricated default.
 */
export function computeSourceReliability(sourceCategories: EvidenceSourceCategory[]): number {
  if (sourceCategories.length === 0) {
    return 0;
  }

  const sum = sourceCategories.reduce(
    (total, category) => total + RELIABILITY_BY_SOURCE_CATEGORY[category],
    0,
  );
  return Math.round(sum / sourceCategories.length);
}
