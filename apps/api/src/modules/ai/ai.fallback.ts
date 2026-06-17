import type { AIRecommendation, Job, Vendor } from '@retailfixit/shared';
import { matchedSkillLabels, scoreSkillMatch } from '@retailfixit/shared';

/** Deterministic vendor scoring when AI is unavailable (also used as mock in dev). */
export function buildFallbackRecommendation(
  tenantId: string,
  job: Job,
  vendors: Vendor[],
): AIRecommendation {
  const candidates = vendors
    .map((vendor) => {
      const skillScore = scoreSkillMatch(job.requiredSkills, vendor.skills);
      const ratingScore = vendor.rating / 5;
      const workloadScore = 1 - Math.min(vendor.activeJobCount / 10, 1);
      const score = skillScore * 0.5 + ratingScore * 0.3 + workloadScore * 0.2;

      const matchedSkills = matchedSkillLabels(job.requiredSkills, vendor.skills);

      const reason =
        matchedSkills.length > 0
          ? `Matches ${matchedSkills.join(', ')}; rating ${vendor.rating}/5; ${vendor.activeJobCount} active jobs`
          : `Available vendor; rating ${vendor.rating}/5; ${vendor.activeJobCount} active jobs`;

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        score: Math.round(score * 100) / 100,
        reason,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    id: `rec_${job.id}`,
    tenantId,
    jobId: job.id,
    candidates,
    model: 'rule-based-v1',
    latencyMs: 0,
    usedFallback: true,
    createdAt: new Date().toISOString(),
  };
}
