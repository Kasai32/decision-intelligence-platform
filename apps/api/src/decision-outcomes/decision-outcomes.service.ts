import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Decision,
  DecisionOutcome,
  DecisionStatus,
  IncidentStatus,
  TimelineEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecordDecisionOutcomeDto } from './dto/record-decision-outcome.dto';

/**
 * Records a human's retrospective judgment of whether a DECIDED decision
 * turned out well (see ADR-0016) — the same "not before CLOSED" gate as
 * LessonsLearnedService, and the same Principle 1 discipline as
 * DecisionsService.decide(): the outcome quality is always supplied by a
 * named human, never computed or inferred by this service.
 */
@Injectable()
export class DecisionOutcomesService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tenantId: string,
    decisionId: string,
    recordedByUserId: string,
    dto: RecordDecisionOutcomeDto,
  ): Promise<DecisionOutcome> {
    const decision = await this.getDecisionOrThrow(tenantId, decisionId);
    if (decision.status !== DecisionStatus.DECIDED) {
      throw new BadRequestException(
        `Only a DECIDED decision can have its outcome recorded (current status: ${decision.status}).`,
      );
    }

    const incident = await this.prisma.incident.findFirst({
      where: { id: decision.incidentId, tenantId },
    });
    if (!incident || incident.status !== IncidentStatus.CLOSED) {
      throw new BadRequestException(
        `Decision outcomes can only be recorded once the incident is CLOSED (current status: ${incident?.status ?? 'unknown'}).`,
      );
    }

    const existing = await this.prisma.decisionOutcome.findUnique({ where: { decisionId } });
    if (existing) {
      throw new ConflictException('An outcome has already been recorded for this decision.');
    }

    // The analysis (if any) that could actually have informed this human's
    // decision — the most recent one that existed at decision time, not
    // whatever's most recent now.
    const informingAnalysis = decision.decidedAt
      ? await this.prisma.intelligenceAnalysis.findFirst({
          where: {
            tenantId,
            incidentId: decision.incidentId,
            createdAt: { lte: decision.decidedAt },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const outcome = await this.prisma.decisionOutcome.create({
      data: {
        tenantId,
        decisionId,
        intelligenceAnalysisId: informingAnalysis?.id,
        outcomeQuality: dto.outcomeQuality,
        notes: dto.notes,
        recordedByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: decision.incidentId,
        decisionId,
        type: TimelineEventType.DECISION_OUTCOME_RECORDED,
        description: `Decision outcome recorded: ${dto.outcomeQuality}`,
        actorUserId: recordedByUserId,
        metadata: { outcomeId: outcome.id, intelligenceAnalysisId: informingAnalysis?.id ?? null },
      },
    });

    return outcome;
  }

  async findOne(tenantId: string, decisionId: string): Promise<DecisionOutcome> {
    await this.getDecisionOrThrow(tenantId, decisionId);
    const outcome = await this.prisma.decisionOutcome.findUnique({ where: { decisionId } });
    if (!outcome) {
      throw new NotFoundException('No outcome recorded for this decision');
    }
    return outcome;
  }

  private async getDecisionOrThrow(tenantId: string, id: string): Promise<Decision> {
    const decision = await this.prisma.decision.findFirst({ where: { id, tenantId } });
    if (!decision) {
      throw new NotFoundException('Decision not found');
    }
    return decision;
  }
}
