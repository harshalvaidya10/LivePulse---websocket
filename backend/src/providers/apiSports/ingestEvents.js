// backend/src/providers/apiSports/ingestEvents.js
import { and, desc, eq, sql } from "drizzle-orm";
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

    // 4) If provider has no events, create a fallback commentary row for non-scheduled matches.
    // This guarantees live/finished matches can still show at least one commentary item.
    if (events.length === 0 && (match.status === "live" || match.status === "finished")) {
        nextSeq += 1;

        const isFinished = match.status === "finished";
        const fallbackRow = {
            provider: "api-sports",
            providerEventKey: `api-sports|${fixtureId}|fallback|${match.status}`,
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

        const insertedFallback = await db
            .insert(commentary)
            .values(fallbackRow)
            .onConflictDoNothing({
                target: [commentary.provider, commentary.providerEventKey],
            })
            .returning();

        return { inserted: insertedFallback, fetched: 0, fixtureId };
    }

    // 5) Map → rows
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

    if (rowsToInsert.length === 0) {
        return { inserted: [], fetched: 0 };
    }

    // 6) Insert with dedupe
    // Requires unique index on (provider, provider_event_key)
    const inserted = await db
        .insert(commentary)
        .values(rowsToInsert)
        .onConflictDoNothing({
            target: [commentary.provider, commentary.providerEventKey],
        })
        .returning();

    return { inserted, fetched: events.length, fixtureId };
}
