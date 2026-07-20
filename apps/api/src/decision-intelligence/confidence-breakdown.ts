import { EvidenceSourceCategory, IncidentSeverity, IncidentType } from '@prisma/client';
import { AiCertaintyBreakdown, explainAiCertainty } from './scoring/ai-certainty';
import { DataFreshnessBreakdown, explainDataFreshness } from './scoring/data-freshness';
import {
  EvidenceCompletenessBreakdown,
  explainEvidenceCompleteness,
} from './scoring/evidence-completeness';
import { explainSourceReliability, SourceReliabilityBreakdown } from './scoring/source-reliability';

export interface EvidenceForBreakdown {
  id: string;
  source: string;
  sourceCategory: EvidenceSourceCategory;
  createdAt: Date;
}

/**
 * The full "show your work" trace behind every confidence dimension — see
 * ADR-0019. Always computed fresh from real, immutable inputs (the
 * incident's type/severity, the exact evidence rows referenced by an
 * analysis's `evidenceUsed`), never persisted as its own column: the
 * underlying facts never change, so there is nothing to cache and no risk
 * of drift between a stored breakdown and a stored score.
 */
export interface ConfidenceBreakdown {
  evidenceCompleteness: EvidenceCompletenessBreakdown;
  sourceReliability: SourceReliabilityBreakdown;
  dataFreshness: DataFreshnessBreakdown;
  aiCertainty: AiCertaintyBreakdown;
}

/**
 * Builds the breakdown for one confidence dimension set. `now` must be the
 * exact instant the corresponding scores were (or would be) persisted —
 * `analyze()` passes the live "now" it's about to persist with; `list()`
 * passes each analysis's own frozen `createdAt`, so a freshness score
 * shown for an old analysis always matches what was actually stored,
 * never a live-recomputed (and therefore silently different) number.
 */
export function buildConfidenceBreakdown(
  incidentType: IncidentType,
  severity: IncidentSeverity,
  evidence: EvidenceForBreakdown[],
  conflictCount: number,
  now: Date,
): ConfidenceBreakdown {
  const presentCategories = evidence.map((item) => item.sourceCategory);
  const uniqueCategoryCount = new Set(presentCategories).size;

  return {
    evidenceCompleteness: explainEvidenceCompleteness(incidentType, presentCategories),
    sourceReliability: explainSourceReliability(evidence),
    dataFreshness: explainDataFreshness(evidence, severity, now),
    aiCertainty: explainAiCertainty(evidence.length, uniqueCategoryCount, conflictCount),
  };
}
