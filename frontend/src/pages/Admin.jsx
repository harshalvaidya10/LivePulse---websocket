import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

const STORAGE_KEY = "livepulse_admin_key";

export default function Admin() {
    const [key, setKey] = useState(localStorage.getItem(STORAGE_KEY) || "");
    const [msg, setMsg] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    function unlock() {
        const cleaned = key.trim();
        if (!cleaned) {
            setMsg("Enter a key.");
            return;
        }

        localStorage.setItem(STORAGE_KEY, cleaned);
        setMsg("Unlocked.");

        // If user was redirected from /admin/panel, go back there.
        const redirectTo = location.state?.from?.pathname || "/admin/panel";
        navigate(redirectTo, { replace: true });
    }

    function clear() {
        localStorage.removeItem(STORAGE_KEY);
        setKey("");
        setMsg("Key cleared.");
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute -right-16 top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-xl">
                <Link to="/" className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200">
                    ← Home
                </Link>

                <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Control Room</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Admin Access</h1>
                    <p className="mt-2 text-slate-300">Enter your admin key to unlock the panel.</p>

                    {msg ? (
                        <div className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm font-semibold text-cyan-100">
                            {msg}
                        </div>
                    ) : null}

                    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                        <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-300">Admin Key</label>
                        <input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="X-ADMIN-KEY"
                            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/30"
                        />

                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={unlock}
                                className="rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-black uppercase tracking-[0.1em] text-cyan-100 hover:bg-cyan-500/30"
                            >
                                Unlock
                            </button>

                            <button
                                onClick={clear}
                                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="mt-3 text-xs text-slate-400">
                            Key is stored locally in your browser.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
