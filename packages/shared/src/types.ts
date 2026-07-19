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

/** Shape returned by GET /incidents/:id/command-center — see ADR-0009 (amended by ADR-0013). */
export interface CommandCenterSummary {
  incident: Incident;
  openDecisions: Decision[];
  lastDecision: Decision | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** See ADR-0013 — user validation test scenarios. */
export type SimulationScenario = 'CYBER_RANSOMWARE' | 'CLOUD_OUTAGE_PARTIAL_EVIDENCE';

export type TimelineEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_STATUS_CHANGED'
  | 'DECISION_OPENED'
  | 'DECISION_DECIDED'
  | 'DECISION_CANCELLED'
  | 'EVIDENCE_ADDED'
  | 'ACTION_CREATED'
  | 'ACTION_STATUS_CHANGED'
  | 'INTELLIGENCE_ANALYSIS_GENERATED'
  | 'EXECUTIVE_BRIEF_GENERATED'
  | 'DECISION_REPORT_GENERATED'
  | 'LESSON_LEARNED_CREATED'
  | 'INTEGRATION_BLOCKED';

/**
 * Shape returned by GET /incidents/:id/timeline — the immutable audit trail
 * (see ADR-0006). Type-only addition for the Decision Log UI (ADR-0014); no
 * backend change.
 */
export interface TimelineEvent {
  id: string;
  tenantId: string;
  incidentId: string;
  decisionId: string | null;
  type: TimelineEventType;
  description: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}
