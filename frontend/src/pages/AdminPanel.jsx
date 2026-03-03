import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";

const STORAGE_KEY = "livepulse_admin_key";

export default function AdminPanel() {
    const [msg, setMsg] = useState("");
    const [matches, setMatches] = useState([]);
    const [selectedMatchId, setSelectedMatchId] = useState("");

    const navigate = useNavigate();

    const [matchForm, setMatchForm] = useState({
        sport: "football",
        homeTeam: "",
        awayTeam: "",
        startTime: "",
        endTime: "",
        homeScore: 0,
        awayScore: 0,
    });

    const [commForm, setCommForm] = useState({
        minutes: 0,
        sequence: 0,
        period: "1st half",
        eventType: "update",
        actor: "",
        team: "",
        message: "",
        tags: "",
    });

    async function refreshMatches() {
        const res = await api.get("/matches", { params: { limit: 100 } });
        setMatches(res.data?.data || []);
    }

    useEffect(() => {
        refreshMatches().catch(() => { });
    }, []);

    function logout() {
        localStorage.removeItem(STORAGE_KEY);
        navigate("/admin", { replace: true });
    }

    async function createMatch(e) {
        e.preventDefault();
        setMsg("");
        try {
            const payload = {
                ...matchForm,
                homeScore: Number(matchForm.homeScore),
                awayScore: Number(matchForm.awayScore),
            };

            // send header explicitly (no interceptor needed)
            const key = localStorage.getItem(STORAGE_KEY) || "";
            const res = await api.post("/matches", payload, {
                headers: { "X-ADMIN-KEY": key },
            });

            setMsg(`Match created (id=${res.data?.data?.id}).`);
            await refreshMatches();
        } catch (err) {
            setMsg(getErrorMessage(err));
        }
    }

    async function addCommentary(e) {
        e.preventDefault();
        setMsg("");
        try {
            if (!selectedMatchId) throw new Error("Pick a match first.");

            const payload = {
                minutes: Number(commForm.minutes),
                sequence: Number(commForm.sequence),
                period: commForm.period,
                eventType: commForm.eventType,
                actor: commForm.actor || undefined,
                team: commForm.team || undefined,
                message: commForm.message,
                tags: commForm.tags
                    ? commForm.tags.split(",").map((s) => s.trim()).filter(Boolean)
                    : undefined,
            };

            const key = localStorage.getItem(STORAGE_KEY) || "";
            const res = await api.post(`/matches/${selectedMatchId}/commentary`, payload, {
                headers: { "X-ADMIN-KEY": key },
            });

            setMsg(`Commentary created (id=${res.data?.data?.id}).`);
        } catch (err) {
            setMsg(getErrorMessage(err));
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute -right-20 top-24 h-80 w-80 rounded-full bg-lime-400/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-4xl">
                <div className="flex items-center justify-between">
                    <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                        ← Home
                    </Link>
                    <button
                        onClick={logout}
                        className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                    >
                        Lock
                    </button>
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Admin Panel</h1>
                <p className="mt-1 text-slate-300">Create matches and push commentary updates.</p>

                {msg ? (
                    <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4 text-cyan-100">
                        {msg}
                    </div>
                ) : null}

                <div className="mt-6 grid grid-cols-1 gap-6">
                    {/* Create Match */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                        <h2 className="text-lg font-black uppercase tracking-[0.14em] text-cyan-200">Create Match</h2>

                        <form onSubmit={createMatch} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                                ["sport", "Sport"],
                                ["homeTeam", "Home Team"],
                                ["awayTeam", "Away Team"],
                                ["startTime", "Start Time (ISO)"],
                                ["endTime", "End Time (ISO)"],
                            ].map(([k, label]) => (
                                <div key={k}>
                                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">{label}</label>
                                    <input
                                        value={matchForm[k]}
                                        onChange={(e) => setMatchForm((p) => ({ ...p, [k]: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Home Score</label>
                                <input
                                    type="number"
                                    value={matchForm.homeScore}
                                    onChange={(e) => setMatchForm((p) => ({ ...p, homeScore: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Away Score</label>
                                <input
                                    type="number"
                                    value={matchForm.awayScore}
                                    onChange={(e) => setMatchForm((p) => ({ ...p, awayScore: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <button className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-black uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-500/30">
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Add Commentary */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black uppercase tracking-[0.14em] text-emerald-200">Add Commentary</h2>
                            <button
                                type="button"
                                onClick={() => refreshMatches().catch(() => { })}
                                className="text-sm font-bold text-slate-300 hover:text-cyan-200"
                            >
                                Refresh matches
                            </button>
                        </div>

                        <div className="mt-4">
                            <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Select Match</label>
                            <select
                                value={selectedMatchId}
                                onChange={(e) => setSelectedMatchId(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                            >
                                <option value="">Choose a match…</option>
                                {matches.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        #{m.id} — {m.homeTeam} vs {m.awayTeam} ({m.status})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <form onSubmit={addCommentary} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                                ["minutes", "Minutes", "number"],
                                ["sequence", "Sequence", "number"],
                                ["period", "Period", "text"],
                                ["eventType", "Event Type", "text"],
                                ["actor", "Actor (optional)", "text"],
                                ["team", "Team (optional)", "text"],
                            ].map(([k, label, type]) => (
                                <div key={k}>
                                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">{label}</label>
                                    <input
                                        type={type}
                                        value={commForm[k]}
                                        onChange={(e) => setCommForm((p) => ({ ...p, [k]: e.target.value }))}
                                        className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                    />
                                </div>
                            ))}

                            <div className="md:col-span-2">
                                <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Message</label>
                                <textarea
                                    value={commForm.message}
                                    onChange={(e) => setCommForm((p) => ({ ...p, message: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                    rows={3}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Tags (comma separated)</label>
                                <input
                                    value={commForm.tags}
                                    onChange={(e) => setCommForm((p) => ({ ...p, tags: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30"
                                    placeholder="goal, shot"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <button className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-sm font-black uppercase tracking-[0.1em] text-emerald-100 hover:bg-emerald-500/30">
                                    Post Commentary
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
