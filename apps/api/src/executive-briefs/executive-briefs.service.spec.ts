import { NotFoundException } from '@nestjs/common';
import { ActionStatus, DecisionStatus, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutiveBriefsService } from './executive-briefs.service';

describe('ExecutiveBriefsService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    decision: { findMany: jest.Mock };
    action: { findMany: jest.Mock };
    intelligenceAnalysis: { findFirst: jest.Mock };
    executiveBrief: { create: jest.Mock; findMany: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: ExecutiveBriefsService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      decision: { findMany: jest.fn() },
      action: { findMany: jest.fn() },
      intelligenceAnalysis: { findFirst: jest.fn() },
      executiveBrief: { create: jest.fn(), findMany: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new ExecutiveBriefsService(prisma as unknown as PrismaService);
  });

  describe('generate', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(service.generate('t1', 'missing', 'u1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('builds a factual summary from real counts, not fabricated narrative', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'Payments API down',
        status: IncidentStatus.MITIGATED,
        severity: IncidentSeverity.HIGH,
      });
      prisma.decision.findMany.mockResolvedValue([
        { id: 'd1', question: 'Roll back?', status: DecisionStatus.DECIDED },
        { id: 'd2', question: 'Notify customers?', status: DecisionStatus.OPEN },
      ]);
      prisma.action.findMany.mockResolvedValue([]);
      prisma.intelligenceAnalysis.findFirst.mockResolvedValue(null);
      prisma.executiveBrief.create.mockResolvedValue({ id: 'brief1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.generate('t1', 'i1', 'u1', {});

      const createCall = prisma.executiveBrief.create.mock.calls[0][0];
      expect(createCall.data.summary).toBe(
        'Incident "Payments API down" is currently MITIGATED (HIGH severity). 1 of 2 decision(s) made.',
      );
      expect(createCall.data.incidentStatus).toBe(IncidentStatus.MITIGATED);
    });

    it('pulls businessImpact and openRisks from the latest IntelligenceAnalysis when one exists', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'x',
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.LOW,
      });
      prisma.decision.findMany.mockResolvedValue([]);
      prisma.action.findMany.mockResolvedValue([]);
      prisma.intelligenceAnalysis.findFirst.mockResolvedValue({
        businessImpact: { level: 'HIGH', description: 'x', affectedSystems: [] },
        criticalRisks: [{ description: 'risk', likelihood: 'HIGH', impact: 'HIGH' }],
      });
      prisma.executiveBrief.create.mockResolvedValue({ id: 'brief1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.generate('t1', 'i1', 'u1', {});

      const createCall = prisma.executiveBrief.create.mock.calls[0][0];
      expect(createCall.data.businessImpact).toEqual({
        level: 'HIGH',
        description: 'x',
        affectedSystems: [],
      });
      expect(createCall.data.openRisks).toEqual([
        { description: 'risk', likelihood: 'HIGH', impact: 'HIGH' },
      ]);
    });

    it('includes only PENDING/IN_PROGRESS actions as nextActions', async () => {
      prisma.incident.findFirst.mockResolvedValue({
        id: 'i1',
        title: 'x',
        status: IncidentStatus.OPEN,
        severity: IncidentSeverity.LOW,
      });
      prisma.decision.findMany.mockResolvedValue([]);
      prisma.action.findMany.mockResolvedValue([
        {
          id: 'a1',
          title: 'Patch',
          status: ActionStatus.PENDING,
          assignedToUserId: null,
          dueAt: null,
        },
      ]);
      prisma.intelligenceAnalysis.findFirst.mockResolvedValue(null);
      prisma.executiveBrief.create.mockResolvedValue({ id: 'brief1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.generate('t1', 'i1', 'u1', { additionalNotes: 'For board review.' });

      expect(prisma.action.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [ActionStatus.PENDING, ActionStatus.IN_PROGRESS] },
          }),
        }),
      );
      const createCall = prisma.executiveBrief.create.mock.calls[0][0];
      expect(createCall.data.additionalNotes).toBe('For board review.');
    });
  });

  describe('list', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(service.list('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
