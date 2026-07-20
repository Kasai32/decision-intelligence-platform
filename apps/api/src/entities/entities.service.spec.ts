import { NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EntitiesService } from './entities.service';

describe('EntitiesService', () => {
  let prisma: {
    entity: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    evidence: { findFirst: jest.Mock };
    relationship: { findMany: jest.Mock };
  };
  let auditLog: { record: jest.Mock };
  let service: EntitiesService;

  beforeEach(() => {
    prisma = {
      entity: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      evidence: { findFirst: jest.fn() },
      relationship: { findMany: jest.fn() },
    };
    auditLog = { record: jest.fn().mockResolvedValue({}) };
    service = new EntitiesService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the cited evidence is not in this tenant', async () => {
      prisma.evidence.findFirst.mockResolvedValue(null);

      await expect(
        service.create('t1', 'u1', {
          type: EntityType.PERSON,
          name: 'John Smith',
          evidenceId: 'ev-missing',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.entity.create).not.toHaveBeenCalled();
    });

    it('creates the entity with an evidence link, and logs CREATE_ENTITY — never a bare assertion', async () => {
      prisma.evidence.findFirst.mockResolvedValue({ id: 'ev-1', tenantId: 't1' });
      prisma.entity.create.mockResolvedValue({ id: 'entity-1', name: 'John Smith' });

      const entity = await service.create('t1', 'u1', {
        type: EntityType.PERSON,
        name: 'John Smith',
        aliases: ['J. Smith'],
        evidenceId: 'ev-1',
        extractedText: 'John Smith was present at the scene.',
      });

      expect(entity.id).toBe('entity-1');
      expect(prisma.entity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          type: EntityType.PERSON,
          name: 'John Smith',
          aliases: ['J. Smith'],
          evidenceLinks: {
            create: {
              tenantId: 't1',
              evidenceId: 'ev-1',
              extractedText: 'John Smith was present at the scene.',
            },
          },
        }),
      });
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.CREATE_ENTITY,
        targetType: 'Entity',
        targetId: 'entity-1',
      });
    });
  });

  describe('search', () => {
    it('filters by type/name and logs a SEARCH entry with the reason and result count', async () => {
      prisma.entity.findMany.mockResolvedValue([{ id: 'entity-1' }, { id: 'entity-2' }]);

      const results = await service.search('t1', 'u1', {
        query: 'Smith',
        type: EntityType.PERSON,
        reason: 'cross-referencing fraud case #4',
      });

      expect(results).toHaveLength(2);
      expect(prisma.entity.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 't1',
          type: EntityType.PERSON,
          name: { contains: 'Smith', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.SEARCH,
        reason: 'cross-referencing fraud case #4',
        metadata: { query: 'Smith', type: EntityType.PERSON, resultCount: 2 },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for an entity outside the tenant', async () => {
      prisma.entity.findFirst.mockResolvedValue(null);

      await expect(service.findOne('t1', 'u1', 'missing', 'reason')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auditLog.record).not.toHaveBeenCalled();
    });

    it('logs VIEW_ENTITY with the stated reason', async () => {
      prisma.entity.findFirst.mockResolvedValue({ id: 'entity-1' });

      await service.findOne('t1', 'u1', 'entity-1', 'verifying identity before interview');

      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.VIEW_ENTITY,
        targetType: 'Entity',
        targetId: 'entity-1',
        reason: 'verifying identity before interview',
      });
    });
  });

  describe('getGraph', () => {
    it('returns the entity and every relationship it is a party to, and logs VIEW_GRAPH', async () => {
      prisma.entity.findFirst.mockResolvedValue({ id: 'entity-1' });
      prisma.relationship.findMany.mockResolvedValue([
        { id: 'rel-1', fromEntityId: 'entity-1', toEntityId: 'entity-2' },
      ]);

      const graph = await service.getGraph('t1', 'u1', 'entity-1', 'mapping known associates');

      expect(graph.entity.id).toBe('entity-1');
      expect(graph.relationships).toHaveLength(1);
      expect(prisma.relationship.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', OR: [{ fromEntityId: 'entity-1' }, { toEntityId: 'entity-1' }] },
        include: { fromEntity: true, toEntity: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.VIEW_GRAPH,
        targetType: 'Entity',
        targetId: 'entity-1',
        reason: 'mapping known associates',
        metadata: { relationshipCount: 1 },
      });
    });
  });
});
