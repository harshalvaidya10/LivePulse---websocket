// backend/src/providers/apiSports/client.js
import axios from "axios";

const BASE_URL = process.env.API_SPORTS_BASE_URL || "https://v3.football.api-sports.io";

function requireApiSportsKey() {
    const key = process.env.API_SPORTS_KEY;
    if (!key) {
        throw new Error("API_SPORTS_KEY is missing. Set it in backend/.env");
    }
    return key;
}

export const apiSports = axios.create({
    baseURL: BASE_URL,
    timeout: 10_000,
    headers: {
        // API-SPORTS expects this header
        "x-apisports-key": requireApiSportsKey(),
    },
});

// Small helper to surface rate-limit headers to your app/logs
export function extractRateLimitHeaders(headers) {
    // API-SPORTS uses a mix of header casing; axios lowercases keys
    return {
        perMinuteLimit: headers["x-ratelimit-limit"] ?? headers["x-ratelimit-limit".toLowerCase()] ?? null,
        perMinuteRemaining: headers["x-ratelimit-remaining"] ?? null,
        perDayLimit: headers["x-ratelimit-requests-limit"] ?? null,
        perDayRemaining: headers["x-ratelimit-requests-remaining"] ?? null,
    };
}