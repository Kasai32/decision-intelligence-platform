import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Relationship, RelationshipStatus } from '@prisma/client';
import { assertValidTransition } from '../common/state-machine/state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { RELATIONSHIP_TRANSITIONS } from './relationship.state-machine';

/**
 * The intelligence graph's edges (see ADR-0021). Always created SUGGESTED
 * — Principle 1 (ADR-0007) extended from decisions to connections: even
 * an analyst who cites real evidence when creating one hasn't thereby
 * confirmed it, confirming is a separate, explicit act. A relationship
 * can never reach CONFIRMED with zero evidence citations, checked here,
 * not just documented in the schema.
 */
@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    dto: CreateRelationshipDto,
  ): Promise<Relationship> {
    const [fromEntity, toEntity, evidence] = await Promise.all([
      this.prisma.entity.findFirst({ where: { id: dto.fromEntityId, tenantId } }),
      this.prisma.entity.findFirst({ where: { id: dto.toEntityId, tenantId } }),
      this.prisma.evidence.findFirst({ where: { id: dto.evidenceId, tenantId } }),
    ]);
    if (!fromEntity || !toEntity) {
      throw new NotFoundException('Entity not found');
    }
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const relationship = await this.prisma.relationship.create({
      data: {
        tenantId,
        fromEntityId: dto.fromEntityId,
        toEntityId: dto.toEntityId,
        type: dto.type,
        label: dto.label,
        evidenceLinks: {
          create: { tenantId, evidenceId: dto.evidenceId },
        },
      },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.CREATE_RELATIONSHIP,
      targetType: 'Relationship',
      targetId: relationship.id,
    });

    return relationship;
  }

  async confirm(tenantId: string, actorUserId: string, id: string): Promise<Relationship> {
    const relationship = await this.getRelationshipOrThrow(tenantId, id);
    assertValidTransition(
      'Relationship',
      RELATIONSHIP_TRANSITIONS,
      relationship.status,
      RelationshipStatus.CONFIRMED,
    );

    const evidenceCount = await this.prisma.relationshipEvidenceLink.count({
      where: { tenantId, relationshipId: id },
    });
    if (evidenceCount === 0) {
      throw new BadRequestException(
        'A relationship cannot be confirmed without at least one evidence citation',
      );
    }

    const updated = await this.prisma.relationship.update({
      where: { id },
      data: {
        status: RelationshipStatus.CONFIRMED,
        confirmedByUserId: actorUserId,
        confirmedAt: new Date(),
      },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.CONFIRM_RELATIONSHIP,
      targetType: 'Relationship',
      targetId: id,
    });

    return updated;
  }

  async reject(tenantId: string, actorUserId: string, id: string): Promise<Relationship> {
    const relationship = await this.getRelationshipOrThrow(tenantId, id);
    assertValidTransition(
      'Relationship',
      RELATIONSHIP_TRANSITIONS,
      relationship.status,
      RelationshipStatus.REJECTED,
    );

    const updated = await this.prisma.relationship.update({
      where: { id },
      data: { status: RelationshipStatus.REJECTED },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.REJECT_RELATIONSHIP,
      targetType: 'Relationship',
      targetId: id,
    });

    return updated;
  }

  private async getRelationshipOrThrow(tenantId: string, id: string): Promise<Relationship> {
    const relationship = await this.prisma.relationship.findFirst({ where: { id, tenantId } });
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }
    return relationship;
  }
}
