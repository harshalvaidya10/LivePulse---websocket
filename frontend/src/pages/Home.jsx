import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../lib/api";
import { Link } from "react-router-dom";
import { onWSMessage } from "../lib/ws";
import TeamCrest from "../components/TeamCrest";

export default function Home() {
    const [matches, setMatches] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ live: 0, scheduled: 0, finished: 0 });

    const [tab, setTab] = useState("live"); // "live" | "scheduled" | "finished"

    const fetchCounts = useCallback(async () => {
        const [liveRes, scheduledRes, finishedRes] = await Promise.all([
            api.get("/matches", { params: { limit: 100, status: "live" } }),
            api.get("/matches", { params: { limit: 100, status: "scheduled" } }),
            api.get("/matches", { params: { limit: 100, status: "finished" } }),
        ]);

        setCounts({
            live: liveRes.data?.data?.length || 0,
            scheduled: scheduledRes.data?.data?.length || 0,
            finished: finishedRes.data?.data?.length || 0,
        });
    }, []);

    const fetchTabMatches = useCallback(async (status) => {
        setLoading(true);
        setError("");
        try {
            const res = await api.get("/matches", { params: { limit: 100, status } });
            setMatches(res.data?.data || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const off = onWSMessage((msg) => {
            if (!msg) return;

            // 1) New match inserted from API sync
            if (msg.type === "match_created" && msg.data) {
                if (msg.data.status === tab) {
                    setMatches((prev) => {
                        const withoutDup = prev.filter((m) => m.id !== msg.data.id);
                        return [msg.data, ...withoutDup];
                    });
                }
                fetchCounts().catch(() => { });
                return;
            }

            // 2) Score updates
            if (msg.type === "score_update" && msg.data?.matchId) {
                const { matchId, homeScore, awayScore } = msg.data;
                setMatches((prev) =>
                    prev.map((m) =>
                        m.id === matchId ? { ...m, homeScore, awayScore } : m
                    )
                );
                return;
            }

            // 3) Optional: status updates (if/when you add them)
            if ((msg.type === "match_status" || msg.type === "match_finished") && msg.data?.matchId) {
                fetchCounts().catch(() => { });
                fetchTabMatches(tab).catch(() => { });
            }
        });

        return () => off();
    }, [tab, fetchCounts, fetchTabMatches]);

    useEffect(() => {
        let alive = true;

        async function load() {
            try {
                await Promise.all([fetchTabMatches(tab), fetchCounts()]);
            } catch (e) {
                if (alive) setError(getErrorMessage(e));
            }
        }

        load();
        return () => { alive = false; };
    }, [tab, fetchCounts, fetchTabMatches]);

    const visibleMatches = useMemo(() => matches, [matches]);

    const tabs = [
        { key: "live", label: "Live", count: counts.live },
        { key: "scheduled", label: "Scheduled", count: counts.scheduled },
        { key: "finished", label: "Finished", count: counts.finished },
    ];

    const statusPill = (status) => {
        const base =
            "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.14em] uppercase ring-1";
        if (status === "live") {
            return (
                <span className={`${base} bg-rose-500/15 text-rose-200 ring-rose-400/40`}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
                    Live
                </span>
            );
        }
        if (status === "scheduled") {
            return <span className={`${base} bg-amber-500/15 text-amber-200 ring-amber-400/40`}>Scheduled</span>;
        }
        if (status === "finished") {
            return <span className={`${base} bg-cyan-500/15 text-cyan-200 ring-cyan-400/40`}>Finished</span>;
        }
        return <span className={`${base} bg-slate-500/15 text-slate-200 ring-slate-300/30`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-5xl">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Match Center</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">LivePulse Arena</h1>
                        <p className="mt-2 text-sm text-slate-300">Real-time matchboard with live momentum updates.</p>
                    </div>

                    {/* Tabs */}
                    <div className="mt-6 flex flex-wrap gap-2">
                        {tabs.map((t) => {
                            const active = tab === t.key;
                            return (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key)}
                                    className={[
                                        "rounded-xl border px-3 py-2 text-sm font-bold transition",
                                        active
                                            ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]"
                                            : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-500/10 hover:text-cyan-100",
                                    ].join(" ")}
                                >
                                    {t.label} <span className="opacity-80">({t.count})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {loading && <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-300">Loading matches...</div>}
                {error && <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>}

                {!loading && !error && visibleMatches.length === 0 && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-300">
                        No {tab} matches right now.
                    </div>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {visibleMatches.map((m) => (
                        <Link
                            key={m.id}
                            to={`/matches/${m.id}`}
                            className="group block rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/10"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{m.sport}</div>
                                {statusPill(m.status)}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <TeamCrest name={m.homeTeam} logo={m.homeTeamLogo} size="h-8 w-8" />
                                        <span className="truncate text-sm font-extrabold text-white group-hover:text-cyan-100">
                                            {m.homeTeam}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <TeamCrest name={m.awayTeam} logo={m.awayTeamLogo} size="h-8 w-8" />
                                        <span className="truncate text-sm font-extrabold text-white group-hover:text-cyan-100">
                                            {m.awayTeam}
                                        </span>
                                    </div>
                                </div>

                                <div className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-center">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">Score</div>
                                    <div className="mt-1 text-3xl font-black tabular-nums text-cyan-100">
                                        {m.homeScore} - {m.awayScore}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Status: <span className="text-slate-200">{m.status}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
