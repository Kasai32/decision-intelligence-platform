import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DecisionOutcomeQuality, DecisionStatus, IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionOutcomesService } from './decision-outcomes.service';

describe('DecisionOutcomesService', () => {
  let prisma: {
    decision: { findFirst: jest.Mock };
    incident: { findFirst: jest.Mock };
    decisionOutcome: { findUnique: jest.Mock; create: jest.Mock };
    intelligenceAnalysis: { findFirst: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: DecisionOutcomesService;

  const DECIDED_AT = new Date('2026-07-20T12:00:00.000Z');

  beforeEach(() => {
    prisma = {
      decision: { findFirst: jest.fn() },
      incident: { findFirst: jest.fn() },
      decisionOutcome: { findUnique: jest.fn(), create: jest.fn() },
      intelligenceAnalysis: { findFirst: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new DecisionOutcomesService(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('throws NotFoundException for a decision outside the tenant', async () => {
      prisma.decision.findFirst.mockResolvedValue(null);
      await expect(
        service.record('t1', 'missing', 'u1', { outcomeQuality: DecisionOutcomeQuality.GOOD }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a decision that was never DECIDED', async () => {
      prisma.decision.findFirst.mockResolvedValue({ id: 'd1', status: DecisionStatus.OPEN });
      await expect(
        service.record('t1', 'd1', 'u1', { outcomeQuality: DecisionOutcomeQuality.GOOD }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.decisionOutcome.create).not.toHaveBeenCalled();
    });

    it('rejects recording an outcome for a non-CLOSED incident', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
        decidedAt: DECIDED_AT,
      });
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.RESOLVED });

      await expect(
        service.record('t1', 'd1', 'u1', { outcomeQuality: DecisionOutcomeQuality.GOOD }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.decisionOutcome.create).not.toHaveBeenCalled();
    });

    it('rejects a second outcome for the same decision', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
        decidedAt: DECIDED_AT,
      });
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.CLOSED });
      prisma.decisionOutcome.findUnique.mockResolvedValue({ id: 'existing-outcome' });

      await expect(
        service.record('t1', 'd1', 'u1', { outcomeQuality: DecisionOutcomeQuality.GOOD }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.decisionOutcome.create).not.toHaveBeenCalled();
    });

    it('links the outcome to the most recent analysis that existed at decision time, and writes a TimelineEvent', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
        decidedAt: DECIDED_AT,
      });
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.CLOSED });
      prisma.decisionOutcome.findUnique.mockResolvedValue(null);
      prisma.intelligenceAnalysis.findFirst.mockResolvedValue({ id: 'analysis-1' });
      prisma.decisionOutcome.create.mockResolvedValue({ id: 'outcome-1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.record('t1', 'd1', 'u1', {
        outcomeQuality: DecisionOutcomeQuality.GOOD,
        notes: 'Rollback resolved it within 10 minutes.',
      });

      expect(prisma.intelligenceAnalysis.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 't1', incidentId: 'i1', createdAt: { lte: DECIDED_AT } },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.decisionOutcome.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          decisionId: 'd1',
          intelligenceAnalysisId: 'analysis-1',
          outcomeQuality: DecisionOutcomeQuality.GOOD,
          notes: 'Rollback resolved it within 10 minutes.',
          recordedByUserId: 'u1',
        },
      });
      expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DECISION_OUTCOME_RECORDED',
            metadata: { outcomeId: 'outcome-1', intelligenceAnalysisId: 'analysis-1' },
          }),
        }),
      );
    });

    it('records a null intelligenceAnalysisId when no analysis existed at decision time', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
        decidedAt: DECIDED_AT,
      });
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.CLOSED });
      prisma.decisionOutcome.findUnique.mockResolvedValue(null);
      prisma.intelligenceAnalysis.findFirst.mockResolvedValue(null);
      prisma.decisionOutcome.create.mockResolvedValue({ id: 'outcome-1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.record('t1', 'd1', 'u1', { outcomeQuality: DecisionOutcomeQuality.BAD });

      expect(prisma.decisionOutcome.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ intelligenceAnalysisId: undefined }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a decision outside the tenant', async () => {
      prisma.decision.findFirst.mockResolvedValue(null);
      await expect(service.findOne('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when no outcome has been recorded yet', async () => {
      prisma.decision.findFirst.mockResolvedValue({ id: 'd1' });
      prisma.decisionOutcome.findUnique.mockResolvedValue(null);
      await expect(service.findOne('t1', 'd1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the recorded outcome', async () => {
      prisma.decision.findFirst.mockResolvedValue({ id: 'd1' });
      prisma.decisionOutcome.findUnique.mockResolvedValue({
        id: 'outcome-1',
        outcomeQuality: 'GOOD',
      });
      await expect(service.findOne('t1', 'd1')).resolves.toEqual({
        id: 'outcome-1',
        outcomeQuality: 'GOOD',
      });
    });
  });
});
