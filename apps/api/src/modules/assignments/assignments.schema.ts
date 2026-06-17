import { z } from 'zod';

export const assignJobSchema = z.object({
  vendorId: z.string().min(1, 'vendorId is required'),
});

export type AssignJobInput = z.infer<typeof assignJobSchema>;
