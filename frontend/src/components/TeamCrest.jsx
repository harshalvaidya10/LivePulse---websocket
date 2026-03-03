import { useMemo, useState } from "react";

export default function TeamCrest({ name, logo, size = "h-10 w-10" }) {
    const [failed, setFailed] = useState(false);

    const initials = useMemo(() => {
        const parts = String(name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);
        return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
    }, [name]);

    const showImage = Boolean(logo) && !failed;

    return (
        <div className={`${size} overflow-hidden rounded-full border border-white/20 bg-slate-900/70 shadow-inner`}>
            {showImage ? (
                <img
                    src={logo}
                    alt={`${name || "Team"} crest`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-black uppercase tracking-[0.08em] text-cyan-100">
                    {initials}
                </div>
            )}
        </div>
    );
}
