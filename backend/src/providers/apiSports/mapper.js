// backend/src/providers/apiSports/mapper.js
import { MATCH_STATUS } from '../../validation/matches.js';

function statusFromApiShort(short) {
    // API-FOOTBALL status.short examples: "NS", "1H", "HT", "2H", "FT", "AET", "PEN", "SUSP", etc.
    // MVP mapping:
    if (!short) return null;

    const s = String(short).toUpperCase();

    // Not started / scheduled
    if (s === "NS" || s === "TBD") return MATCH_STATUS.SCHEDULED;

    // Finished-ish
    if (["FT", "AET", "PEN"].includes(s)) return MATCH_STATUS.FINISHED;

    // Everything else treat as live (1H, HT, 2H, ET, LIVE, etc.)
    return MATCH_STATUS.LIVE;
}

export function mapFixtureToMatchRow(f) {
    const fixtureId = f?.fixture?.id;
    if (!fixtureId) return null;

    const startTime = f?.fixture?.date ? new Date(f.fixture.date) : null;

    // API might provide timestamps for end; often not. We'll keep endTime null for MVP.
    const endTime = null;

    const homeTeam = f?.teams?.home?.name ?? "Home";
    const awayTeam = f?.teams?.away?.name ?? "Away";
    const homeTeamLogo = f?.teams?.home?.logo ?? null;
    const awayTeamLogo = f?.teams?.away?.logo ?? null;

    const homeScore = Number.isFinite(f?.goals?.home) ? f.goals.home : 0;
    const awayScore = Number.isFinite(f?.goals?.away) ? f.goals.away : 0;

    const status = statusFromApiShort(f?.fixture?.status?.short) ?? MATCH_STATUS.SCHEDULED;

    return {
        provider: "api-sports",
        providerMatchId: fixtureId,
        sport: "football", // MVP: api-football only
        homeTeam,
        awayTeam,
        homeTeamLogo,
        awayTeamLogo,
        league: f?.league?.name ?? null,
        country: f?.league?.country ?? null,
        startTime: startTime ?? new Date(),
        endTime,
        homeScore,
        awayScore,
        status,
    };
}
