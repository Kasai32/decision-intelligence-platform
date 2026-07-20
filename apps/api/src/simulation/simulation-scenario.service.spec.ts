import {
  EvidenceSourceCategory,
  IncidentSeverity,
  IncidentType,
  IntegrationKey,
} from '@prisma/client';
import { DecisionIntelligenceEngineService } from '../decision-intelligence/decision-intelligence-engine.service';
import { DecisionsService } from '../decisions/decisions.service';
import { EvidenceService } from '../evidence/evidence.service';
import { IncidentsService } from '../incidents/incidents.service';
import { IntegrationConfigService } from '../integrations/integration-config.service';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';
import { SimulationScenarioService } from './simulation-scenario.service';

describe('SimulationScenarioService (ADR-0013)', () => {
  let incidents: { create: jest.Mock };
  let decisions: { open: jest.Mock };
  let evidence: { create: jest.Mock };
  let integrationConfig: { configure: jest.Mock };
  let integrationsRegistry: { broadcast: jest.Mock };
  let decisionIntelligence: { analyze: jest.Mock };
  let service: SimulationScenarioService;

  const fakeIncident = (overrides: Record<string, unknown> = {}) => ({
    id: 'incident-1',
    tenantId: 't1',
    title: '[SIMULATION] test',
    status: 'OPEN',
    ...overrides,
  });

  beforeEach(() => {
    incidents = { create: jest.fn().mockResolvedValue(fakeIncident()) };
    decisions = { open: jest.fn().mockResolvedValue({ id: 'd1' }) };
    evidence = { create: jest.fn().mockResolvedValue({ id: 'e1' }) };
    integrationConfig = { configure: jest.fn().mockResolvedValue({}) };
    integrationsRegistry = { broadcast: jest.fn().mockResolvedValue(undefined) };
    decisionIntelligence = { analyze: jest.fn().mockResolvedValue({}) };

    service = new SimulationScenarioService(
      incidents as unknown as IncidentsService,
      decisions as unknown as DecisionsService,
      evidence as unknown as EvidenceService,
      integrationConfig as unknown as IntegrationConfigService,
      integrationsRegistry as unknown as IntegrationsRegistryService,
      decisionIntelligence as unknown as DecisionIntelligenceEngineService,
    );
  });

  describe('CYBER_RANSOMWARE', () => {
    it('creates a SECURITY_BREACH/CRITICAL incident prefixed [SIMULATION]', async () => {
      await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');

      expect(incidents.create).toHaveBeenCalledWith(
        't1',
        'u1',
        expect.objectContaining({
          title: expect.stringContaining('[SIMULATION]'),
          severity: IncidentSeverity.CRITICAL,
          type: IncidentType.SECURITY_BREACH,
        }),
      );
    });

    it('attaches MONITORING evidence scoped to the created incident', async () => {
      await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');

      expect(evidence.create).toHaveBeenCalledWith(
        't1',
        'u1',
        expect.objectContaining({
          incidentId: 'incident-1',
          sourceCategory: EvidenceSourceCategory.MONITORING,
        }),
      );
    });

    it('opens exactly two simultaneously OPEN decisions on the same incident, left undecided (see amended ADR-0009)', async () => {
      await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');

      expect(decisions.open).toHaveBeenCalledTimes(2);
      const questions = decisions.open.mock.calls.map((call) => call[2].question);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/isolate/i),
          expect.stringMatching(/public/i),
        ]),
      );
      for (const call of decisions.open.mock.calls) {
        expect(call[0]).toBe('t1');
        expect(call[2].incidentId).toBe('incident-1');
      }
      // Neither decision is ever decided by this service — Principle 1
      // (ADR-0007): a real human must decide, never the simulation script.
      expect(decisions.open.mock.calls.every((call) => !('humanDecision' in call[2]))).toBe(true);
    });

    it('never calls the integration/circuit-breaker machinery (that is Scenario B only)', async () => {
      await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');
      expect(integrationConfig.configure).not.toHaveBeenCalled();
      expect(integrationsRegistry.broadcast).not.toHaveBeenCalled();
      expect(decisionIntelligence.analyze).not.toHaveBeenCalled();
    });

    it('returns the created incident tagged with its scenario', async () => {
      const result = await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');
      expect(result).toEqual({ scenario: 'CYBER_RANSOMWARE', incident: fakeIncident() });
    });
  });

  describe('CLOUD_OUTAGE_PARTIAL_EVIDENCE', () => {
    it('creates a CLOUD_OUTAGE/HIGH incident prefixed [SIMULATION]', async () => {
      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(incidents.create).toHaveBeenCalledWith(
        't1',
        'u1',
        expect.objectContaining({
          title: expect.stringContaining('[SIMULATION]'),
          severity: IncidentSeverity.HIGH,
          type: IncidentType.CLOUD_OUTAGE,
        }),
      );
    });

    it('attaches ONLY CLOUD_PROVIDER evidence — no MONITORING — so evidenceCompleteness genuinely reads 50% (ADR-0010)', async () => {
      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(evidence.create).toHaveBeenCalledTimes(1);
      expect(evidence.create).toHaveBeenCalledWith(
        't1',
        'u1',
        expect.objectContaining({
          incidentId: 'incident-1',
          sourceCategory: EvidenceSourceCategory.CLOUD_PROVIDER,
        }),
      );
    });

    it('configures the tenant DATADOG integration with simulateFailure before broadcasting', async () => {
      const order: string[] = [];
      integrationConfig.configure.mockImplementation(async () => {
        order.push('configure');
        return {};
      });
      integrationsRegistry.broadcast.mockImplementation(async () => {
        order.push('broadcast');
      });

      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(integrationConfig.configure).toHaveBeenCalledWith('t1', IntegrationKey.DATADOG, {
        simulateFailure: true,
      });
      expect(order[0]).toBe('configure');
      expect(order.slice(1)).toEqual(['broadcast', 'broadcast', 'broadcast']);
    });

    it('drives exactly three broadcasts to trip the DATADOG circuit breaker (failureThreshold: 3, ADR-0012)', async () => {
      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(integrationsRegistry.broadcast).toHaveBeenCalledTimes(3);
      for (const call of integrationsRegistry.broadcast.mock.calls) {
        expect(call[0]).toBe('incidentCreated');
        expect(call[1]).toEqual(
          expect.objectContaining({ tenantId: 't1', incidentId: 'incident-1' }),
        );
      }
    });

    it('seeds a real IntelligenceAnalysis via the actual engine, with [SIMULATION]-prefixed qualitative fields', async () => {
      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(decisionIntelligence.analyze).toHaveBeenCalledTimes(1);
      const [tenantId, incidentId, submittedByUserId, dto] =
        decisionIntelligence.analyze.mock.calls[0];
      expect(tenantId).toBe('t1');
      expect(incidentId).toBe('incident-1');
      expect(submittedByUserId).toBe('u1');
      expect(dto.situationSummary).toContain('[SIMULATION]');
      expect(dto.executiveSummary).toContain('[SIMULATION]');
      // Never hidden by omission (Principle 3) — conflictingInformation must
      // still be an explicit array, even when empty.
      expect(Array.isArray(dto.conflictingInformation)).toBe(true);
    });

    it('does not throw and still returns the incident if seeding the IntelligenceAnalysis fails', async () => {
      decisionIntelligence.analyze.mockRejectedValue(new Error('validation failed'));

      const result = await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      expect(result.incident).toEqual(fakeIncident());
      expect(result.scenario).toBe('CLOUD_OUTAGE_PARTIAL_EVIDENCE');
    });
  });

  describe('tenant isolation', () => {
    it('never leaks one tenant’s scenario into another: every downstream call is scoped to the caller’s own tenantId', async () => {
      await service.trigger('tenant-a', 'user-a', 'CYBER_RANSOMWARE');
      await service.trigger('tenant-b', 'user-b', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');

      const tenantsSeenByIncidents = incidents.create.mock.calls.map((call) => call[0]);
      const tenantsSeenByEvidence = evidence.create.mock.calls.map((call) => call[0]);
      const tenantsSeenByDecisions = decisions.open.mock.calls.map((call) => call[0]);
      const tenantsSeenByIntegrationConfig = integrationConfig.configure.mock.calls.map(
        (call) => call[0],
      );
      const tenantsSeenByBroadcast = integrationsRegistry.broadcast.mock.calls.map(
        (call) => call[1].tenantId,
      );

      expect(tenantsSeenByIncidents).toEqual(['tenant-a', 'tenant-b']);
      expect(new Set(tenantsSeenByEvidence)).toEqual(new Set(['tenant-a', 'tenant-b']));
      expect(new Set(tenantsSeenByDecisions)).toEqual(new Set(['tenant-a']));
      expect(tenantsSeenByIntegrationConfig).toEqual(['tenant-b']);
      expect(new Set(tenantsSeenByBroadcast)).toEqual(new Set(['tenant-b']));
    });
  });

  describe('trigger()', () => {
    it('dispatches CYBER_RANSOMWARE without touching the integration registry', async () => {
      await service.trigger('t1', 'u1', 'CYBER_RANSOMWARE');
      expect(integrationsRegistry.broadcast).not.toHaveBeenCalled();
    });

    it('dispatches CLOUD_OUTAGE_PARTIAL_EVIDENCE without opening any Decision', async () => {
      await service.trigger('t1', 'u1', 'CLOUD_OUTAGE_PARTIAL_EVIDENCE');
      expect(decisions.open).not.toHaveBeenCalled();
    });
  });
});
