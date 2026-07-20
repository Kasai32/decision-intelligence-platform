import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  RequestMethod,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { SkipTenantRls } from '../common/decorators/skip-tenant-rls.decorator';
import { AiDraftService } from './ai-draft/ai-draft.service';
import { DecisionIntelligenceEngineService } from './decision-intelligence-engine.service';
import { SubmitIntelligenceAnalysisDto } from './dto/submit-intelligence-analysis.dto';

@ApiTags('decision-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents/:incidentId')
export class DecisionIntelligenceEngineController {
  constructor(
    private readonly engine: DecisionIntelligenceEngineService,
    private readonly aiDraft: AiDraftService,
  ) {}

  @Post('analyze')
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
    @Body() dto: SubmitIntelligenceAnalysisDto,
  ) {
    return this.engine.analyze(user.tenantId, incidentId, user.userId, dto);
  }

  @Get('analyses')
  list(@CurrentUser() user: AuthenticatedUser, @Param('incidentId') incidentId: string) {
    return this.engine.list(user.tenantId, incidentId);
  }

  /**
   * Returns an unsaved, AI-generated draft of the qualitative fields
   * `analyze()` accepts — never persisted, never a TimelineEvent. A human
   * must still review/edit and call POST analyze to actually submit one
   * (see ADR-0018).
   */
  @Post('analyze/draft')
  generateDraft(@CurrentUser() user: AuthenticatedUser, @Param('incidentId') incidentId: string) {
    return this.aiDraft.generateDraft(user.tenantId, incidentId);
  }

  /**
   * Streaming counterpart of `analyze/draft` (see ADR-0020) — emits the raw
   * model text as it's generated (untyped `data:` events, for a live
   * "drafting…" UI), then one final `result` event carrying the same
   * validated draft `analyze/draft` would have returned.
   *
   * `prepareDraftPrompt` is awaited *before* returning the Observable, so
   * an AI-unavailable failure (no ANTHROPIC_API_KEY — the single most
   * common real-world case) surfaces as a normal HTTP 503, exactly like
   * the non-streaming endpoint. An incident-not-found failure still
   * reaches the client correctly, but as an in-stream `error` event rather
   * than a 404 — see `AiDraftService.prepareDraftPrompt`'s doc comment for
   * why that specific case can't reliably get a clean status. Either way
   * the frontend already handles both delivery paths identically.
   */
  @Sse('analyze/draft/stream', { method: RequestMethod.POST })
  @SkipTenantRls()
  async streamDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('incidentId') incidentId: string,
  ): Promise<Observable<MessageEvent>> {
    const prompt = await this.aiDraft.prepareDraftPrompt(user.tenantId, incidentId);

    return new Observable<MessageEvent>((subscriber) => {
      let fullText = '';
      (async () => {
        for await (const chunk of this.aiDraft.streamDraftText(prompt)) {
          fullText += chunk;
          subscriber.next({ data: chunk });
        }
        const draft = await this.aiDraft.validateDraftText(fullText);
        subscriber.next({ type: 'result', data: draft });
        subscriber.complete();
      })().catch((err: unknown) => subscriber.error(err));
    });
  }
}
