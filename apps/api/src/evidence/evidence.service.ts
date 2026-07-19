import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Evidence, TimelineEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    submittedByUserId: string | null,
    dto: CreateEvidenceDto,
  ): Promise<Evidence> {
    const incident = await this.prisma.incident.findFirst({
      where: { id: dto.incidentId, tenantId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (dto.decisionId) {
      const decision = await this.prisma.decision.findFirst({
        where: { id: dto.decisionId, tenantId, incidentId: dto.incidentId },
      });
      if (!decision) {
        throw new BadRequestException('decisionId must belong to the given incident');
      }
    }

    const evidence = await this.prisma.evidence.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        decisionId: dto.decisionId,
        type: dto.type,
        sourceCategory: dto.sourceCategory,
        source: dto.source,
        summary: dto.summary,
        url: dto.url,
        submittedByUserId: submittedByUserId ?? undefined,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        decisionId: dto.decisionId,
        type: TimelineEventType.EVIDENCE_ADDED,
        description: `Evidence added from ${dto.source}: ${dto.summary}`,
        actorUserId: submittedByUserId ?? undefined,
      },
    });

    return evidence;
  }

  async findOne(tenantId: string, id: string): Promise<Evidence> {
    const evidence = await this.prisma.evidence.findFirst({ where: { id, tenantId } });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }
    return evidence;
  }
}
