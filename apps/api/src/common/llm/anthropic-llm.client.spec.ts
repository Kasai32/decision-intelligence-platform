import { ServiceUnavailableException } from '@nestjs/common';
import { AnthropicLlmClient } from './anthropic-llm.client';

describe('AnthropicLlmClient', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it('is unavailable, and never calls the API, when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const client = new AnthropicLlmClient();

    expect(client.available).toBe(false);
    await expect(client.generateText({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports available when ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const client = new AnthropicLlmClient();

    expect(client.available).toBe(true);
  });
});
