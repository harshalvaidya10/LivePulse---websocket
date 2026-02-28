import { z } from 'zod';

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createCommentarySchema = z.object({
  minutes: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string().trim().min(1, 'period is required'),
  eventType: z.string().trim().min(1, 'eventType is required'),
  actor: z.string().trim().min(1).optional(),
  team: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1, 'message is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});
