import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export function getModel() {
  const provider = process.env.AI_PROVIDER || 'anthropic';

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    return anthropic('claude-sonnet-4-20250514');
  }

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  return openai('gpt-4o');
}

export function getEmbeddingModel() {
  // Embeddings always use OpenAI-compatible API
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  return openai.embedding('text-embedding-3-small');
}
