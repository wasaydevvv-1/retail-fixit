import type { Job, Vendor } from '@retailfixit/shared';

/** Version tag stored in audit logs when prompts change. */
export const PROMPT_VERSION = 'recommend-v1';

export function buildRecommendationPrompt(job: Job, vendors: Vendor[]): string {
  const vendorList = vendors.map((v) => ({
    vendorId: v.id,
    name: v.name,
    skills: v.skills,
    rating: v.rating,
    activeJobCount: v.activeJobCount,
    serviceAreas: v.serviceAreas,
  }));

  return JSON.stringify(
    {
      instruction:
        'Rank the best vendors for this maintenance job. Return JSON only with keys "summary" and "candidates". ' +
        'summary: 1-2 sentence concise description for dispatchers. ' +
        'candidates: top 3 vendors sorted by fit (max 3), each with vendorId (from list), score (0-1), reason (short). ' +
        'Only use vendorIds from the vendors array.',
      job: {
        title: job.title,
        rawDescription: job.rawDescription,
        priority: job.priority,
        location: job.location,
        requiredSkills: job.requiredSkills,
        customerName: job.customerName,
      },
      vendors: vendorList,
    },
    null,
    2,
  );
}

export const SYSTEM_PROMPT =
  'You are a facility maintenance dispatch assistant. Respond with valid JSON only, no markdown.';
