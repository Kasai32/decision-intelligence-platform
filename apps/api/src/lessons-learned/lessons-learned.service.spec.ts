import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsLearnedService } from './lessons-learned.service';

describe('LessonsLearnedService', () => {
  let prisma: {
    incident: { findFirst: jest.Mock };
    lessonLearned: { create: jest.Mock; findMany: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let service: LessonsLearnedService;

  beforeEach(() => {
    prisma = {
      incident: { findFirst: jest.fn() },
      lessonLearned: { create: jest.fn(), findMany: jest.fn() },
      timelineEvent: { create: jest.fn() },
    };
    service = new LessonsLearnedService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(
        service.create('t1', 'missing', 'u1', { title: 'x', whatHappened: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects recording a lesson for a non-CLOSED incident', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.RESOLVED });
      await expect(
        service.create('t1', 'i1', 'u1', { title: 'x', whatHappened: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lessonLearned.create).not.toHaveBeenCalled();
    });

    it('creates a lesson for a CLOSED incident, defaulting optional arrays to []', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: 'i1', status: IncidentStatus.CLOSED });
      prisma.lessonLearned.create.mockResolvedValue({ id: 'lesson1' });
      prisma.timelineEvent.create.mockResolvedValue({});

      await service.create('t1', 'i1', 'u1', {
        title: 'Outage retro',
        whatHappened: 'DB ran out of connections.',
      });

      expect(prisma.lessonLearned.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whatWentWell: [],
            whatToImprove: [],
            actionItems: [],
            tags: [],
          }),
        }),
      );
    });
  });

  describe('search — Knowledge Base', () => {
    it('scopes every search to the tenant', async () => {
      prisma.lessonLearned.findMany.mockResolvedValue([]);
      await service.search('t1', undefined, undefined);
      expect(prisma.lessonLearned.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 't1' } }),
      );
    });

    it('adds a case-insensitive OR match on title/whatHappened when a query is given', async () => {
      prisma.lessonLearned.findMany.mockResolvedValue([]);
      await service.search('t1', 'database timeout', undefined);
      const call = prisma.lessonLearned.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { title: { contains: 'database timeout', mode: 'insensitive' } },
        { whatHappened: { contains: 'database timeout', mode: 'insensitive' } },
      ]);
    });

    it('adds a tag filter when tags are given', async () => {
      prisma.lessonLearned.findMany.mockResolvedValue([]);
      await service.search('t1', undefined, ['database', 'timeout']);
      const call = prisma.lessonLearned.findMany.mock.calls[0][0];
      expect(call.where.tags).toEqual({ hasSome: ['database', 'timeout'] });
    });
  });

  describe('list', () => {
    it('throws NotFoundException for an incident outside the tenant', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      await expect(service.list('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
