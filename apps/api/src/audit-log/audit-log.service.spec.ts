import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let prisma: { auditLogEntry: { create: jest.Mock; findMany: jest.Mock } };
  let service: AuditLogService;

  beforeEach(() => {
    prisma = { auditLogEntry: { create: jest.fn(), findMany: jest.fn() } };
    service = new AuditLogService(prisma as unknown as PrismaService);
  });

  it('records an entry with the given tenant, actor, action, and reason', async () => {
    prisma.auditLogEntry.create.mockResolvedValue({ id: 'log-1' });

    await service.record('t1', 'u1', {
      action: AuditAction.VIEW_ENTITY,
      targetType: 'Entity',
      targetId: 'e1',
      reason: 'investigating fraud case #4',
    });

    expect(prisma.auditLogEntry.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        actorUserId: 'u1',
        action: AuditAction.VIEW_ENTITY,
        targetType: 'Entity',
        targetId: 'e1',
        reason: 'investigating fraud case #4',
        metadata: undefined,
      },
    });
  });

  it('queries entries scoped to the tenant with the given filters, newest first', async () => {
    prisma.auditLogEntry.findMany.mockResolvedValue([{ id: 'log-1' }]);

    const result = await service.query('t1', { actorUserId: 'u1' });

    expect(prisma.auditLogEntry.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        actorUserId: 'u1',
        targetType: undefined,
        targetId: undefined,
        action: undefined,
        occurredAt: { gte: undefined, lte: undefined },
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'log-1' }]);
  });
});
