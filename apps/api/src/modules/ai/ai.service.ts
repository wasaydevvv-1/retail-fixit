import type { AIRecommendation, Job, Vendor } from '@retailfixit/shared';
import { AuditAction } from '@retailfixit/shared';

import { logger } from '../../observability/logger.js';
import { incrementCounter, recordMetric } from '../../observability/metrics.js';
import { recordAudit } from '../audit/audit.service.js';
import { findJobById, updateJobAiSummary } from '../jobs/jobs.repository.js';
import { findAssignableVendors } from '../vendors/vendors.repository.js';
import {
  isAzureOpenAIConfigured,
  openAiResponseSchema,
  requestRecommendationJson,
} from './ai.client.js';
import { aiCircuitBreaker } from './ai.circuit-breaker.js';
import { buildFallbackRecommendation } from './ai.fallback.js';
import { PROMPT_VERSION, buildRecommendationPrompt } from './ai.prompt.js';
import { previewText } from './ai.redact.js';
import { findRecommendationByJobId, saveRecommendation } from './recommendations.repository.js';

export async function generateRecommendation(
  tenantId: string,
  jobId: string,
  correlationId?: string,
): Promise<AIRecommendation> {
  const existing = await findRecommendationByJobId(tenantId, jobId);
  if (existing) return existing;

  const job = await findJobById(tenantId, jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found for recommendation`);
  }

  const vendors = await findAssignableVendors(tenantId, job.requiredSkills ?? []);
  const started = Date.now();
  const prompt = buildRecommendationPrompt(job, vendors);

  let recommendation: AIRecommendation;
  let summary: string | undefined;
  let rawResponse: string | undefined;

  if (shouldUseOpenAI()) {
    try {
      const result = await inferWithOpenAI(tenantId, job, vendors, prompt);
      recommendation = result.recommendation;
      summary = result.summary;
      rawResponse = result.rawResponse;
    } catch (err) {
      logger.warn({ err, jobId, tenantId, correlationId }, 'OpenAI inference failed — using fallback');
      recommendation = buildFallbackRecommendation(tenantId, job, vendors);
      recommendation.latencyMs = Date.now() - started;
      recommendation.usedFallback = true;
    }
  } else {
    recommendation = buildFallbackRecommendation(tenantId, job, vendors);
    recommendation.latencyMs = Date.now() - started;
    recommendation.usedFallback = true;
  }

  recordMetric('ai_latency_ms', recommendation.latencyMs, {
    tenantId,
    model: recommendation.model,
    usedFallback: String(recommendation.usedFallback),
  });

  if (recommendation.usedFallback) {
    incrementCounter('ai_fallback_total', {
      tenantId,
      reason: shouldUseOpenAI() ? 'openai_error' : 'not_configured',
    });
  } else {
    incrementCounter('ai_success_total', { tenantId, model: recommendation.model });
  }

  await saveRecommendation(recommendation);

  if (summary) {
    await updateJobAiSummary(tenantId, jobId, summary);
  }

  const promptPreview = previewText(prompt);
  const responsePreview = rawResponse ? previewText(rawResponse, 500) : undefined;

  logger.info(
    {
      jobId,
      tenantId,
      correlationId,
      model: recommendation.model,
      usedFallback: recommendation.usedFallback,
      latencyMs: recommendation.latencyMs,
      candidateCount: recommendation.candidates.length,
      promptVersion: PROMPT_VERSION,
      promptPreview,
      responsePreview,
      topCandidateId: recommendation.candidates[0]?.vendorId,
      topScore: recommendation.candidates[0]?.score,
    },
    'AI recommendation generated',
  );

  await recordAudit({
    tenantId,
    action: AuditAction.AiRecommendationGenerated,
    actorId: 'system:ai',
    subject: `job:${jobId}`,
    metadata: {
      recommendationId: recommendation.id,
      correlationId,
      model: recommendation.model,
      usedFallback: recommendation.usedFallback,
      latencyMs: recommendation.latencyMs,
      candidateCount: recommendation.candidates.length,
      promptVersion: PROMPT_VERSION,
      promptPreview,
      responsePreview,
      summaryPreview: summary ? previewText(summary, 200) : undefined,
    },
  });

  return recommendation;
}

function shouldUseOpenAI(): boolean {
  if (!isAzureOpenAIConfigured()) return false;
  if (aiCircuitBreaker.isOpen()) {
    logger.warn('AI circuit breaker open — skipping OpenAI');
    return false;
  }
  return true;
}

async function inferWithOpenAI(
  _tenantId: string,
  job: Job,
  vendors: Vendor[],
  prompt: string,
): Promise<{ recommendation: AIRecommendation; summary: string; rawResponse: string }> {
  const { content, latencyMs, model } = await requestRecommendationJson(prompt);

  const parsed = openAiResponseSchema.parse(JSON.parse(content));
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  const candidates = parsed.candidates
    .filter((c) => vendorMap.has(c.vendorId))
    .map((c) => ({
      vendorId: c.vendorId,
      vendorName: vendorMap.get(c.vendorId)!.name,
      score: Math.round(c.score * 100) / 100,
      reason: c.reason,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const recommendation: AIRecommendation = {
    id: `rec_${job.id}`,
    tenantId: job.tenantId,
    jobId: job.id,
    candidates,
    model,
    latencyMs,
    usedFallback: false,
    createdAt: new Date().toISOString(),
  };

  return { recommendation, summary: parsed.summary, rawResponse: content };
}

/** Exposed for tests and diagnostics. */
export function isUsingLiveAi(): boolean {
  return isAzureOpenAIConfigured() && !aiCircuitBreaker.isOpen();
}
