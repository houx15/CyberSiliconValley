import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export function getModel() {
  const provider = process.env.AI_PROVIDER || 'anthropic';

  if (provider === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });
    return anthropic(process.env.AI_MODEL || 'claude-sonnet-4-20250514');
  }

  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  return openai(process.env.AI_MODEL || 'gpt-4o');
}

export function getEmbeddingModel() {
  const openai = createOpenAI({
    apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL,
  });
  return openai.embedding(process.env.EMBEDDING_MODEL || 'text-embedding-3-small');
}
