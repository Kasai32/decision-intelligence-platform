// Domain types shared between apps/api and apps/web. Kept as plain string-literal
// unions / interfaces (not imported from @prisma/client) so this package has no
// dependency on Prisma or the api workspace — see ADR-0006.

export type IncidentStatus = 'OPEN' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DecisionStatus = 'OPEN' | 'DECIDED' | 'CANCELLED';

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Decision {
  id: string;
  tenantId: string;
  incidentId: string;
  question: string;
  status: DecisionStatus;
  humanDecision: string | null;
  rationale: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by GET /incidents/:id/command-center — see ADR-0009. */
export interface CommandCenterSummary {
  incident: Incident;
  openDecision: Decision | null;
  lastDecision: Decision | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
