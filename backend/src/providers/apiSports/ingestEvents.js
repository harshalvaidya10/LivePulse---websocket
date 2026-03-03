// backend/src/providers/apiSports/ingestEvents.js
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/db.js";
import { matches, commentary } from "../../db/schema.js";
import { fetchFixtureEvents } from "./events.js";
import { mapApiSportsEventToCommentaryRow } from "./eventMapper.js";

export async function ingestEventsForMatch(matchId) {
    // 1) Load match
    const matchRows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    const match = matchRows[0];
    if (!match) return { error: "Match not found", status: 404 };

    if (match.provider !== "api-sports" || !match.providerMatchId) {
        return { error: "Match is not an api-sports match", status: 400 };
    }

    const fixtureId = match.providerMatchId;

    // 2) Fetch events from API
    const events = await fetchFixtureEvents(fixtureId);

    // 3) Find current max sequence for this match so new inserts continue cleanly
    const seqRows = await db
        .select({ maxSeq: sql`COALESCE(MAX(${commentary.sequence}), 0)` })
        .from(commentary)
        .where(eq(commentary.matchId, matchId));

    let nextSeq = Number(seqRows?.[0]?.maxSeq ?? 0);

    const inserted = [];

    // 4) Map provider events → rows and insert
    if (events.length > 0) {
        const rowsToInsert = [];
        for (const ev of events) {
            nextSeq += 1;
            rowsToInsert.push(
                mapApiSportsEventToCommentaryRow({
                    matchId,
                    fixtureId,
                    ev,
                    sequence: nextSeq,
                })
            );
        }

        if (rowsToInsert.length > 0) {
            const insertedEvents = await db
                .insert(commentary)
                .values(rowsToInsert)
                .onConflictDoNothing({
                    target: [commentary.provider, commentary.providerEventKey],
                })
                .returning();
            inserted.push(...insertedEvents);
        }
    }

    // 5) If no provider events, add a single fallback summary row.
    if (events.length === 0 && (match.status === "live" || match.status === "finished")) {
        nextSeq += 1;
        const isFinished = match.status === "finished";
        const fallbackSummary = {
            provider: "api-sports",
            providerEventKey: `api-sports|${fixtureId}|fallback-summary|${match.status}`,
            matchId,
            minutes: isFinished ? 90 : 0,
            sequence: nextSeq,
            period: isFinished ? "FT" : "LIVE",
            eventType: isFinished ? "FT" : "UPDATE",
            actor: null,
            team: null,
            message: isFinished
                ? `Full-time: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`
                : `Live update: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`,
            metadata: {
                source: "api-sports",
                fallback: true,
                reason: "no_events_from_provider",
                fixtureId,
            },
            tags: ["fallback"],
        };

        const insertedSummary = await db
            .insert(commentary)
            .values(fallbackSummary)
            .onConflictDoNothing({
                target: [commentary.provider, commentary.providerEventKey],
            })
            .returning();

        inserted.push(...insertedSummary);
    }

    // 6) Reconcile scoreline to GOAL commentary count.
    // If API events are missing/incomplete, create fallback GOAL rows so goal mentions
    // are at least consistent with the current score.
    if (match.status === "live" || match.status === "finished") {
        const statsRows = await db
            .select({
                maxSeq: sql`COALESCE(MAX(${commentary.sequence}), 0)`,
                homeGoals: sql`COALESCE(SUM(CASE WHEN ${commentary.eventType} = 'GOAL' AND ${commentary.team} = ${match.homeTeam} THEN 1 ELSE 0 END), 0)`,
                awayGoals: sql`COALESCE(SUM(CASE WHEN ${commentary.eventType} = 'GOAL' AND ${commentary.team} = ${match.awayTeam} THEN 1 ELSE 0 END), 0)`,
            })
            .from(commentary)
            .where(eq(commentary.matchId, matchId));

        let seq = Number(statsRows?.[0]?.maxSeq ?? 0);
        const existingHomeGoals = Number(statsRows?.[0]?.homeGoals ?? 0);
        const existingAwayGoals = Number(statsRows?.[0]?.awayGoals ?? 0);

        const homeScore = Number(match.homeScore ?? 0);
        const awayScore = Number(match.awayScore ?? 0);

        const fallbackGoalRows = [];

        for (let i = existingHomeGoals + 1; i <= homeScore; i += 1) {
            seq += 1;
            fallbackGoalRows.push({
                provider: "api-sports",
                providerEventKey: `api-sports|${fixtureId}|fallback-goal|home|${i}`,
                matchId,
                minutes: match.status === "finished" ? 90 : 0,
                sequence: seq,
                period: match.status === "finished" ? "FT" : "LIVE",
                eventType: "GOAL",
                actor: null,
                team: match.homeTeam,
                message: `${match.homeTeam} goal (details unavailable)`,
                metadata: {
                    source: "api-sports",
                    fallback: true,
                    reason: "goal_reconciliation",
                    fixtureId,
                    side: "home",
                    ordinal: i,
                },
                tags: ["fallback", "goal-estimate"],
            });
        }

        for (let i = existingAwayGoals + 1; i <= awayScore; i += 1) {
            seq += 1;
            fallbackGoalRows.push({
                provider: "api-sports",
                providerEventKey: `api-sports|${fixtureId}|fallback-goal|away|${i}`,
                matchId,
                minutes: match.status === "finished" ? 90 : 0,
                sequence: seq,
                period: match.status === "finished" ? "FT" : "LIVE",
                eventType: "GOAL",
                actor: null,
                team: match.awayTeam,
                message: `${match.awayTeam} goal (details unavailable)`,
                metadata: {
                    source: "api-sports",
                    fallback: true,
                    reason: "goal_reconciliation",
                    fixtureId,
                    side: "away",
                    ordinal: i,
                },
                tags: ["fallback", "goal-estimate"],
            });
        }

        if (fallbackGoalRows.length > 0) {
            const insertedFallbackGoals = await db
                .insert(commentary)
                .values(fallbackGoalRows)
                .onConflictDoNothing({
                    target: [commentary.provider, commentary.providerEventKey],
                })
                .returning();
            inserted.push(...insertedFallbackGoals);
        }
    }

    return { inserted, fetched: events.length, fixtureId };
}
