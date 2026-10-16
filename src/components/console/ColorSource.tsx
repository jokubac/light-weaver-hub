import { useMemo, useState } from "react";
import { Star, Thermometer, Palette } from "lucide-react";
import { kelvinToRgb } from "@/lib/dmx";
import { GELS, type Gel } from "@/lib/gels";
import { useFavorites } from "@/lib/favorites";

const toHex = (rgb: [number, number, number]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
export const kelvinHex = (k: number) => toHex(kelvinToRgb(k));

/** Adds a colour from a Kelvin value or a Rosco / LEE gel. */
export function ColorSource({ onPick, compact, noCct }: { onPick: (hex: string, label: string) => void; compact?: boolean; noCct?: boolean }) {
  const [mode, setMode] = useState<"none" | "cct" | "gel">("none");
  const [k, setK] = useState("3200");
  const [q, setQ] = useState("");
  const fav = useFavorites("gels");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^[rl](?=\d)/, "");
    const base = s ? GELS.filter((g) => g.code.toLowerCase().startsWith(s) || g.name.toLowerCase().includes(s)) : GELS.filter((g) => fav.has(g.id));
    return base.slice(0, 30);
  }, [q, fav]);
  const b = (on: boolean) => `flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  const pickGel = (g: Gel) => { onPick(g.hex, `${g.brand === "LEE" ? "L" : "R"}${g.code}`); setMode("none"); setQ(""); };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {!noCct && <button type="button" onClick={() => setMode(mode === "cct" ? "none" : "cct")} className={b(mode === "cct")}><Thermometer className="h-3.5 w-3.5" />{compact ? "K" : "+ CCT"}</button>}
        <button type="button" onClick={() => setMode(mode === "gel" ? "none" : "gel")} className={b(mode === "gel")}><Palette className="h-3.5 w-3.5" />{compact ? "Gel" : "+ Gel"}</button>
      </div>
      {mode === "cct" && (
        <form onSubmit={(e) => { e.preventDefault(); const n = Math.min(10000, Math.max(1700, parseInt(k, 10) || 0)); if (n) { onPick(kelvinHex(n), `${n}K`); setMode("none"); } }} className="flex items-center gap-1.5">
          <input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value.replace(/\D/g, ""))} className="w-20 font-mono rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <span className="text-xs">K</span>
          <span className="h-6 w-6 rounded border border-border" style={{ background: kelvinHex(Math.min(10000, Math.max(1700, +k || 3200))) }} />
          {[2700, 3200, 4300, 5600].map((n) => <button key={n} type="button" onClick={() => { onPick(kelvinHex(n), `${n}K`); setMode("none"); }} className="rounded bg-surface-elevated px-1.5 py-1 font-mono text-[10px]">{n}</button>)}
          <button type="submit" className="ml-auto rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground">Add</button>
        </form>
      )}
      {mode === "gel" && (
        <div className="space-y-1">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gel number or name (★ favourites shown)" className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <div className="max-h-40 space-y-0.5 overflow-auto">
            {hits.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5 rounded bg-surface-elevated px-1.5 py-1 text-[11px]">
                <button type="button" onClick={() => pickGel(g)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <span className="h-4 w-4 shrink-0 rounded border border-border" style={{ background: g.hex }} />
                  <span className="w-12 font-mono font-semibold">{g.brand === "LEE" ? "L" : "R"}{g.code}</span>
                  <span className="truncate">{g.name}</span>
                </button>
                <button type="button" onClick={() => fav.toggle(g.id)} aria-label="Favourite"><Star className={`h-3.5 w-3.5 ${fav.has(g.id) ? "fill-amber-glow text-amber-glow" : "text-muted-foreground"}`} /></button>
              </div>
            ))}
            {hits.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">{q ? "No gels found" : "Type to search, or ★ gels to keep them here"}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
