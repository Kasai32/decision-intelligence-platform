import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Entity, Prisma, Relationship } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { SearchEntitiesDto } from './dto/search-entities.dto';
import { SearchNearbyDto } from './dto/search-nearby.dto';
import { haversineDistanceKm } from './geospatial';

export interface EntityGraph {
  entity: Entity;
  relationships: (Relationship & { fromEntity: Entity; toEntity: Entity })[];
}

export type LocatedEntity = Entity & { latitude: number; longitude: number };
export type NearbyEntity = LocatedEntity & { distanceKm: number };

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
        latitude: dto.latitude,
        longitude: dto.longitude,
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

  /**
   * Geospatial search (see ADR-0022) — "mapping where things happened".
   * Filters/sorts by real distance from a point, computed in application
   * code (Haversine), not a PostGIS query — see geospatial.ts for why
   * that's the right scope at this stage. `reason` is required, same
   * purpose-limitation rule as `search()`.
   */
  async searchNearby(
    tenantId: string,
    actorUserId: string,
    dto: SearchNearbyDto,
  ): Promise<NearbyEntity[]> {
    const candidates = await this.prisma.entity.findMany({
      where: {
        tenantId,
        type: dto.type,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    const results = (candidates as LocatedEntity[])
      .map((entity) => ({
        ...entity,
        distanceKm: haversineDistanceKm(
          dto.latitude,
          dto.longitude,
          entity.latitude,
          entity.longitude,
        ),
      }))
      .filter((entity) => entity.distanceKm <= dto.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.SEARCH,
      reason: dto.reason,
      metadata: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusKm: dto.radiusKm,
        type: dto.type ?? null,
        resultCount: results.length,
      },
    });

    return results;
  }

  /** Every entity with coordinates, for rendering on a map (see ADR-0022) — no radius filter. */
  async getMap(tenantId: string, actorUserId: string, reason: string): Promise<LocatedEntity[]> {
    const entities = await this.prisma.entity.findMany({
      where: { tenantId, latitude: { not: null }, longitude: { not: null } },
      orderBy: { name: 'asc' },
    });

    await this.auditLog.record(tenantId, actorUserId, {
      action: AuditAction.VIEW_MAP,
      reason,
      metadata: { resultCount: entities.length },
    });

    return entities as LocatedEntity[];
  }

  private async getEntityOrThrow(tenantId: string, id: string): Promise<Entity> {
    const entity = await this.prisma.entity.findFirst({ where: { id, tenantId } });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    return entity;
  }
}
