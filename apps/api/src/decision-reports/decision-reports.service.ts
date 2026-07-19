import { Injectable, NotFoundException } from '@nestjs/common';
import { Decision, DecisionReport, Prisma, TimelineEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateDecisionReportDto } from './dto/generate-decision-report.dto';

/**
 * Assembles an immutable, factual snapshot of a single decision — outcome,
 * evidence used, relevant timeline (see ADR-0011). Every field except
 * `additionalNotes` is computed from real rows at generation time.
 */
@Injectable()
export class DecisionReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    tenantId: string,
    decisionId: string,
    generatedByUserId: string,
    dto: GenerateDecisionReportDto,
  ): Promise<DecisionReport> {
    const decision = await this.getDecisionOrThrow(tenantId, decisionId);

    const [evidence, timeline] = await Promise.all([
      this.prisma.evidence.findMany({
        where: { tenantId, decisionId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.timelineEvent.findMany({
        where: { tenantId, decisionId },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    const evidenceSummary = evidence.map((item) => ({
      id: item.id,
      type: item.type,
      sourceCategory: item.sourceCategory,
      source: item.source,
      summary: item.summary,
    }));

    const timelineSummary = timeline.map((event) => ({
      type: event.type,
      description: event.description,
      occurredAt: event.occurredAt,
    }));

    const report = await this.prisma.decisionReport.create({
      data: {
        tenantId,
        decisionId,
        incidentId: decision.incidentId,
        question: decision.question,
        status: decision.status,
        humanDecision: decision.humanDecision,
        rationale: decision.rationale,
        decidedByUserId: decision.decidedByUserId,
        decidedAt: decision.decidedAt,
        evidenceSummary: evidenceSummary as unknown as Prisma.InputJsonValue,
        timelineSummary: timelineSummary as unknown as Prisma.InputJsonValue,
        additionalNotes: dto.additionalNotes,
        generatedByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId: decision.incidentId,
        decisionId,
        type: TimelineEventType.DECISION_REPORT_GENERATED,
        description: `Decision report generated for "${decision.question}"`,
        actorUserId: generatedByUserId,
        metadata: { reportId: report.id },
      },
    });

    return report;
  }

  async list(tenantId: string, decisionId: string): Promise<DecisionReport[]> {
    await this.getDecisionOrThrow(tenantId, decisionId);
    return this.prisma.decisionReport.findMany({
      where: { tenantId, decisionId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async getDecisionOrThrow(tenantId: string, id: string): Promise<Decision> {
    const decision = await this.prisma.decision.findFirst({ where: { id, tenantId } });
    if (!decision) {
      throw new NotFoundException('Decision not found');
    }
    return decision;
  }
}
