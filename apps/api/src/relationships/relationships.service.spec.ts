import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, RelationshipStatus, RelationshipType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RelationshipsService } from './relationships.service';

describe('RelationshipsService', () => {
  let prisma: {
    entity: { findFirst: jest.Mock };
    evidence: { findFirst: jest.Mock };
    relationship: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    relationshipEvidenceLink: { count: jest.Mock };
  };
  let auditLog: { record: jest.Mock };
  let service: RelationshipsService;

  beforeEach(() => {
    prisma = {
      entity: { findFirst: jest.fn() },
      evidence: { findFirst: jest.fn() },
      relationship: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      relationshipEvidenceLink: { count: jest.fn() },
    };
    auditLog = { record: jest.fn().mockResolvedValue({}) };
    service = new RelationshipsService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when either entity is outside the tenant', async () => {
      prisma.entity.findFirst.mockResolvedValueOnce({ id: 'e1' }).mockResolvedValueOnce(null);
      prisma.evidence.findFirst.mockResolvedValue({ id: 'ev-1' });

      await expect(
        service.create('t1', 'u1', {
          fromEntityId: 'e1',
          toEntityId: 'missing',
          type: RelationshipType.ASSOCIATED_WITH,
          evidenceId: 'ev-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.relationship.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the cited evidence is outside the tenant', async () => {
      prisma.entity.findFirst.mockResolvedValue({ id: 'e1' });
      prisma.evidence.findFirst.mockResolvedValue(null);

      await expect(
        service.create('t1', 'u1', {
          fromEntityId: 'e1',
          toEntityId: 'e2',
          type: RelationshipType.ASSOCIATED_WITH,
          evidenceId: 'ev-missing',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates the relationship as SUGGESTED (never auto-confirmed) with an evidence link, and logs CREATE_RELATIONSHIP', async () => {
      prisma.entity.findFirst.mockResolvedValue({ id: 'e1' });
      prisma.evidence.findFirst.mockResolvedValue({ id: 'ev-1' });
      prisma.relationship.create.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.SUGGESTED,
      });

      const relationship = await service.create('t1', 'u1', {
        fromEntityId: 'e1',
        toEntityId: 'e2',
        type: RelationshipType.EMPLOYED_BY,
        evidenceId: 'ev-1',
      });

      expect(relationship.status).toBe(RelationshipStatus.SUGGESTED);
      expect(prisma.relationship.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          fromEntityId: 'e1',
          toEntityId: 'e2',
          type: RelationshipType.EMPLOYED_BY,
          evidenceLinks: { create: { tenantId: 't1', evidenceId: 'ev-1' } },
        }),
      });
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.CREATE_RELATIONSHIP,
        targetType: 'Relationship',
        targetId: 'rel-1',
      });
    });
  });

  describe('confirm', () => {
    it('throws BadRequestException (via the state machine) when already CONFIRMED — terminal, no re-review', async () => {
      prisma.relationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.CONFIRMED,
      });

      await expect(service.confirm('t1', 'u1', 'rel-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.relationship.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when there is no evidence citation at all', async () => {
      prisma.relationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.SUGGESTED,
      });
      prisma.relationshipEvidenceLink.count.mockResolvedValue(0);

      await expect(service.confirm('t1', 'u1', 'rel-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.relationship.update).not.toHaveBeenCalled();
    });

    it('confirms with the acting user attributed, and logs CONFIRM_RELATIONSHIP', async () => {
      prisma.relationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.SUGGESTED,
      });
      prisma.relationshipEvidenceLink.count.mockResolvedValue(1);
      prisma.relationship.update.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.CONFIRMED,
      });

      const result = await service.confirm('t1', 'u1', 'rel-1');

      expect(result.status).toBe(RelationshipStatus.CONFIRMED);
      expect(prisma.relationship.update).toHaveBeenCalledWith({
        where: { id: 'rel-1' },
        data: expect.objectContaining({
          status: RelationshipStatus.CONFIRMED,
          confirmedByUserId: 'u1',
        }),
      });
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.CONFIRM_RELATIONSHIP,
        targetType: 'Relationship',
        targetId: 'rel-1',
      });
    });
  });

  describe('reject', () => {
    it('rejects a SUGGESTED relationship and logs REJECT_RELATIONSHIP — kept, not deleted', async () => {
      prisma.relationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.SUGGESTED,
      });
      prisma.relationship.update.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.REJECTED,
      });

      const result = await service.reject('t1', 'u1', 'rel-1');

      expect(result.status).toBe(RelationshipStatus.REJECTED);
      expect(auditLog.record).toHaveBeenCalledWith('t1', 'u1', {
        action: AuditAction.REJECT_RELATIONSHIP,
        targetType: 'Relationship',
        targetId: 'rel-1',
      });
    });

    it('throws BadRequestException when the relationship is already terminal', async () => {
      prisma.relationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        status: RelationshipStatus.REJECTED,
      });

      await expect(service.reject('t1', 'u1', 'rel-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
