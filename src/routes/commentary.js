import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { commentary, matches } from '../db/schema.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';
import { matchIdParamSchema } from '../validation/matches.js';

export const commentaryRouter = Router({ mergeParams: true });
const MAX_LIMIT = 100;

commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);
    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match id.', details: 'Request params validation failed.' });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query.', details: 'Request query validation failed.' });
    }

    const limit = Math.min(queryResult.data.limit ?? MAX_LIMIT, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, paramsResult.data.id))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

        return res.status(200).json({ data });
    } catch (error) {
        console.error('Failed to list commentary:', error);
        return res.status(500).json({
            error: 'Failed to list commentary.',
            details: 'Internal server error.',
        });
    }
});

commentaryRouter.post('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match id.', details: paramsResult.error.issues });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({
            error: 'Invalid commentary payload.',
            details: bodyResult.error.issues
        });
    }

    try {
        const [match] = await db
            .select({ id: matches.id })
            .from(matches)
            .where(eq(matches.id, paramsResult.data.id))
            .limit(1);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const { minutes, ...rest } = bodyResult.data;

        const [result] = await db.insert(commentary).values({
            matchId: paramsResult.data.id,
            minutes,
            ...rest
        }).returning();

        res.status(201).json({ data: result });

        if (res.app.locals.broadcastCommentary) {
            try {
                res.app.locals.broadcastCommentary(result.matchId, result);
            } catch (broadcastError) {
                console.error('Failed to broadcast commentary update:', broadcastError);
            }
        }
    } catch (error) {
        console.error('Failed to create commentary:', error);
        res.status(500).json({ error: 'Failed to create commentary.' });
    }
});
