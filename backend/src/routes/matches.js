import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import { getMatchStatus } from '../utils/match-status.js';
import { createMatchSchema, listMatchesQuerySchema, matchIdParamSchema, updateScoreSchema } from '../validation/matches.js';
import { requireAdminKey } from "../middleware/adminKey.js";


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
  const statusFilter = parsed.data.status; // ✅ NEW (requires schema update too)
  try {
    const baseQuery = db.select().from(matches);

    const filteredQuery = statusFilter
      ? baseQuery.where(eq(matches.status, statusFilter))
      : baseQuery;

    const rows = await filteredQuery
      .orderBy(
        sql`CASE
      WHEN ${matches.status} = 'live' THEN 0
      WHEN ${matches.status} = 'scheduled' THEN 1
      WHEN ${matches.status} = 'finished' THEN 2
      ELSE 3
    END`,
        desc(matches.startTime),
        desc(matches.createdAt)
      )
      .limit(limit);

    const now = new Date();
    const data = [];

    for (const m of rows) {
      const computed = getMatchStatus(m.startTime, m.endTime, now);
      const status = computed ?? m.status;

      // Optional: lazy-correct stored status (keeps DB sane for dashboards/admin)
      if (computed && computed !== m.status) {
        await db.update(matches).set({ status: computed }).where(eq(matches.id, m.id));
      }

      data.push({ ...m, status });
    }

    return res.json({ data });
  } catch (e) {
    console.error('Failed to list matches', e);
    return res.status(500).json({
      error: 'Failed to list matches',
      details: 'Internal server error.',
    });
  }
});

// ✅ New: GET /matches/:id (so frontend doesn't fetch list + find)
matchRouter.get('/:id', async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    console.error('Invalid params for GET /matches/:id', parsedParams.error);
    return res.status(400).json({
      error: 'Invalid match id.',
      details: 'Request params validation failed.',
    });
  }

  const { id } = parsedParams.data;

  try {
    const rows = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
    const match = rows[0];

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const computed = getMatchStatus(match.startTime, match.endTime);
    const status = computed ?? match.status;

    // Optional lazy-correct
    if (computed && computed !== match.status) {
      await db.update(matches).set({ status: computed }).where(eq(matches.id, id));
    }

    return res.json({ data: { ...match, status } });
  } catch (e) {
    console.error('Failed to fetch match', e);
    return res.status(500).json({
      error: 'Failed to fetch match',
      details: 'Internal server error.',
    });
  }
});

matchRouter.post('/', requireAdminKey, async (req, res) => {
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

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }

    return res.status(201).json({ data: event });
  } catch (e) {
    console.error('Failed to create match', e);
    return res.status(500).json({
      error: 'Failed to create match',
      details: 'Internal server error.',
    });
  }
});

matchRouter.patch('/:id/score', requireAdminKey, async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    console.error('Invalid params for PATCH /matches/:id/score', parsedParams.error);
    return res.status(400).json({
      error: 'Invalid match id.',
      details: 'Request params validation failed.',
    });
  }

  const parsedBody = updateScoreSchema.safeParse(req.body);
  if (!parsedBody.success) {
    console.error('Invalid payload for PATCH /matches/:id/score', parsedBody.error);
    return res.status(400).json({
      error: 'Invalid payload.',
      details: parsedBody.error.issues, // keep this consistent going forward
    });
  }

  const { id } = parsedParams.data;
  const { homeScore, awayScore } = parsedBody.data;

  try {
    const updatedRows = await db
      .update(matches)
      .set({ homeScore, awayScore })
      .where(eq(matches.id, id))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Broadcast score update to all connected clients
    if (res.app.locals.broadcastScoreUpdated) {
      res.app.locals.broadcastScoreUpdated({
        matchId: updated.id,
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
      });
    }

    return res.status(200).json({ data: updated });
  } catch (e) {
    console.error('Failed to update score', e);
    return res.status(500).json({
      error: 'Failed to update score',
      details: 'Internal server error.',
    });
  }
});