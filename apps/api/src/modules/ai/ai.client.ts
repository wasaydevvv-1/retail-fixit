import { z } from 'zod';

import { config } from '../../config/index.js';
import { logger } from '../../observability/logger.js';
import { trackExternalDependency } from '../../observability/app-insights.js';
import { aiCircuitBreaker } from './ai.circuit-breaker.js';
import { SYSTEM_PROMPT } from './ai.prompt.js';
import type { ChatMessage, InferenceResult } from './ai.types.js';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isAzureOpenAIConfigured(): boolean {
  return Boolean(
    !config.ai.useMock && config.ai.endpoint && config.ai.apiKey && config.ai.deployment,
  );
}

function chatUrl(): string {
  const base = config.ai.endpoint.replace(/\/$/, '');
  return `${base}/openai/deployments/${config.ai.deployment}/chat/completions?api-version=${config.ai.apiVersion}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCompletion(messages: ChatMessage[]): Promise<InferenceResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch(chatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.ai.apiKey,
      },
      body: JSON.stringify({
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Azure OpenAI ${res.status}: ${body.slice(0, 200)}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Azure OpenAI returned empty content');
    }

    const latencyMs = Date.now() - started;
    trackExternalDependency({
      name: 'Azure OpenAI chat/completions',
      data: chatUrl(),
      durationMs: latencyMs,
      success: true,
      resultCode: res.status,
      dependencyType: 'HTTP',
    });

    return {
      content,
      latencyMs,
      model: config.ai.deployment,
    };
  } catch (err) {
    trackExternalDependency({
      name: 'Azure OpenAI chat/completions',
      data: chatUrl(),
      durationMs: Date.now() - started,
      success: false,
      resultCode: (err as { status?: number }).status ?? 'error',
      dependencyType: 'HTTP',
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls Azure OpenAI with timeout, bounded retries, and circuit breaker. */
export async function chatCompletion(messages: ChatMessage[]): Promise<InferenceResult> {
  if (!isAzureOpenAIConfigured()) {
    throw new Error('Azure OpenAI is not configured');
  }

  if (aiCircuitBreaker.isOpen()) {
    throw new Error('AI circuit breaker is open');
  }

  let lastError: unknown;
  const maxAttempts = config.ai.maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetchCompletion(messages);
      aiCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      const retryable =
        err instanceof Error &&
        (err.name === 'AbortError' ||
          (status !== undefined && RETRYABLE_STATUS.has(status)));

      logger.warn(
        { attempt, maxAttempts, err, status, retryable },
        'Azure OpenAI request failed',
      );

      if (!retryable || attempt === maxAttempts) {
        aiCircuitBreaker.recordFailure();
        throw err;
      }

      await sleep(250 * attempt);
    }
  }

  aiCircuitBreaker.recordFailure();
  throw lastError;
}

export const openAiResponseSchema = z.object({
  summary: z.string().min(1).max(500),
  candidates: z
    .array(
      z.object({
        vendorId: z.string().min(1),
        score: z.number().min(0).max(1),
        reason: z.string().min(1).max(300),
      }),
    )
    .max(3),
});

export async function requestRecommendationJson(
  userPrompt: string,
): Promise<InferenceResult> {
  return chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
}
