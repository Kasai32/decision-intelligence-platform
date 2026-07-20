import { Injectable } from '@nestjs/common';
import { AuditAction, AuditLogEntry, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordAuditLogEntry {
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
}

/**
 * Append-only record of analyst activity against the intelligence graph
 * (see ADR-0021) — the concrete mechanism behind "protect civil liberties,
 * human control, not automated surveillance". Logs what the analyst did,
 * not just what the system found: who looked up whom, when, and why.
 * There is deliberately no update/delete method here, matching
 * TimelineEvent's existing immutability — an audit log that can be edited
 * by the people it audits isn't one.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tenantId: string,
    actorUserId: string,
    entry: RecordAuditLogEntry,
  ): Promise<AuditLogEntry> {
    return this.prisma.auditLogEntry.create({
      data: {
        tenantId,
        actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        reason: entry.reason,
        metadata: entry.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async query(tenantId: string, filter: AuditLogQuery): Promise<AuditLogEntry[]> {
    return this.prisma.auditLogEntry.findMany({
      where: {
        tenantId,
        actorUserId: filter.actorUserId,
        targetType: filter.targetType,
        targetId: filter.targetId,
        action: filter.action,
        occurredAt: {
          gte: filter.from,
          lte: filter.to,
        },
      },
      orderBy: { occurredAt: 'desc' },
    });
  }
}
