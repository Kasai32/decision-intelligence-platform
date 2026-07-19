import { NotFoundException } from '@nestjs/common';
import { DecisionStatus, EvidenceSourceCategory, EvidenceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionReportsService } from './decision-reports.service';

describe('DecisionReportsService', () => {
  let prisma: {
    decision: { findFirst: jest.Mock };
    evidence: { findMany: jest.Mock };
    timelineEvent: { findMany: jest.Mock; create: jest.Mock };
    decisionReport: { create: jest.Mock; findMany: jest.Mock };
  };
  let service: DecisionReportsService;

  beforeEach(() => {
    prisma = {
      decision: { findFirst: jest.fn() },
      evidence: { findMany: jest.fn() },
      timelineEvent: { findMany: jest.fn(), create: jest.fn() },
      decisionReport: { create: jest.fn(), findMany: jest.fn() },
    };
    service = new DecisionReportsService(prisma as unknown as PrismaService);
  });

  describe('generate', () => {
    it('throws NotFoundException for a decision outside the tenant', async () => {
      prisma.decision.findFirst.mockResolvedValue(null);
      await expect(service.generate('t1', 'missing', 'u1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('snapshots the decision outcome and evidence exactly as they are now', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        incidentId: 'i1',
        question: 'Roll back?',
        status: DecisionStatus.DECIDED,
        humanDecision: 'Yes, roll back.',
        rationale: 'Error rate too high.',
        decidedByUserId: 'u2',
        decidedAt: new Date('2026-07-19T12:00:00.000Z'),
      });
      prisma.evidence.findMany.mockResolvedValue([
        {
          id: 'e1',
          type: EvidenceType.METRIC,
          sourceCategory: EvidenceSourceCategory.MONITORING,
          source: 'Datadog',
          summary: '5xx spike',
        },
      ]);
      prisma.timelineEvent.findMany.mockResolvedValue([
        { type: 'DECISION_OPENED', description: 'Decision opened', occurredAt: new Date() },
      ]);
      prisma.decisionReport.create.mockResolvedValue({ id: 'report1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.generate('t1', 'd1', 'u1', {});

      const createCall = prisma.decisionReport.create.mock.calls[0][0];
      expect(createCall.data.question).toBe('Roll back?');
      expect(createCall.data.humanDecision).toBe('Yes, roll back.');
      expect(createCall.data.evidenceSummary).toEqual([
        {
          id: 'e1',
          type: 'METRIC',
          sourceCategory: 'MONITORING',
          source: 'Datadog',
          summary: '5xx spike',
        },
      ]);
    });

    it('scopes evidence and timeline queries to the decision, not the whole incident', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        incidentId: 'i1',
        question: 'x',
        status: DecisionStatus.OPEN,
        humanDecision: null,
        rationale: null,
        decidedByUserId: null,
        decidedAt: null,
      });
      prisma.evidence.findMany.mockResolvedValue([]);
      prisma.timelineEvent.findMany.mockResolvedValue([]);
      prisma.decisionReport.create.mockResolvedValue({ id: 'report1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.generate('t1', 'd1', 'u1', {});

      expect(prisma.evidence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ decisionId: 'd1' }) }),
      );
    });
  });

  describe('list', () => {
    it('throws NotFoundException for a decision outside the tenant', async () => {
      prisma.decision.findFirst.mockResolvedValue(null);
      await expect(service.list('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
