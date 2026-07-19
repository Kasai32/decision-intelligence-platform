import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Decision, DecisionStatus, TimelineEventType } from '@prisma/client';
import { assertValidTransition } from '../common/state-machine/state-machine';
import { IntegrationsRegistryService } from '../integrations/integrations-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { DECISION_TRANSITIONS } from './decision.state-machine';
import { DecideDecisionDto } from './dto/decide-decision.dto';
import { OpenDecisionDto } from './dto/open-decision.dto';

@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsRegistryService,
  ) {}

  async open(tenantId: string, createdByUserId: string, dto: OpenDecisionDto): Promise<Decision> {
    const incident = await this.prisma.incident.findFirst({
      where: { id: dto.incidentId, tenantId },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const decision = await this.prisma.decision.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        question: dto.question,
        createdByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: dto.incidentId,
        decisionId: decision.id,
        type: TimelineEventType.DECISION_OPENED,
        description: `Decision opened: "${dto.question}"`,
        actorUserId: createdByUserId,
      },
    });

    return decision;
  }

  async findOne(tenantId: string, id: string): Promise<Decision> {
    return this.getDecisionOrThrow(tenantId, id);
  }

  /**
   * Principle 1 (see ADR-0007): the ONLY way a Decision becomes DECIDED.
   * Requires a structurally valid OPEN -> DECIDED transition AND a real,
   * tenant-scoped human named in `decidedByUserId` — never an inference,
   * never a default, never something the AI/system fills in on its own.
   */
  async decide(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: DecideDecisionDto,
  ): Promise<Decision> {
    const decision = await this.getDecisionOrThrow(tenantId, id);
    assertValidTransition(
      'Decision',
      DECISION_TRANSITIONS,
      decision.status,
      DecisionStatus.DECIDED,
    );

    const stakeholderMembership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: dto.decidedByUserId, tenantId } },
    });
    if (!stakeholderMembership) {
      throw new BadRequestException(
        'decidedByUserId must name a real member of this tenant — a Decision cannot be marked ' +
          'DECIDED without an explicitly named human stakeholder (Principle 1: the AI decides nothing alone).',
      );
    }

    const updated = await this.prisma.decision.update({
      where: { id },
      data: {
        status: DecisionStatus.DECIDED,
        humanDecision: dto.humanDecision,
        rationale: dto.rationale,
        decidedByUserId: dto.decidedByUserId,
        decidedAt: new Date(),
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: decision.incidentId,
        decisionId: id,
        type: TimelineEventType.DECISION_DECIDED,
        description: `Decision decided: "${dto.humanDecision}"`,
        actorUserId,
        metadata: { decidedByUserId: dto.decidedByUserId },
      },
    });

    await this.integrations.broadcast('decisionDecided', {
      tenantId,
      incidentId: decision.incidentId,
      summary: dto.humanDecision,
      metadata: { decisionId: id, decidedByUserId: dto.decidedByUserId },
    });

    return updated;
  }

  async cancel(tenantId: string, actorUserId: string, id: string): Promise<Decision> {
    const decision = await this.getDecisionOrThrow(tenantId, id);
    assertValidTransition(
      'Decision',
      DECISION_TRANSITIONS,
      decision.status,
      DecisionStatus.CANCELLED,
    );

    const updated = await this.prisma.decision.update({
      where: { id },
      data: { status: DecisionStatus.CANCELLED },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: decision.incidentId,
        decisionId: id,
        type: TimelineEventType.DECISION_CANCELLED,
        description: 'Decision cancelled',
        actorUserId,
      },
    });

    return updated;
  }

  private async getDecisionOrThrow(tenantId: string, id: string): Promise<Decision> {
    const decision = await this.prisma.decision.findFirst({ where: { id, tenantId } });
    if (!decision) {
      throw new NotFoundException('Decision not found');
    }
    return decision;
  }
}
