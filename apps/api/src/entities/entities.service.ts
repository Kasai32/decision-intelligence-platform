import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Entity, Prisma, Relationship } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { SearchEntitiesDto } from './dto/search-entities.dto';

export interface EntityGraph {
  entity: Entity;
  relationships: (Relationship & { fromEntity: Entity; toEntity: Entity })[];
}

/**
 * The intelligence graph's nodes (see ADR-0021). Every entity must cite
 * the evidence it was identified from — "never a bare assertion", the
 * same rule the confidence breakdowns (ADR-0019) already follow. Every
 * read here is logged to AuditLogService — the mechanism that makes
 * "human analysts in control, not automated surveillance" concrete
 * rather than a slogan.
 */
@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(tenantId: string, actorUserId: string, dto: CreateEntityDto): Promise<Entity> {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: dto.evidenceId, tenantId },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const entity = await this.prisma.entity.create({
      data: {
        tenantId,
        type: dto.type,
        name: dto.name,
        aliases: dto.aliases ?? [],
        attributes: dto.attributes as Prisma.InputJsonValue,
        evidenceLinks: {
          create: {
            tenantId,
            evidenceId: dto.evidenceId,
            extractedText: dto.extractedText,
          },
        },
      },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.CREATE_ENTITY,
      targetType: 'Entity',
      targetId: entity.id,
    });

    return entity;
  }

  async search(tenantId: string, actorUserId: string, dto: SearchEntitiesDto): Promise<Entity[]> {
    const results = await this.prisma.entity.findMany({
      where: {
        tenantId,
        type: dto.type,
        name: dto.query ? { contains: dto.query, mode: 'insensitive' } : undefined,
      },
      orderBy: { name: 'asc' },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.SEARCH,
      reason: dto.reason,
      metadata: { query: dto.query ?? null, type: dto.type ?? null, resultCount: results.length },
    });

    return results;
  }

  async findOne(
    tenantId: string,
    actorUserId: string,
    id: string,
    reason: string,
  ): Promise<Entity> {
    const entity = await this.getEntityOrThrow(tenantId, id);

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.VIEW_ENTITY,
      targetType: 'Entity',
      targetId: id,
      reason,
    });

    return entity;
  }

  /** One-hop graph: the entity plus every relationship it's a party to, with the connected entities resolved. */
  async getGraph(
    tenantId: string,
    actorUserId: string,
    id: string,
    reason: string,
  ): Promise<EntityGraph> {
    const entity = await this.getEntityOrThrow(tenantId, id);
    const relationships = await this.prisma.relationship.findMany({
      where: { tenantId, OR: [{ fromEntityId: id }, { toEntityId: id }] },
      include: { fromEntity: true, toEntity: true },
      orderBy: { createdAt: 'asc' },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.VIEW_GRAPH,
      targetType: 'Entity',
      targetId: id,
      reason,
      metadata: { relationshipCount: relationships.length },
    });

    return { entity, relationships };
  }

  private async getEntityOrThrow(tenantId: string, id: string): Promise<Entity> {
    const entity = await this.prisma.entity.findFirst({ where: { id, tenantId } });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    return entity;
  }
}
