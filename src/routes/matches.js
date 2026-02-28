import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import { getMatchStatus } from '../utils/match-status.js';
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches.js';

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get('/', async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    console.error('Invalid query payload for GET /matches', parsed.error);
    return res.status(400).json({
      error: 'Invalid query.',
      details: 'Request query validation failed.',
    });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
    return res.json({ data });
  } catch (e) {
    console.error('Failed to list matches', e);
    return res.status(500).json({
      error: 'Failed to list matches',
      details: 'Internal server error.',
    });
  }
});

matchRouter.post('/', async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Invalid payload for POST /matches', parsed.error);
    return res.status(400).json({
      error: 'Invalid payload.',
      details: 'Request body validation failed.',
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const computedStatus = getMatchStatus(startTime, endTime);
    const status = computedStatus ?? 'scheduled';

    if (!computedStatus) {
      console.warn('Invalid start/end time, defaulting match status to scheduled', {
        startTime,
        endTime,
      });
    }

    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status,
      })
      .returning();

    return res.status(201).json({ data: event });
  } catch (e) {
    console.error('Failed to create match', e);
    return res.status(500).json({
      error: 'Failed to create match',
      details: 'Internal server error.',
    });
  }
});
