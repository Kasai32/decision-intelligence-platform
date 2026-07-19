import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsService } from './actions.service';

describe('ActionsService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    membership: { findUnique: jest.Mock };
    action: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: ActionsService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      membership: { findUnique: jest.fn() },
      action: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new ActionsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects assigning to a user who is not a tenant member', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.create('t1', 'u1', {
          incidentId: 'i1',
          title: 'Patch the server',
          assignedToUserId: 'not-a-member',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the action when unassigned', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1' });
      prisma.action.create.mockResolvedValue({ id: 'a1', status: ActionStatus.PENDING });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.create('t1', 'u1', {
        incidentId: 'i1',
        title: 'Patch the server',
      });
      expect(result.status).toBe(ActionStatus.PENDING);
    });
  });

  describe('updateStatus', () => {
    it('allows PENDING -> IN_PROGRESS', async () => {
      prisma.action.findFirst.mockResolvedValue({
        id: 'a1',
        status: ActionStatus.PENDING,
        incidentId: 'i1',
        decisionId: null,
      });
      prisma.action.update.mockResolvedValue({ id: 'a1', status: ActionStatus.IN_PROGRESS });
      prisma.timelineEvent.create.mockResolvedValue({});

      const result = await service.updateStatus('t1', 'u1', 'a1', {
        status: ActionStatus.IN_PROGRESS,
      });
      expect(result.status).toBe(ActionStatus.IN_PROGRESS);
    });

    it('rejects a state jump (PENDING straight to DONE)', async () => {
      prisma.action.findFirst.mockResolvedValue({
        id: 'a1',
        status: ActionStatus.PENDING,
        incidentId: 'i1',
        decisionId: null,
      });

      await expect(
        service.updateStatus('t1', 'u1', 'a1', { status: ActionStatus.DONE }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for an action outside the tenant', async () => {
      prisma.action.findFirst.mockResolvedValue(null);
      await expect(
        service.updateStatus('t1', 'u1', 'missing', { status: ActionStatus.DONE }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
