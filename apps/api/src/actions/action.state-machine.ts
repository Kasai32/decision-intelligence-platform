import { ActionStatus } from '@prisma/client';
import { TransitionMap } from '../common/state-machine/state-machine';

export const ACTION_TRANSITIONS: TransitionMap<ActionStatus> = {
  [ActionStatus.PENDING]: [ActionStatus.IN_PROGRESS, ActionStatus.CANCELLED],
  [ActionStatus.IN_PROGRESS]: [ActionStatus.DONE, ActionStatus.CANCELLED],
  [ActionStatus.DONE]: [],
  [ActionStatus.CANCELLED]: [],
};
