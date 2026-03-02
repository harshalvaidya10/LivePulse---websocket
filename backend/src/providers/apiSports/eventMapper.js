// backend/src/providers/apiSports/eventMapper.js

function safeStr(v) {
    return v == null ? "" : String(v);
}

function buildProviderEventKey({ fixtureId, ev }) {
    // Deterministic key from “most stable” fields
    // If API gives a true id in future, use that instead.
    const elapsed = ev?.time?.elapsed ?? "";
    const extra = ev?.time?.extra ?? "";
    const team = safeStr(ev?.team?.name);
    const player = safeStr(ev?.player?.name);
    const assist = safeStr(ev?.assist?.name);
    const type = safeStr(ev?.type);
    const detail = safeStr(ev?.detail);
    const comments = safeStr(ev?.comments);

    return [
        "api-sports",
        fixtureId,
        elapsed,
        extra,
        type,
        detail,
        team,
        player,
        assist,
        comments,
    ].join("|");
}

function toMessage(ev) {
    const elapsed = ev?.time?.elapsed;
    const extra = ev?.time?.extra;
    const t = extra ? `${elapsed}+${extra}` : `${elapsed ?? ""}`;

    const team = ev?.team?.name;
    const player = ev?.player?.name;
    const assist = ev?.assist?.name;

    const type = ev?.type;     // e.g. "Goal", "Card", "subst"
    const detail = ev?.detail; // e.g. "Normal Goal", "Yellow Card"
    const comments = ev?.comments;

    const who = [player, assist ? `(assist: ${assist})` : null].filter(Boolean).join(" ");
    const parts = [
        t ? `${t}'` : null,
        team ? `${team}:` : null,
        type && detail ? `${type} — ${detail}` : (type || detail),
        who || null,
        comments || null,
    ].filter(Boolean);

    return parts.join(" ");
}

function normalizeEventType(ev) {
    const t = (ev?.type || "").toLowerCase();
    if (t.includes("goal")) return "GOAL";
    if (t.includes("card")) return "CARD";
    if (t.includes("subst")) return "SUB";
    if (t.includes("var")) return "VAR";
    return (ev?.type || "EVENT").toUpperCase();
}

export function mapApiSportsEventToCommentaryRow({ matchId, fixtureId, ev, sequence }) {
    const minutes = Number.isFinite(ev?.time?.elapsed) ? ev.time.elapsed : 0;

    // period: rough MVP mapping
    const period = minutes <= 45 ? "1H" : minutes <= 90 ? "2H" : "ET";

    return {
        provider: "api-sports",
        providerEventKey: buildProviderEventKey({ fixtureId, ev }),

        matchId,
        minutes,
        sequence,
        period,
        eventType: normalizeEventType(ev),
        actor: ev?.player?.name ?? null,
        team: ev?.team?.name ?? null,
        message: toMessage(ev),
        metadata: ev,          // store raw event blob for debugging/future
        tags: null,
    };
}