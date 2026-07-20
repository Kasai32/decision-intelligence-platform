import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Incident } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runInTenantContext } from '../../prisma/tenant-rls.context';
import { LLM_CLIENT, LlmClient, LlmGenerateParams } from '../../common/llm/llm-client.interface';
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
    const rawText = await this.llm.generateText(await this.buildPrompt(tenantId, incidentId));
    return this.parseAndValidate(rawText);
  }

  /**
   * Streaming counterpart of generateDraft (see ADR-0020) — split into two
   * phases so a *synchronous* failure gets a real HTTP status instead of a
   * false-started stream. Nest's SSE machinery commits response headers
   * (status 200, `text/event-stream`) on a 0ms timer unless the request
   * has already failed by then; a rejection that only happens after a real
   * DB round-trip always loses that race in practice (confirmed live,
   * repeatedly — a Postgres round-trip reliably takes longer than a 0ms
   * timer), so it always ends up reported as an in-stream `error` event
   * instead, no matter which method it's thrown from. This split therefore
   * only guarantees a clean status for the one check that genuinely needs
   * no I/O at all — `available` — which not coincidentally is also the
   * single most common real-world failure (a fresh deployment with no
   * ANTHROPIC_API_KEY set yet). `NotFoundException` from the incident
   * lookup below still reaches the user correctly, just via the in-stream
   * `error` event rather than a 404 — functionally identical from the
   * frontend's perspective (it already handles both), just not a "clean"
   * REST status for that specific case.
   *
   * Also opts out of the global per-request RLS transaction
   * (`@SkipTenantRls()` on the route — see ADR-0020): that transaction
   * would otherwise have to stay open for the entire streaming duration,
   * not just the brief DB reads this method actually needs. It
   * establishes its own tenant context narrowly around just those reads
   * instead — the same "scope RLS to only real DB calls" principle the
   * HMAC webhook route already applies for a different reason (ADR-0015).
   */
  async prepareDraftPrompt(tenantId: string, incidentId: string): Promise<LlmGenerateParams> {
    if (!this.llm.available) {
      throw new ServiceUnavailableException(
        'AI drafting is not configured — set ANTHROPIC_API_KEY.',
      );
    }
    return runInTenantContext(this.prisma, tenantId, () => this.buildPrompt(tenantId, incidentId));
  }

  /** The actual LLM call — only ever entered after prepareDraftPrompt has already succeeded. */
  async *streamDraftText(prompt: LlmGenerateParams): AsyncGenerator<string, void, void> {
    yield* this.llm.generateTextStream(prompt);
  }

  /** Parses/validates the full text a streamed draft accumulated to — same rules as generateDraft. */
  async validateDraftText(rawText: string): Promise<SubmitIntelligenceAnalysisDto> {
    return this.parseAndValidate(rawText);
  }

  private async buildPrompt(
    tenantId: string,
    incidentId: string,
  ): Promise<{ system: string; user: string }> {
    const incident = await this.getIncidentOrThrow(tenantId, incidentId);
    const evidence = await this.prisma.evidence.findMany({
      where: { tenantId, incidentId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      system: AI_DRAFT_SYSTEM_PROMPT,
      user: buildDraftUserPrompt(incident, evidence),
    };
  }

  private async parseAndValidate(rawText: string): Promise<SubmitIntelligenceAnalysisDto> {
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
