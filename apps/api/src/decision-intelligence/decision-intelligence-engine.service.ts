import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  Evidence,
  EvidenceSourceCategory,
  Incident,
  IntelligenceAnalysis,
  Prisma,
  TimelineEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildConfidenceBreakdown, ConfidenceBreakdown } from './confidence-breakdown';
import { REQUIRED_EVIDENCE_SOURCES } from './scoring/evidence-completeness';
import { AIOutputContractDto } from './dto/ai-output-contract.dto';
import { SubmitIntelligenceAnalysisDto } from './dto/submit-intelligence-analysis.dto';
import { formatValidationErrors } from './format-validation-errors';

export type IntelligenceAnalysisWithBreakdown = IntelligenceAnalysis & {
  confidenceBreakdown: ConfidenceBreakdown;
};

@Injectable()
export class DecisionIntelligenceEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes the four confidence dimensions from the incident's real
   * Evidence rows, assembles the full AI Output Contract by combining them
   * with the caller-supplied qualitative fields, validates the assembled
   * object against AIOutputContractDto, persists it, and records a
   * TimelineEvent. See ADR-0010. Returns the persisted row (the same flat
   * shape `list()` below returns) plus a `confidenceBreakdown` — the
   * "show your work" trace behind each dimension (see ADR-0019) — not the
   * `AIOutputContractDto` used only to validate the assembled contract
   * before writing it — the two used to disagree (dimensions nested here,
   * flat in `list()`), a real inconsistency found while building the
   * `apps/web` Decision Intelligence tab (see DECISION_LOG.md, 2026-07-20).
   */
  async analyze(
    tenantId: string,
    incidentId: string,
    submittedByUserId: string,
    dto: SubmitIntelligenceAnalysisDto,
    now: Date = new Date(),
  ): Promise<IntelligenceAnalysisWithBreakdown> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    const evidence = await this.prisma.evidence.findMany({ where: { tenantId, incidentId } });
    const presentCategories = evidence.map((item) => item.sourceCategory);

    const confidenceBreakdown = buildConfidenceBreakdown(
      incident.type,
      incident.severity,
      evidence,
      dto.conflictingInformation.length,
      now,
    );
    const confidenceDimensions = {
      evidenceCompleteness: confidenceBreakdown.evidenceCompleteness.score,
      sourceReliability: confidenceBreakdown.sourceReliability.score,
      dataFreshness: confidenceBreakdown.dataFreshness.score,
      aiCertainty: confidenceBreakdown.aiCertainty.score,
    };

    const missingInformation = this.computeMissingEvidence(incident, presentCategories);

    const assembled = plainToInstance(AIOutputContractDto, {
      ...dto,
      evidenceUsed: evidence.map((item) => item.id),
      missingInformation,
      confidenceDimensions,
    });

    const errors = await validate(assembled, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadRequestException(formatValidationErrors(errors));
    }

    const created = await this.prisma.intelligenceAnalysis.create({
      data: {
        tenantId,
        incidentId,
        evidenceCompleteness: confidenceDimensions.evidenceCompleteness,
        sourceReliability: confidenceDimensions.sourceReliability,
        dataFreshness: confidenceDimensions.dataFreshness,
        aiCertainty: confidenceDimensions.aiCertainty,
        evidenceUsed: assembled.evidenceUsed,
        missingInformation: assembled.missingInformation,
        situationSummary: dto.situationSummary,
        businessImpact: dto.businessImpact as unknown as Prisma.InputJsonValue,
        criticalRisks: dto.criticalRisks as unknown as Prisma.InputJsonValue,
        conflictingInformation: dto.conflictingInformation,
        recommendedDecision: dto.recommendedDecision as unknown as Prisma.InputJsonValue,
        alternativeDecisions: dto.alternativeDecisions as unknown as Prisma.InputJsonValue,
        expectedConsequences: dto.expectedConsequences,
        immediateNextActions: dto.immediateNextActions,
        executiveSummary: dto.executiveSummary,
        submittedByUserId,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        tenantId,
        incidentId,
        type: TimelineEventType.INTELLIGENCE_ANALYSIS_GENERATED,
        description:
          `Intelligence analysis generated — completeness ${confidenceDimensions.evidenceCompleteness}%, ` +
          `reliability ${confidenceDimensions.sourceReliability}%, freshness ${confidenceDimensions.dataFreshness}%, ` +
          `certainty ${confidenceDimensions.aiCertainty}%`,
        actorUserId: submittedByUserId,
        metadata: { analysisId: created.id },
      },
    });

    return { ...created, confidenceBreakdown };
  }

  async list(tenantId: string, incidentId: string): Promise<IntelligenceAnalysisWithBreakdown[]> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    const analyses = await this.prisma.intelligenceAnalysis.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'desc' },
    });
    if (analyses.length === 0) {
      return [];
    }

    // One batched query for every analysis's evidence, instead of N — each
    // analysis's evidenceUsed is a frozen snapshot of real Evidence ids.
    const evidenceIds = Array.from(new Set(analyses.flatMap((a) => a.evidenceUsed)));
    const evidenceRows =
      evidenceIds.length > 0
        ? await this.prisma.evidence.findMany({ where: { tenantId, id: { in: evidenceIds } } })
        : [];
    const evidenceById = new Map(evidenceRows.map((item) => [item.id, item]));

    return analyses.map((analysis) => {
      const evidenceForAnalysis = analysis.evidenceUsed
        .map((id) => evidenceById.get(id))
        .filter((item): item is Evidence => item !== undefined);

      // now = the analysis's own createdAt, not the live clock: dataFreshness
      // was frozen at that instant when it was persisted, and must always
      // recompute to that exact same number, not a lower one that keeps
      // dropping every time an old analysis is viewed later (see ADR-0019).
      const confidenceBreakdown = buildConfidenceBreakdown(
        incident.type,
        incident.severity,
        evidenceForAnalysis,
        analysis.conflictingInformation.length,
        analysis.createdAt,
      );

      return { ...analysis, confidenceBreakdown };
    });
  }

  /** The evidence-completeness gap, in human-readable form — always computed, never supplied. */
  private computeMissingEvidence(
    incident: Incident,
    presentCategories: EvidenceSourceCategory[],
  ): string[] {
    const present = new Set(presentCategories);
    return REQUIRED_EVIDENCE_SOURCES[incident.type]
      .filter((category) => !present.has(category))
      .map((category) => `Missing evidence source: ${category}`);
  }

  private async getIncidentOrThrow(tenantId: string, id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
