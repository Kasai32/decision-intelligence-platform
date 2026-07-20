import { Module } from '@nestjs/common';
import { AnthropicLlmClient } from './anthropic-llm.client';
import { LLM_CLIENT } from './llm-client.interface';

@Module({
  providers: [{ provide: LLM_CLIENT, useClass: AnthropicLlmClient }],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
