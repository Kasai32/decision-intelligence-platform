import { Injectable, Logger } from '@nestjs/common';
import {
  EvidenceSourceCategory,
  EvidenceType,
  Incident,
  IncidentSeverity,
  IncidentType,
  IntegrationKey,
} from '@prisma/client';
import { AIOutputContractDto } from '../decision-intelligence/dto/ai-output-contract.dto';
import { SubmitIntelligenceAnalysisDto } from '../decision-intelligence/dto/submit-intelligence-analysis.dto';
import { DecisionIntelligenceEngineService } from '../decision-intelligence/decision-intelligence-engine.service';
import { DecisionsService } from '../decisions/decisions.service';
import { EvidenceService } from '../evidence/evidence.service';
import { IncidentsService } from '../incidents/incidents.service';
import { IntegrationConfigService } from '../integrations/integration-config.service';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';

export type SimulationScenario = 'CYBER_RANSOMWARE' | 'CLOUD_OUTAGE_PARTIAL_EVIDENCE';

export interface SimulationResult {
  scenario: SimulationScenario;
  incident: Incident;
}

/** Prefixes every piece of synthetic content this service creates, so it is never mistaken for a real incident (see ADR-0013). */
const SIMULATION_PREFIX = '[SIMULATION]';

/**
 * Builds realistic, disposable incident scenarios for user-validation test
 * sessions (see ADR-0013). Composed entirely from existing tenant-scoped
 * services — every state-transition guard, Principle 1 (no AI-only
 * decisions), and tenant isolation rule applies exactly as it would to a
 * real incident, because these ARE real Incident/Decision/Evidence rows,
 * just synthetic content. ADMIN-gating is enforced by the controller, not
 * here — this service trusts its tenantId argument the same way every
 * other service in this codebase does.
 */
@Injectable()
export class SimulationScenarioService {
  private readonly logger = new Logger(SimulationScenarioService.name);

  constructor(
    private readonly incidents: IncidentsService,
    private readonly decisions: DecisionsService,
    private readonly evidence: EvidenceService,
    private readonly integrationConfig: IntegrationConfigService,
    private readonly integrationsRegistry: IntegrationsRegistryService,
    private readonly decisionIntelligence: DecisionIntelligenceEngineService,
  ) {}

  async trigger(
    tenantId: string,
    actorUserId: string,
    scenario: SimulationScenario,
  ): Promise<SimulationResult> {
    if (scenario === 'CYBER_RANSOMWARE') {
      return this.triggerCyberRansomware(tenantId, actorUserId);
    }
    return this.triggerCloudOutagePartialEvidence(tenantId, actorUserId);
  }

  /**
   * Scenario A: a SECURITY_BREACH/CRITICAL incident with two simultaneously
   * OPEN decisions, deliberately left undecided — exercises the
   * multi-decision Command Center panel (ADR-0013 / amended ADR-0009).
   */
  private async triggerCyberRansomware(
    tenantId: string,
    actorUserId: string,
  ): Promise<SimulationResult> {
    const incident = await this.incidents.create(tenantId, actorUserId, {
      title: `${SIMULATION_PREFIX} Ransomware attack detected across production network`,
      description:
        'EDR telemetry shows mass file-encryption activity spreading across production hosts. ' +
        'Lateral movement observed from a compromised administrator account. Containment and ' +
        'external communications are both time-critical and currently undecided.',
      severity: IncidentSeverity.CRITICAL,
      type: IncidentType.SECURITY_BREACH,
    });

    await this.evidence.create(tenantId, actorUserId, {
      incidentId: incident.id,
      type: EvidenceType.LOG,
      sourceCategory: EvidenceSourceCategory.MONITORING,
      source: 'EDR',
      summary:
        `${SIMULATION_PREFIX} EDR alert: mass file-encryption behavior detected on 40+ production hosts; ` +
        'lateral movement from a compromised administrator account confirmed.',
    });

    await Promise.all([
      this.decisions.open(tenantId, actorUserId, {
        incidentId: incident.id,
        question: 'Isolate the affected network segment from the internet to contain the ransomware spread?',
      }),
      this.decisions.open(tenantId, actorUserId, {
        incidentId: incident.id,
        question: 'Issue a public breach communication before containment is confirmed?',
      }),
    ]);

    return { scenario: 'CYBER_RANSOMWARE', incident };
  }

  /**
   * Scenario B: a CLOUD_OUTAGE/HIGH incident with only CLOUD_PROVIDER
   * evidence attached (no MONITORING evidence), while the tenant's DATADOG
   * integration is driven to a real OPEN circuit-breaker state — so
   * "not enough evidence" is the Decision Intelligence Engine's own,
   * genuinely computed conclusion, not a scripted message (ADR-0013).
   */
  private async triggerCloudOutagePartialEvidence(
    tenantId: string,
    actorUserId: string,
  ): Promise<SimulationResult> {
    const incident = await this.incidents.create(tenantId, actorUserId, {
      title: `${SIMULATION_PREFIX} Primary AWS region outage — checkout service down`,
      description:
        'AWS Health Dashboard reports degraded EC2/RDS availability in the primary region. ' +
        'The checkout service is returning elevated error rates. Monitoring telemetry that would ' +
        'normally corroborate this is currently unreachable.',
      severity: IncidentSeverity.HIGH,
      type: IncidentType.CLOUD_OUTAGE,
    });

    await this.evidence.create(tenantId, actorUserId, {
      incidentId: incident.id,
      type: EvidenceType.EXTERNAL_LINK,
      sourceCategory: EvidenceSourceCategory.CLOUD_PROVIDER,
      source: 'AWS Health Dashboard',
      summary: `${SIMULATION_PREFIX} AWS Health Dashboard: us-east-1 EC2/RDS degradation confirmed.`,
    });

    await this.integrationConfig.configure(tenantId, IntegrationKey.DATADOG, {
      simulateFailure: true,
    });
    await this.tripCircuitBreaker(tenantId, incident.id);

    const analysisDto: SubmitIntelligenceAnalysisDto = this.buildCloudOutageAnalysisDto();
    let analysis: AIOutputContractDto | null = null;
    try {
      analysis = await this.decisionIntelligence.analyze(
        tenantId,
        incident.id,
        actorUserId,
        analysisDto,
      );
    } catch (error) {
      // The engine validates its assembled output; if evidence-driven scoring
      // ever changes shape, fail loudly in logs rather than leave the
      // scenario silently half-built.
      this.logger.warn(
        `Scenario B: failed to seed IntelligenceAnalysis for incident ${incident.id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!analysis) {
      this.logger.warn(
        `Scenario B for tenant ${tenantId}: incident ${incident.id} was created without a seeded ` +
          'IntelligenceAnalysis — a test participant will need to trigger analysis manually.',
      );
    }

    return { scenario: 'CLOUD_OUTAGE_PARTIAL_EVIDENCE', incident };
  }

  /**
   * Drives three consecutive `incidentCreated` broadcasts so the tenant's
   * DATADOG provider (configured with `simulateFailure: true` just before
   * this call) actually accumulates three consecutive failures and trips
   * its circuit breaker to OPEN (failureThreshold: 3 — see ADR-0012). Real,
   * in-process resilience-engine state, not a hand-set flag.
   */
  private async tripCircuitBreaker(tenantId: string, incidentId: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.integrationsRegistry.broadcast('incidentCreated', {
        tenantId,
        incidentId,
        summary: `${SIMULATION_PREFIX} Cloud outage — driving Datadog circuit breaker to OPEN (attempt ${attempt + 1}/3)`,
      });
    }
  }

  private buildCloudOutageAnalysisDto(): SubmitIntelligenceAnalysisDto {
    return {
      situationSummary:
        `${SIMULATION_PREFIX} Primary AWS region reporting EC2/RDS degradation; monitoring ` +
        'telemetry that would normally corroborate scope and blast radius is currently unavailable ' +
        "(Datadog integration circuit breaker OPEN) — this analysis is based on partial evidence.",
      businessImpact: {
        level: IncidentSeverity.HIGH,
        description: `${SIMULATION_PREFIX} Checkout service degraded for an unconfirmed share of traffic.`,
        affectedSystems: ['checkout-service'],
      },
      criticalRisks: [
        {
          description: `${SIMULATION_PREFIX} Full scope of impact cannot be confirmed without monitoring telemetry.`,
          likelihood: 'MEDIUM',
          impact: 'HIGH',
        },
      ],
      conflictingInformation: [],
      recommendedDecision: {
        label: 'Wait for monitoring telemetry to recover before deciding on failover',
        description:
          `${SIMULATION_PREFIX} Recommended pending corroborating monitoring evidence — see ` +
          'missingInformation below for what is currently unavailable.',
        pros: ['Avoids an irreversible failover decision on partial evidence'],
        cons: ['Delays mitigation while checkout remains degraded'],
      },
      alternativeDecisions: [
        {
          label: 'Fail over to the secondary region immediately',
          description: `${SIMULATION_PREFIX} Available now, but decided without monitoring corroboration.`,
          pros: ['Faster mitigation'],
          cons: ['Decided on incomplete evidence'],
        },
      ],
      expectedConsequences: `${SIMULATION_PREFIX} Checkout error rate remains elevated until either telemetry recovers or a failover decision is made.`,
      immediateNextActions: [
        `${SIMULATION_PREFIX} Restore or bypass the Datadog integration to recover monitoring evidence.`,
        `${SIMULATION_PREFIX} Re-run intelligence analysis once monitoring evidence is available.`,
      ],
      executiveSummary: `${SIMULATION_PREFIX} AWS outage impacting checkout; monitoring evidence unavailable, confidence is limited — see missingInformation.`,
    };
  }
}
