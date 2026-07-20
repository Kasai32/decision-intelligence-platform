import { BadGatewayException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Incident } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LLM_CLIENT, LlmClient } from '../../common/llm/llm-client.interface';
import { SubmitIntelligenceAnalysisDto } from '../dto/submit-intelligence-analysis.dto';
import { formatValidationErrors } from '../format-validation-errors';
import { buildDraftUserPrompt, AI_DRAFT_SYSTEM_PROMPT } from './prompt';
import { extractJson } from './extract-json';

/**
 * AI drafting for the qualitative half of the AI Output Contract (see
 * ADR-0010, ADR-0018). Never persists anything and never writes a
 * TimelineEvent — a draft is not an analysis. A human must still call the
 * existing DecisionIntelligenceEngineService.analyze() to actually submit
 * one, exactly as before this feature existed.
 */
@Injectable()
export class AiDraftService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  get available(): boolean {
    return this.llm.available;
  }

  async generateDraft(
    tenantId: string,
    incidentId: string,
  ): Promise<SubmitIntelligenceAnalysisDto> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    const evidence = await this.prisma.evidence.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'asc' },
    });

    const rawText = await this.llm.generateText({
      system: AI_DRAFT_SYSTEM_PROMPT,
      user: buildDraftUserPrompt(incident, evidence),
    });

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch {
      throw new BadGatewayException('The AI model did not return valid JSON — try again.');
    }

    const draft = plainToInstance(SubmitIntelligenceAnalysisDto, parsed);
    const errors = await validate(draft, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      throw new BadGatewayException(
        `The AI model's draft did not match the required shape: ${formatValidationErrors(errors).join(', ')}`,
      );
    }

    return draft;
  }

  private async getIncidentOrThrow(tenantId: string, id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findFirst({ where: { id, tenantId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }
}
