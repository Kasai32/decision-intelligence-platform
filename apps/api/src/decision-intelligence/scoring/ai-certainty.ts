/**
 * IMPORTANT (see ADR-0010): this is a deterministic HEURISTIC based on
 * countable facts about the evidence attached to an incident — evidence
 * volume, source diversity, and flagged contradictions. It is NOT the
 * output of a trained model or a comparison against a historical corpus;
 * this platform has neither yet. Every input is independently auditable
 * by a human re-counting the same evidence. When a real pattern-matching
 * capability exists, only this function's internals should need to change.
 */

const MAX_EVIDENCE_VOLUME_CONTRIBUTION = 70;
const EVIDENCE_VOLUME_WEIGHT = 15;

const MAX_DIVERSITY_CONTRIBUTION = 20;
const DIVERSITY_WEIGHT = 7;

const CONFLICT_PENALTY_WEIGHT = 15;

export function computeAiCertainty(
  evidenceCount: number,
  uniqueSourceCategoryCount: number,
  conflictCount: number,
): number {
  const volumeContribution = Math.min(
    MAX_EVIDENCE_VOLUME_CONTRIBUTION,
    evidenceCount * EVIDENCE_VOLUME_WEIGHT,
  );
  const diversityContribution = Math.min(
    MAX_DIVERSITY_CONTRIBUTION,
    uniqueSourceCategoryCount * DIVERSITY_WEIGHT,
  );
  const conflictPenalty = conflictCount * CONFLICT_PENALTY_WEIGHT;

  const raw = volumeContribution + diversityContribution - conflictPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** The auditable "show your work" trace behind an aiCertainty score — see ADR-0019. */
export interface AiCertaintyBreakdown {
  evidenceCount: number;
  uniqueSourceCategoryCount: number;
  conflictCount: number;
  volumeContribution: number;
  diversityContribution: number;
  conflictPenalty: number;
  score: number;
}

/** Same computation as computeAiCertainty, plus every intermediate term — see ADR-0019. */
export function explainAiCertainty(
  evidenceCount: number,
  uniqueSourceCategoryCount: number,
  conflictCount: number,
): AiCertaintyBreakdown {
  const volumeContribution = Math.min(
    MAX_EVIDENCE_VOLUME_CONTRIBUTION,
    evidenceCount * EVIDENCE_VOLUME_WEIGHT,
  );
  const diversityContribution = Math.min(
    MAX_DIVERSITY_CONTRIBUTION,
    uniqueSourceCategoryCount * DIVERSITY_WEIGHT,
  );
  const conflictPenalty = conflictCount * CONFLICT_PENALTY_WEIGHT;

  return {
    evidenceCount,
    uniqueSourceCategoryCount,
    conflictCount,
    volumeContribution,
    diversityContribution,
    conflictPenalty,
    score: computeAiCertainty(evidenceCount, uniqueSourceCategoryCount, conflictCount),
  };
}
