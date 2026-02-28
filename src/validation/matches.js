import { z } from 'zod';

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

const isValidIsoDateString = (value) => {
  const result = z.iso.datetime({ offset: true }).safeParse(value);
  return result.success;
};

const isoDateStringSchema = z.string().refine(isValidIsoDateString, {
  message: 'Must be a valid ISO date string',
});

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

//it validates the request body of POST /matches
export const createMatchSchema = z
  .object({
    sport: z.string().trim().min(1, 'sport is required'),
    homeTeam: z.string().trim().min(1, 'homeTeam is required'),
    awayTeam: z.string().trim().min(1, 'awayTeam is required'),
    startTime: isoDateStringSchema,
    endTime: isoDateStringSchema,
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);

    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be after startTime',
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
