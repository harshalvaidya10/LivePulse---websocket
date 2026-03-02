// backend/src/jobs/apiSportsLivePoller.js
import { apiSports } from "../providers/apiSports/client.js";
import { upsertLiveFixtures } from "../providers/apiSports/upsertLiveFixtures.js";
import { ingestEventsForMatch } from "../providers/apiSports/ingestEvents.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Polls API-SPORTS live fixtures, upserts matches/scores, closes out finished matches,
 * and automatically ingests commentary (events) for all non-scheduled matches.
 *
 * IMPORTANT (quota): events ingestion costs 1 request per match.
 * Tune intervalMs + perMatchDelayMs to fit your plan.
 */
export function startApiSportsLivePoller(
    app,
    {
        // Use a conservative default with per-match events calls enabled.
        intervalMs = 15 * 60 * 1000,
        // Small delay between per-match event fetches to avoid bursts.
        perMatchDelayMs = 200,
    } = {}
) {
    let timer = null;
    let running = false;

    async function sleep(ms) {
        if (!ms) return;
        await new Promise((r) => setTimeout(r, ms));
    }

    async function broadcastInsertedCommentary(insertedRows) {
        if (!insertedRows?.length) return;
        for (const c of insertedRows) {
            app.locals.broadcastCommentary?.(c.matchId, c);
        }
    }

    async function ingestAndBroadcast(matchId, label) {
        try {
            const result = await ingestEventsForMatch(matchId);

            if (result?.error) {
                console.warn(`[events] ingest ${label} failed`, matchId, result.error);
                return { inserted: 0, fetched: result?.fetched ?? 0 };
            }

            await broadcastInsertedCommentary(result.inserted);
            return { inserted: result.inserted.length, fetched: result.fetched ?? 0 };
        } catch (e) {
            const status = e?.response?.status;
            console.warn(
                `[events] ingest ${label} exception`,
                matchId,
                status ? { status, data: e?.response?.data } : e?.message || e
            );
            return { inserted: 0, fetched: 0 };
        }
    }

    async function tick() {
        if (running) return;
        running = true;

        try {
            // 1) Fetch all live fixtures
            const resp = await apiSports.get("/fixtures", { params: { live: "all" } });
            const fixtures = resp.data?.response ?? [];

            const apiLiveProviderIds = new Set(
                fixtures.map((f) => f?.fixture?.id).filter(Boolean)
            );

            // 2) Upsert matches/scores (this should handle match_created + score_update broadcasts)
            await upsertLiveFixtures(fixtures, {
                onMatchCreated: (m) => app.locals.broadcastMatchCreated?.(m),
                onScoreUpdated: (p) => app.locals.broadcastScoreUpdated?.(p),
            });

            // 3) Close out ended matches (DB says live, API says not live anymore)
            const dbLiveRows = await db
                .select({ id: matches.id, providerMatchId: matches.providerMatchId })
                .from(matches)
                .where(and(eq(matches.provider, "api-sports"), eq(matches.status, "live")));

            const endedMatchIds = dbLiveRows
                .filter((m) => m.providerMatchId && !apiLiveProviderIds.has(m.providerMatchId))
                .map((m) => m.id);

            if (endedMatchIds.length > 0) {
                await db
                    .update(matches)
                    .set({ status: "finished", lastSyncedAt: new Date() })
                    .where(inArray(matches.id, endedMatchIds));

                // Optional broadcast if you implement it
                if (app.locals.broadcastMatchFinished) {
                    for (const matchId of endedMatchIds) {
                        app.locals.broadcastMatchFinished({ matchId, status: "finished" });
                    }
                }
                console.log(`[api-sports poller] marked finished: ${endedMatchIds.length}`);
            }

            // 4) Auto-ingest commentary for ALL non-scheduled api-sports matches
            const ingestTargetRows = await db
                .select({ id: matches.id, status: matches.status })
                .from(matches)
                .where(
                    and(
                        eq(matches.provider, "api-sports"),
                        inArray(matches.status, ["live", "finished"])
                    )
                );

            let insertedTotal = 0;
            for (const m of ingestTargetRows) {
                const { inserted } = await ingestAndBroadcast(m.id, m.status);
                insertedTotal += inserted;
                await sleep(perMatchDelayMs);
            }

            console.log(
                `[events] non-scheduled ingest: processed=${ingestTargetRows.length} inserted=${insertedTotal}`
            );
            console.log(`[api-sports poller] live fixtures=${fixtures.length}`);
        } catch (e) {
            const status = e?.response?.status;
            console.error("[api-sports poller] failed", status ?? e);
        } finally {
            running = false;
        }
    }

    timer = setInterval(tick, intervalMs);
    tick(); // run once on startup

    return {
        stop() {
            if (timer) clearInterval(timer);
            timer = null;
        },
    };
}
