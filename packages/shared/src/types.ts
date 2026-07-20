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
  | 'INTEGRATION_BLOCKED'
  | 'DECISION_OUTCOME_RECORDED';

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

// ---------------------------------------------------------------------------
// Decision Intelligence Engine (Phase 4, ADR-0010) — type-only additions for
// the frontend surface; mirrors apps/api's AIOutputContractDto / Prisma
// IntelligenceAnalysis model. No backend change.
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Risk {
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
}

export interface BusinessImpact {
  level: IncidentSeverity;
  description: string;
  affectedSystems: string[];
}

/** A candidate decision option — used for both recommendedDecision and alternativeDecisions. */
export interface DecisionOption {
  label: string;
  description: string;
  pros?: string[];
  cons?: string[];
}

/** The four independent confidence dimensions (see ADR-0010) — never merged into a single score. */
export interface ConfidenceDimensions {
  evidenceCompleteness: number;
  sourceReliability: number;
  dataFreshness: number;
  aiCertainty: number;
}

/** The qualitative fields a caller supplies to POST /incidents/:id/analyze — see SubmitIntelligenceAnalysisDto. */
export interface SubmitIntelligenceAnalysisInput {
  situationSummary: string;
  businessImpact: BusinessImpact;
  criticalRisks: Risk[];
  conflictingInformation: string[];
  recommendedDecision: DecisionOption;
  alternativeDecisions: DecisionOption[];
  expectedConsequences: string;
  immediateNextActions: string[];
  executiveSummary: string;
}

/**
 * The persisted shape both POST /incidents/:id/analyze and
 * GET /incidents/:id/analyses return — mirrors the Prisma
 * `IntelligenceAnalysis` model directly, so the four confidence dimensions
 * are flat columns here (`evidenceCompleteness` etc.), not a nested
 * `confidenceDimensions` object. (The two endpoints used to disagree on
 * this — POST returned the nested AI Output Contract shape — fixed
 * 2026-07-20, see DECISION_LOG.md.)
 */
export interface IntelligenceAnalysis extends SubmitIntelligenceAnalysisInput {
  id: string;
  tenantId: string;
  incidentId: string;
  evidenceUsed: string[];
  missingInformation: string[];
  evidenceCompleteness: number;
  sourceReliability: number;
  dataFreshness: number;
  aiCertainty: number;
  submittedByUserId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reporting (Phase 5, ADR-0011) — type-only additions for the frontend
// surface; mirrors apps/api's Prisma models. No backend change.
// ---------------------------------------------------------------------------

export interface ExecutiveBriefKeyDecision {
  id: string;
  question: string;
  status: DecisionStatus;
  humanDecision: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
}

export interface ExecutiveBriefNextAction {
  id: string;
  title: string;
  status: string;
  assignedToUserId: string | null;
  dueAt: string | null;
}

/** Immutable, point-in-time snapshot generated by POST /incidents/:id/executive-brief — see ADR-0011. */
export interface ExecutiveBrief {
  id: string;
  tenantId: string;
  incidentId: string;
  title: string;
  incidentStatus: IncidentStatus;
  incidentSeverity: IncidentSeverity;
  summary: string;
  businessImpact: BusinessImpact | null;
  keyDecisions: ExecutiveBriefKeyDecision[];
  openRisks: Risk[];
  nextActions: ExecutiveBriefNextAction[];
  additionalNotes: string | null;
  generatedByUserId: string;
  generatedAt: string;
}

export interface DecisionReportEvidenceItem {
  id: string;
  type: string;
  sourceCategory: string;
  source: string;
  summary: string;
}

export interface DecisionReportTimelineItem {
  type: TimelineEventType;
  description: string;
  occurredAt: string;
}

/** Immutable, point-in-time snapshot of a single decision — see ADR-0011. */
export interface DecisionReport {
  id: string;
  tenantId: string;
  decisionId: string;
  incidentId: string;
  question: string;
  status: DecisionStatus;
  humanDecision: string | null;
  rationale: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  evidenceSummary: DecisionReportEvidenceItem[];
  timelineSummary: DecisionReportTimelineItem[];
  additionalNotes: string | null;
  generatedByUserId: string;
  generatedAt: string;
}

/**
 * A human-authored retrospective — see ADR-0011. Only creatable for a
 * CLOSED incident; the entire content is human judgment, never computed.
 */
export interface LessonLearned {
  id: string;
  tenantId: string;
  incidentId: string;
  title: string;
  whatHappened: string;
  whatWentWell: string[];
  whatToImprove: string[];
  actionItems: string[];
  tags: string[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Enterprise Integrations (Phase 6, ADR-0012) — type-only additions for the
// frontend surface; mirrors apps/api's Prisma enums / IntegrationStatusSummary.
// No backend change.
// ---------------------------------------------------------------------------

/** The ten Phase 6 enterprise systems — see ADR-0008 / ADR-0012. */
export type IntegrationKey =
  | 'SERVICENOW'
  | 'JIRA'
  | 'SLACK'
  | 'TEAMS'
  | 'AWS'
  | 'AZURE'
  | 'GCP'
  | 'SPLUNK'
  | 'DATADOG'
  | 'MICROSOFT_SENTINEL';

export type IntegrationConfigStatus = 'ACTIVE' | 'BROKEN';

/** Shape returned by GET /integrations and every /integrations/:providerType/config mutation — see ADR-0012. */
export interface IntegrationStatusSummary {
  providerType: IntegrationKey;
  displayName: string;
  configured: boolean;
  status: IntegrationConfigStatus | 'NOT_CONFIGURED';
  circuitState: string;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Decision outcome calibration (see ADR-0016) — type-only additions for the
// frontend surface. No backend change.
// ---------------------------------------------------------------------------

export type DecisionOutcomeQuality = 'GOOD' | 'BAD' | 'MIXED' | 'UNKNOWN';

/**
 * A human's retrospective judgment of whether a DECIDED decision turned out
 * well — see ADR-0016. Only recordable once the incident is CLOSED, exactly
 * one per decision. `intelligenceAnalysisId` is always server-computed
 * (whichever analysis existed at decision time, if any), never supplied.
 */
export interface DecisionOutcome {
  id: string;
  tenantId: string;
  decisionId: string;
  intelligenceAnalysisId: string | null;
  outcomeQuality: DecisionOutcomeQuality;
  notes: string | null;
  recordedByUserId: string;
  recordedAt: string;
}

export type CalibrationDimension =
  'evidenceCompleteness' | 'sourceReliability' | 'dataFreshness' | 'aiCertainty';

/** One confidence dimension's real, computed relationship to human-attested outcomes — see ADR-0016. */
export interface DimensionCalibration {
  dimension: CalibrationDimension;
  goodSampleSize: number;
  badSampleSize: number;
  meanWhenGood: number | null;
  meanWhenBad: number | null;
  meanDifference: number | null;
  sufficientData: boolean;
}

/** Shape returned by GET /decision-intelligence/calibration-report — see ADR-0016. */
export interface CalibrationReport {
  totalLabeledOutcomes: number;
  minimumSampleSizeThreshold: number;
  dimensions: DimensionCalibration[];
}
