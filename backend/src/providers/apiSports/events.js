// backend/src/providers/apiSports/events.js
import { apiSports } from "./client.js";

export async function fetchFixtureEvents(fixtureId) {
    const resp = await apiSports.get("/fixtures/events", {
        params: { fixture: fixtureId },
    });
    return resp.data?.response ?? [];
}