import { IncidentStatus } from '@prisma/client';
import { TransitionMap } from '../common/state-machine/state-machine';

/** Linear lifecycle, no skipping and no going backward (see ADR-0007). */
export const INCIDENT_TRANSITIONS: TransitionMap<IncidentStatus> = {
  [IncidentStatus.OPEN]: [IncidentStatus.MITIGATED],
  [IncidentStatus.MITIGATED]: [IncidentStatus.RESOLVED],
  [IncidentStatus.RESOLVED]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
};
