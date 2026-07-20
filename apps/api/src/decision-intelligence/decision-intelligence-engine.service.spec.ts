import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EvidenceSourceCategory, IncidentSeverity, IncidentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionIntelligenceEngineService } from './decision-intelligence-engine.service';
import { SubmitIntelligenceAnalysisDto } from './dto/submit-intelligence-analysis.dto';

const NOW = new Date('2026-07-19T12:00:00.000Z');

function validSubmission(
  overrides: Partial<SubmitIntelligenceAnalysisDto> = {},
): SubmitIntelligenceAnalysisDto {
  return {
    situationSummary: 'Payments API returning elevated 5xx rates since 11:40.',
    businessImpact: {
      level: IncidentSeverity.HIGH,
      description: 'Checkout failures for a subset of customers.',
      affectedSystems: ['payments-api', 'checkout-web'],
    },
    criticalRisks: [
      { description: 'Revenue loss during peak hours', likelihood: 'HIGH', impact: 'HIGH' },
    ],
    conflictingInformation: [],
    recommendedDecision: { label: 'Roll back', description: 'Roll back the 11:35 deploy.' },
    alternativeDecisions: [
      { label: 'Hotfix forward', description: 'Ship a targeted patch instead.' },
    ],
    expectedConsequences: 'Brief additional downtime during rollback, then recovery.',
    immediateNextActions: ['Page on-call', 'Notify status page'],
    executiveSummary: 'Recommend rollback; evidence supports a bad deploy as root cause.',
    ...overrides,
  };
}

describe('DecisionIntelligenceEngineService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    evidence: { findMany: jest.Mock };
    intelligenceAnalysis: { create: jest.Mock; findMany: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: DecisionIntelligenceEngineService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      evidence: { findMany: jest.fn() },
      intelligenceAnalysis: { create: jest.fn(), findMany: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new DecisionIntelligenceEngineService(prisma as unknown as PrismaService);
  });

  describe('analyze', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(
        service.analyze('t1', 'missing', 'u1', validSubmission(), NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('computes all four dimensions from real evidence and never merges them, returning the persisted row (same flat shape as list())', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        type: IncidentType.CLOUD_OUTAGE,
        severity: IncidentSeverity.HIGH,
      });
      prisma.evidence.findMany.mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          sourceCategory: EvidenceSourceCategory.MONITORING,
          createdAt: new Date('2026-07-19T11:58:00.000Z'), // 2 min before NOW
        },
      ]);
      prisma.intelligenceAnalysis.create.mockImplementation(({ data }) => ({
        id: 'analysis-1',
        ...data,
      }));
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.analyze('t1', 'i1', 'u1', validSubmission(), NOW);

      // CLOUD_OUTAGE requires [MONITORING, CLOUD_PROVIDER]; only MONITORING present -> 50
      expect(result.evidenceCompleteness).toBe(50);
      // Single MONITORING source -> reliability = 90
      expect(result.sourceReliability).toBe(90);
      // 2 minutes old, HIGH severity (k=2) -> 100 - 2*2 = 96
      expect(result.dataFreshness).toBe(96);
      // 1 evidence, 1 unique category, 0 conflicts -> 15 + 7 = 22
      expect(result.aiCertainty).toBe(22);

      // All four are present as distinct top-level fields, never merged into a single number
      // or nested under a `confidenceDimensions` object — that used to disagree with what
      // list() returns; see DECISION_LOG.md, 2026-07-20.
      expect(result).not.toHaveProperty('confidenceDimensions');
    });

    it('computes missingInformation from the real evidence gap, never supplied by the caller', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        type: IncidentType.CLOUD_OUTAGE,
        severity: IncidentSeverity.MEDIUM,
      });
      prisma.evidence.findMany.mockResolvedValue([]); // no evidence at all
      prisma.intelligenceAnalysis.create.mockImplementation(({ data }) => ({
        id: 'analysis-1',
        ...data,
      }));
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.analyze('t1', 'i1', 'u1', validSubmission(), NOW);

      expect(result.missingInformation).toEqual(
        expect.arrayContaining([
          expect.stringContaining('MONITORING'),
          expect.stringContaining('CLOUD_PROVIDER'),
        ]),
      );
      expect(result.evidenceUsed).toEqual([]);
    });

    it('persists the analysis and writes a TimelineEvent', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        type: IncidentType.OTHER,
        severity: IncidentSeverity.LOW,
      });
      prisma.evidence.findMany.mockResolvedValue([]);
      prisma.intelligenceAnalysis.create.mockResolvedValue({ id: 'analysis-1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.analyze('t1', 'i1', 'u1', validSubmission(), NOW);

      expect(prisma.intelligenceAnalysis.create).toHaveBeenCalledTimes(1);
      expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'INTELLIGENCE_ANALYSIS_GENERATED' }),
        }),
      );
    });

    it('rejects an assembled contract that fails validation, even if it bypassed the controller boundary', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        type: IncidentType.OTHER,
        severity: IncidentSeverity.LOW,
      });
      prisma.evidence.findMany.mockResolvedValue([]);

      // Simulates a caller that bypassed the controller's ValidationPipe
      // (e.g. a direct internal call) with a structurally invalid risk entry.
      const malformed = validSubmission({
        criticalRisks: [{ description: 'x', likelihood: 'NOT_A_LEVEL', impact: 'HIGH' }],
      } as unknown as Partial<SubmitIntelligenceAnalysisDto>);

      await expect(service.analyze('t1', 'i1', 'u1', malformed, NOW)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.intelligenceAnalysis.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(service.list('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns analyses ordered newest first', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.intelligenceAnalysis.findMany.mockResolvedValue([{ id: 'a2' }, { id: 'a1' }]);

      const result = await service.list('t1', 'i1');
      expect(result).toEqual([{ id: 'a2' }, { id: 'a1' }]);
    });
  });
});
