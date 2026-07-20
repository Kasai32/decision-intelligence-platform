import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LlmClient, LlmGenerateParams } from './llm-client.interface';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_OUTPUT_TOKENS = 4096;

/**
 * Cheapest current model by default (see ADR-0018) — an AI-generated draft
 * only has to be a reasonable starting point for a human to edit, not a
 * final artifact, so there's no reason to default to a more expensive
 * model. Override via ANTHROPIC_MODEL for higher-quality drafts.
 */
@Injectable()
export class AnthropicLlmClient implements LlmClient {
  private readonly logger = new Logger(AnthropicLlmClient.name);
  private readonly client: Anthropic | null;
  private readonly model: string;
  readonly available: boolean;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.available = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

    if (!this.available) {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set — AI drafting is unavailable (see ADR-0018). ' +
          'Every existing feature works exactly as before; a human can always submit ' +
          'an analysis directly. GET /decision-intelligence/ai-status reports this.',
      );
    }
  }

  async generateText({ system, user }: LlmGenerateParams): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI drafting is not configured — set ANTHROPIC_API_KEY.',
      );
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException('The model returned no text output.');
    }
    return textBlock.text;
  }
}
