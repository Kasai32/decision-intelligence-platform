import { RelationshipStatus } from '@prisma/client';
import { TransitionMap } from '../common/state-machine/state-machine';

/**
 * SUGGESTED -> CONFIRMED requires the additional evidence-citation check
 * performed in RelationshipsService.confirm() (see ADR-0021) — this map
 * only encodes which transitions are structurally legal. Once CONFIRMED
 * or REJECTED, a relationship is terminal — re-reviewing it means
 * creating a new suggestion, not silently flipping the old one.
 */
export const RELATIONSHIP_TRANSITIONS: TransitionMap<RelationshipStatus> = {
  [RelationshipStatus.SUGGESTED]: [RelationshipStatus.CONFIRMED, RelationshipStatus.REJECTED],
  [RelationshipStatus.CONFIRMED]: [],
  [RelationshipStatus.REJECTED]: [],
};
