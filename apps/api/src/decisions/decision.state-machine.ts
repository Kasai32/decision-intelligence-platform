import { DecisionStatus } from '@prisma/client';
import { TransitionMap } from '../common/state-machine/state-machine';

/**
 * OPEN -> DECIDED requires the additional Principle-1 human-stakeholder
 * check performed in DecisionsService.decide() (see ADR-0007) — this map
 * only encodes which transitions are structurally legal.
 */
export const DECISION_TRANSITIONS: TransitionMap<DecisionStatus> = {
  [DecisionStatus.OPEN]: [DecisionStatus.DECIDED, DecisionStatus.CANCELLED],
  [DecisionStatus.DECIDED]: [],
  [DecisionStatus.CANCELLED]: [],
};
