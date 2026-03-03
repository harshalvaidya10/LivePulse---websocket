import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import TeamCrest from "../components/TeamCrest";

// ✅ Pick ONE of these depending on your api.js export:
// import api from "../lib/api";
import { api } from "../lib/api";

import { ensureWSConnected, wsSubscribe, wsUnsubscribe, onWSMessage } from "../lib/ws";

export default function MatchDetail() {
    const { id } = useParams();
    const matchId = useMemo(() => Number(id), [id]);

    const [match, setMatch] = useState(null);
    const [commentary, setCommentary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // 1) Fetch match + commentary via API
    useEffect(() => {
        if (!Number.isFinite(matchId) || matchId <= 0) {
            setError(`Invalid match id: ${id}`);
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError("");

                const [matchRes, commRes] = await Promise.all([
                    api.get(`/matches/${matchId}`),
                    api.get(`/matches/${matchId}/commentary?limit=100`),
                ]);

                if (cancelled) return;

                setMatch(matchRes?.data?.data ?? null);
                setCommentary(Array.isArray(commRes?.data?.data) ? commRes.data.data : []);
            } catch (e) {
                console.error("MatchDetail load error:", e);
                if (!cancelled) setError("Failed to load match details. Check console + Network tab.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [matchId, id]);

    // 2) WebSocket: subscribe to match events + update UI live
    useEffect(() => {
        if (!Number.isFinite(matchId) || matchId <= 0) return;

        ensureWSConnected();

        const onMessage = (msg) => {
            try {
                if (!msg || typeof msg !== "object") return;

                // Score updates
                if (msg.type === "score_update" && msg.data?.matchId === matchId) {
                    const { homeScore, awayScore } = msg.data;
                    setMatch((prev) => (prev ? { ...prev, homeScore, awayScore } : prev));
                }

                // Commentary updates for this match
                if (msg.type === "commentary" && msg.data?.matchId === matchId) {
                    setCommentary((prev) => [msg.data, ...prev]);
                }
            } catch (e) {
                console.error("MatchDetail WS handler error:", e, msg);
            }
        };

        const off = onWSMessage(onMessage);

        // Your current pattern: retry subscribe until socket is open
        const interval = setInterval(() => {
            wsSubscribe(matchId);
        }, 300);

        return () => {
            clearInterval(interval);
            try {
                wsUnsubscribe(matchId);
            } catch { }
            off();
        };
    }, [matchId]);

    // --- UI ---
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-4">
                        <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                            ← Back
                        </Link>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                        Loading match…
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-4">
                        <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                            ← Back
                        </Link>
                    </div>
                    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5">
                        <div className="text-sm font-black uppercase tracking-[0.2em] text-rose-200">Error</div>
                        <div className="mt-2 text-rose-100">{error}</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!match) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-4">
                        <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                            ← Back
                        </Link>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-300">
                        Match not found (id: {matchId})
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute -right-20 top-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-5xl">
                <div className="mb-4">
                    <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                        ← Back
                    </Link>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{match.sport}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <TeamCrest name={match.homeTeam} logo={match.homeTeamLogo} size="h-10 w-10" />
                                    <span className="text-xl font-black tracking-tight text-white sm:text-2xl">{match.homeTeam}</span>
                                </div>
                                <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">vs</span>
                                <div className="flex items-center gap-2">
                                    <TeamCrest name={match.awayTeam} logo={match.awayTeamLogo} size="h-10 w-10" />
                                    <span className="text-xl font-black tracking-tight text-white sm:text-2xl">{match.awayTeam}</span>
                                </div>
                            </div>
                            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Status: <span className="text-slate-200">{match.status}</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-5 py-3 text-center">
                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">Score</div>
                            <div className="mt-1 text-4xl font-black tabular-nums text-cyan-100">
                                {match.homeScore} - {match.awayScore}
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Start</span>
                            <div className="mt-1 font-medium">{new Date(match.startTime).toLocaleString()}</div>
                        </div>
                        {match.endTime ? (
                            <div className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">End</span>
                                <div className="mt-1 font-medium">{new Date(match.endTime).toLocaleString()}</div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">Live Commentary</h3>
                </div>

                {commentary.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-slate-400">
                        No commentary yet.
                    </div>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {commentary.map((c) => (
                            <li
                                key={c.id}
                                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg"
                            >
                                <div className="flex flex-wrap items-baseline gap-3">
                                    <div className="rounded-lg bg-cyan-500/15 px-2 py-1 text-sm font-black tabular-nums text-cyan-100">
                                        {c.minutes}'
                                    </div>
                                    <div className="text-sm font-black uppercase tracking-[0.12em] text-slate-200">{c.eventType}</div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{c.period}</div>
                                </div>
                                <div className="mt-3 text-slate-100">{c.message}</div>

                                {(c.actor || c.team) && (
                                    <div className="mt-3 text-xs font-medium text-slate-400">
                                        {c.actor ? `Actor: ${c.actor}` : ""}
                                        {c.actor && c.team ? " • " : ""}
                                        {c.team ? `Team: ${c.team}` : ""}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
