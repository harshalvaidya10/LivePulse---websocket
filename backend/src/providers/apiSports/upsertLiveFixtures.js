// backend/src/providers/apiSports/upsertLiveFixtures.js
import { eq, and } from "drizzle-orm";
import { db } from "../../db/db.js";
import { matches } from "../../db/schema.js";
import { mapFixtureToMatchRow } from "./mapper.js";

/**
 * Upsert live fixtures into matches.
 * Returns: { inserted: Match[], updated: Match[], scoreChanged: Array<{matchId, homeScore, awayScore}> }
 */
export async function upsertLiveFixtures(fixtures, { onMatchCreated, onScoreUpdated } = {}) {
    const inserted = [];
    const updated = [];
    const scoreChanged = [];

    for (const f of fixtures) {
        const row = mapFixtureToMatchRow(f);
        if (!row) continue;

        // Check if match already exists by provider identity
        const existingRows = await db
            .select()
            .from(matches)
            .where(and(eq(matches.provider, row.provider), eq(matches.providerMatchId, row.providerMatchId)))
            .limit(1);

        const existing = existingRows[0];

        if (!existing) {
            const [created] = await db.insert(matches).values(row).returning();
            inserted.push(created);

            if (typeof onMatchCreated === "function") {
                onMatchCreated(created);
            }

            continue;
        }

        const oldHome = existing.homeScore;
        const oldAway = existing.awayScore;

        const [next] = await db
            .update(matches)
            .set({
                homeScore: row.homeScore,
                awayScore: row.awayScore,
                status: row.status,
                // startTime should be stable; but safe to keep it aligned
                startTime: row.startTime,
                endTime: row.endTime,
                lastSyncedAt: new Date(),
            })
            .where(eq(matches.id, existing.id))
            .returning();

        updated.push(next);

        if (oldHome !== next.homeScore || oldAway !== next.awayScore) {
            const payload = { matchId: next.id, homeScore: next.homeScore, awayScore: next.awayScore };
            scoreChanged.push(payload);

            if (typeof onScoreUpdated === "function") {
                onScoreUpdated(payload);
            }
        }
    }

    return { inserted, updated, scoreChanged };
}