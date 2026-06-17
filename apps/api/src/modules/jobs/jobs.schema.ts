import { JobPriority, JobStatus } from '@retailfixit/shared';
import { normalizeSkillInput } from '@retailfixit/shared';
import { z } from 'zod';

const skillSchema = z
  .string()
  .min(1)
  .max(100)
  .transform(normalizeSkillInput)
  .refine((s) => s.length > 0, 'Skill is required');

export const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  rawDescription: z.string().min(1).max(5000),
  customerName: z.string().min(1).max(200),
  location: z.string().min(1).max(500),
  priority: z.enum([
    JobPriority.Low,
    JobPriority.Medium,
    JobPriority.High,
    JobPriority.Critical,
  ]),
  requiredSkills: z.array(skillSchema).max(20),
});

export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z
    .enum([
      JobStatus.Created,
      JobStatus.AwaitingRecommendation,
      JobStatus.RecommendationReady,
      JobStatus.Assigned,
      JobStatus.InProgress,
      JobStatus.Completed,
      JobStatus.Cancelled,
      JobStatus.Escalated,
    ])
    .optional(),
  priority: z
    .enum([JobPriority.Low, JobPriority.Medium, JobPriority.High, JobPriority.Critical])
    .optional(),
  search: z.string().max(200).optional(),
});
