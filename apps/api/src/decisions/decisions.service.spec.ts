import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DecisionStatus } from '@prisma/client';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { DecisionsService } from './decisions.service';

describe('DecisionsService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    decision: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    membership: { findUnique: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let integrations: { broadcast: jest.Mock };
  let service: DecisionsService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      decision: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      membership: { findUnique: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    integrations = { broadcast: jest.fn().mockResolvedValue(undefined) };
    service = new DecisionsService(
      prisma as unknown as PrismaService,
      integrations as unknown as IntegrationsRegistryService,
    );
  });

  describe('open', () => {
    it('rejects opening a decision against an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(
        service.open('t1', 'u1', { incidentId: 'missing', question: 'What now?' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates an OPEN decision and a timeline event', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.decision.create.mockResolvedValue({ id: 'd1', status: DecisionStatus.OPEN });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.open('t1', 'u1', { incidentId: 'i1', question: 'What now?' });
      expect(result.status).toBe(DecisionStatus.OPEN);
      expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'DECISION_OPENED' }) }),
      );
    });
  });

  describe('decide — Principle 1 (the AI decides nothing alone)', () => {
    it('rejects deciding without decidedByUserId resolving to a real tenant member', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.OPEN,
        incidentId: 'i1',
      });
      prisma.membership.findUnique.mockResolvedValue(null); // not a member of this tenant

      await expect(
        service.decide('t1', 'caller-u1', 'd1', {
          humanDecision: 'We will roll back the deploy.',
          decidedByUserId: 'not-a-real-member',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.decision.update).not.toHaveBeenCalled();
    });

    it('rejects deciding a Decision that is not OPEN (already DECIDED)', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
      });

      await expect(
        service.decide('t1', 'caller-u1', 'd1', {
          humanDecision: 'Redundant decision attempt.',
          decidedByUserId: 'stakeholder-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
      expect(prisma.decision.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a decision outside the tenant', async () => {
      prisma.decision.findFirst.mockResolvedValue(null);
      await expect(
        service.decide('t1', 'caller-u1', 'missing', {
          humanDecision: 'x',
          decidedByUserId: 'stakeholder-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('accepts a valid decision: OPEN -> DECIDED with a named, verified human stakeholder', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.OPEN,
        incidentId: 'i1',
      });
      prisma.membership.findUnique.mockResolvedValue({ userId: 'stakeholder-1', tenantId: 't1' });
      prisma.decision.update.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        humanDecision: 'We will roll back the deploy.',
        decidedByUserId: 'stakeholder-1',
      });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.decide('t1', 'caller-u1', 'd1', {
        humanDecision: 'We will roll back the deploy.',
        decidedByUserId: 'stakeholder-1',
      });

      expect(result.status).toBe(DecisionStatus.DECIDED);
      expect(prisma.decision.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DecisionStatus.DECIDED,
            decidedByUserId: 'stakeholder-1',
          }),
        }),
      );
      expect(integrations.broadcast).toHaveBeenCalledWith(
        'decisionDecided',
        expect.objectContaining({ incidentId: 'i1' }),
      );
    });
  });

  describe('cancel', () => {
    it('allows OPEN -> CANCELLED', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.OPEN,
        incidentId: 'i1',
      });
      prisma.decision.update.mockResolvedValue({ id: 'd1', status: DecisionStatus.CANCELLED });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.cancel('t1', 'u1', 'd1');
      expect(result.status).toBe(DecisionStatus.CANCELLED);
    });

    it('rejects cancelling an already-DECIDED decision (immutable once decided)', async () => {
      prisma.decision.findFirst.mockResolvedValue({
        id: 'd1',
        status: DecisionStatus.DECIDED,
        incidentId: 'i1',
      });

      await expect(service.cancel('t1', 'u1', 'd1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
