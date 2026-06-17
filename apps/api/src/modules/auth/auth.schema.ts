import { z } from 'zod';

export const devLoginSchema = z.object({
  userId: z.string().min(1),
});
