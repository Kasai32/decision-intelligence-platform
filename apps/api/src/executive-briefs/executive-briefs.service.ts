import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionStatus,
  DecisionStatus,
  ExecutiveBrief,
  Incident,
  Prisma,
  TimelineEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateExecutiveBriefDto } from './dto/generate-executive-brief.dto';

/**
 * Assembles an immutable, factual snapshot of an incident (see ADR-0011).
 * Every field except `additionalNotes` is computed from real rows at
 * generation time — the `summary` is a small deterministic template over
 * real counts, never fabricated narrative (no LLM integration exists here).
 */
@Injectable()
export class ExecutiveBriefsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    tenantId: string,
    incidentId: string,
    generatedByUserId: string,
    dto: GenerateExecutiveBriefDto,
  ): Promise<ExecutiveBrief> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);

    const [decisions, openActions, latestAnalysis] = await Promise.all([
      this.prisma.decision.findMany({
        where: { tenantId, incidentId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.action.findMany({
        where: {
          tenantId,
          incidentId,
          status: { in: [ActionStatus.PENDING, ActionStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.intelligenceAnalysis.findFirst({
        where: { tenantId, incidentId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const decidedCount = decisions.filter((d) => d.status === DecisionStatus.DECIDED).length;
    const summary =
      `Incident "${incident.title}" is currently ${incident.status} (${incident.severity} severity). ` +
      `${decidedCount} of ${decisions.length} decision(s) made.`;

    const keyDecisions = decisions.map((d) => ({
      id: d.id,
      question: d.question,
      status: d.status,
      humanDecision: d.humanDecision,
      decidedByUserId: d.decidedByUserId,
      decidedAt: d.decidedAt,
    }));

    const nextActions = openActions.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      assignedToUserId: a.assignedToUserId,
      dueAt: a.dueAt,
    }));

    const brief = await this.prisma.executiveBrief.create({
      data: {
        tenantId,
        incidentId,
        title: `Executive Brief — ${incident.title}`,
        incidentStatus: incident.status,
        incidentSeverity: incident.severity,
        summary,
        businessImpact: latestAnalysis
          ? (latestAnalysis.businessImpact as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        keyDecisions: keyDecisions as unknown as Prisma.InputJsonValue,
        openRisks: latestAnalysis
          ? (latestAnalysis.criticalRisks as Prisma.InputJsonValue)
          : ([] as unknown as Prisma.InputJsonValue),
        nextActions: nextActions as unknown as Prisma.InputJsonValue,
        additionalNotes: dto.additionalNotes,
        generatedByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId,
        type: TimelineEventType.EXECUTIVE_BRIEF_GENERATED,
        description: `Executive brief generated (${decidedCount}/${decisions.length} decisions made)`,
        actorUserId: generatedByUserId,
        metadata: { briefId: brief.id },
      },
    });

    return brief;
  }

  async list(tenantId: string, incidentId: string): Promise<ExecutiveBrief[]> {
    await this.getIncidentOrThrow(tenantId, incidentId);
    return this.prisma.executiveBrief.findMany({
      where: { tenantId, incidentId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async getIncidentOrThrow(tenantId: string, id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
