import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EvidenceSourceCategory,
  Incident,
  IntelligenceAnalysis,
  Prisma,
  TimelineEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeAiCertainty } from './scoring/ai-certainty';
import { computeDataFreshness } from './scoring/data-freshness';
import {
  computeEvidenceCompleteness,
  REQUIRED_EVIDENCE_SOURCES,
} from './scoring/evidence-completeness';
import { computeSourceReliability } from './scoring/source-reliability';
import { AIOutputContractDto } from './dto/ai-output-contract.dto';
import { SubmitIntelligenceAnalysisDto } from './dto/submit-intelligence-analysis.dto';
import { formatValidationErrors } from './format-validation-errors';

@Injectable()
export class DecisionIntelligenceEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes the four confidence dimensions from the incident's real
   * Evidence rows, assembles the full AI Output Contract by combining them
   * with the caller-supplied qualitative fields, validates the assembled
   * object against AIOutputContractDto, persists it, and records a
   * TimelineEvent. See ADR-0010.
   */
  async analyze(
    tenantId: string,
    incidentId: string,
    submittedByUserId: string,
    dto: SubmitIntelligenceAnalysisDto,
    now: Date = new Date(),
  ): Promise<AIOutputContractDto> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    const evidence = await this.prisma.evidence.findMany({ where: { tenantId, incidentId } });

    const presentCategories = evidence.map((item) => item.sourceCategory);
    const uniqueCategoryCount = new Set(presentCategories).size;

    const confidenceDimensions = {
      evidenceCompleteness: computeEvidenceCompleteness(incident.type, presentCategories),
      sourceReliability: computeSourceReliability(presentCategories),
      dataFreshness: computeDataFreshness(evidence, incident.severity, now),
      aiCertainty: computeAiCertainty(
        evidence.length,
        uniqueCategoryCount,
        dto.conflictingInformation.length,
      ),
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

    return assembled;
  }

  async list(tenantId: string, incidentId: string): Promise<IntelligenceAnalysis[]> {
    await this.getIncidentOrThrow(tenantId, incidentId);
    return this.prisma.intelligenceAnalysis.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'desc' },
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
