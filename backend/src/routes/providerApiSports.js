// backend/src/routes/providerApiSports.js
import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdminKey } from "../middleware/adminKey.js";
import { apiSports, extractRateLimitHeaders } from "../providers/apiSports/client.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { upsertLiveFixtures } from "../providers/apiSports/upsertLiveFixtures.js";
import { ingestEventsForMatch } from "../providers/apiSports/ingestEvents.js";

export const providerApiSportsRouter = Router();

/**
 * GET /providers/api-sports/fixtures/live
 * Admin-only debug endpoint:
 * - fetch live fixtures (no DB writes)
 * - return trimmed payload + rate-limit headers
 */
providerApiSportsRouter.get("/fixtures/live", requireAdminKey, async (_req, res) => {
    try {
        // API-FOOTBALL fixtures endpoint (v3):
        // /fixtures?live=all returns live fixtures
        const resp = await apiSports.get("/fixtures", { params: { live: "all" } });

        const rl = extractRateLimitHeaders(resp.headers);

        // Trim the payload so you don’t dump huge responses in the browser
        const fixtures = (resp.data?.response ?? []).slice(0, 10).map((f) => ({
            fixtureId: f.fixture?.id,
            date: f.fixture?.date,
            status: f.fixture?.status?.short,
            league: f.league?.name,
            country: f.league?.country,
            home: f.teams?.home?.name,
            away: f.teams?.away?.name,
            goals: f.goals, // {home, away}
        }));

        return res.status(200).json({
            meta: {
                provider: "api-sports",
                endpoint: "/fixtures?live=all",
                rateLimit: rl,
                returned: fixtures.length,
            },
            data: fixtures,
        });
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        console.error("API-SPORTS live fixtures fetch failed", status, data ?? e);

        return res.status(502).json({
            error: "Failed to fetch live fixtures from API-SPORTS",
            details: status ? { status, data } : "Upstream error",
        });
    }
});


providerApiSportsRouter.post("/sync/live", requireAdminKey, async (req, res) => {
    try {
        const resp = await apiSports.get("/fixtures", { params: { live: "all" } });
        const fixtures = resp.data?.response ?? [];

        const { inserted, updated, scoreChanged } = await upsertLiveFixtures(fixtures, {
            onMatchCreated: (m) => {
                if (req.app.locals.broadcastMatchCreated) req.app.locals.broadcastMatchCreated(m);
            },
            onScoreUpdated: (p) => {
                if (req.app.locals.broadcastScoreUpdated) req.app.locals.broadcastScoreUpdated(p);
            },
        });

        return res.status(200).json({
            meta: { fetched: fixtures.length, inserted: inserted.length, updated: updated.length, scoreChanged: scoreChanged.length },
            data: { inserted, updated },
        });
    } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        console.error("API-SPORTS sync failed", status, data ?? e);

        return res.status(502).json({
            error: "Failed to sync live fixtures from API-SPORTS",
            details: status ? { status, data } : "Upstream error",
        });
    }
});

providerApiSportsRouter.post("/sync/today", requireAdminKey, async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const resp = await apiSports.get("/fixtures", {
            params: { date: today },
        });

        const fixtures = resp.data?.response ?? [];

        const { inserted, updated } = await upsertLiveFixtures(fixtures, {
            onMatchCreated: (m) => req.app.locals.broadcastMatchCreated?.(m),
            onScoreUpdated: (p) => req.app.locals.broadcastScoreUpdated?.(p),
        });

        return res.json({
            meta: { fetched: fixtures.length, inserted: inserted.length, updated: updated.length },
        });
    } catch (e) {
        const status = e?.response?.status;
        return res.status(502).json({
            error: "Failed to sync today's fixtures",
            details: status ?? e.message,
        });
    }
});

providerApiSportsRouter.post("/sync/events/:matchId", requireAdminKey, async (req, res) => {
    const matchId = Number(req.params.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
        return res.status(400).json({ error: "Invalid matchId" });
    }

    try {
        const result = await ingestEventsForMatch(matchId);

        if (result?.error) {
            return res.status(result.status || 400).json({ error: result.error });
        }

        // Broadcast each inserted commentary row
        for (const c of result.inserted) {
            req.app.locals.broadcastCommentary?.(c.matchId, c);
        }

        return res.status(200).json({
            meta: {
                matchId,
                fixtureId: result.fixtureId,
                fetched: result.fetched,
                inserted: result.inserted.length,
            },
            data: result.inserted,
        });
    } catch (e) {
        const status = e?.response?.status;
        console.error("sync events failed", status ?? e);
        return res.status(502).json({
            error: "Failed to sync events",
            details: status ?? "Upstream error",
        });
    }
});

providerApiSportsRouter.post("/sync/non-scheduled-events", requireAdminKey, async (req, res) => {
    try {
        const rows = await db
            .select({ id: matches.id, status: matches.status, providerMatchId: matches.providerMatchId })
            .from(matches)
            .where(
                and(
                    eq(matches.provider, "api-sports"),
                    inArray(matches.status, ["live", "finished"])
                )
            );

        let processed = 0;
        let inserted = 0;
        let skippedNoProviderId = 0;
        const failed = [];

        for (const m of rows) {
            if (!m.providerMatchId) {
                skippedNoProviderId += 1;
                continue;
            }

            processed += 1;
            try {
                const result = await ingestEventsForMatch(m.id);
                if (result?.error) {
                    failed.push({ matchId: m.id, error: result.error, status: result.status ?? 400 });
                    continue;
                }

                inserted += result?.inserted?.length ?? 0;
                for (const c of result?.inserted ?? []) {
                    req.app.locals.broadcastCommentary?.(c.matchId, c);
                }
            } catch (e) {
                failed.push({
                    matchId: m.id,
                    error: "Upstream error",
                    status: e?.response?.status ?? 502,
                });
            }
        }

        return res.status(200).json({
            meta: {
                totalCandidates: rows.length,
                processed,
                inserted,
                failed: failed.length,
                skippedNoProviderId,
            },
            failed,
        });
    } catch (e) {
        const status = e?.response?.status;
        console.error("sync events non-scheduled failed", status ?? e);
        return res.status(502).json({
            error: "Failed to sync events for non-scheduled matches",
            details: status ?? "Upstream or internal error",
        });
    }
});
