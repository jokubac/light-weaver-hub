import { useMemo, useRef, useState } from "react";
import { Search, X, Fan, Star } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { FAN_MODES, cctFromKelvin, kelvin, type PatchedFixture } from "@/lib/dmx";
import { GELS, GEL_BY_ID, hexToHs, type Gel } from "@/lib/gels";

type Upd = (p: Partial<PatchedFixture>) => void;
type UpdEach = (fn: (f: PatchedFixture) => Partial<PatchedFixture>) => void;

const btn = "rounded-md bg-surface-elevated py-2 text-xs font-semibold active:scale-95";
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function IntensityMacros({ updateEach }: { updateEach: UpdEach }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[-10, -1, 1, 10].map((d) => (
        <button key={d} onClick={() => updateEach((f) => ({ intensity: clamp(Math.round(f.intensity * 100 + d) / 100, 0, 1) }))} className={`${btn} font-mono`}>{d > 0 ? `+${d}` : d}</button>
      ))}
    </div>
  );
}

const KELVINS = [2700, 3200, 4000, 5600, 6000, 10000];
export function CctMacros({ value, update }: { value: number; update: Upd }) {
  const [k, setK] = useState("");
  const apply = (n: number) => update({ cct: clamp(cctFromKelvin(clamp(n, 2000, 10000)), 0, 1) });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-1">
        {KELVINS.map((n) => (
          <button key={n} onClick={() => apply(n)} className={`rounded-md py-2 font-mono text-[11px] font-semibold active:scale-95 ${kelvin(value) === n ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{n >= 10000 ? "10K" : `${n / 1000}K`.replace(".", ",")}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const n = parseInt(k, 10); if (n) apply(n); setK(""); }} className="flex gap-2">
        <input inputMode="numeric" value={k} onChange={(e) => setK(e.target.value.replace(/\D/g, ""))} placeholder="Type Kelvin (2000–10000)" className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 font-mono text-sm" />
        <button type="submit" className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Set</button>
      </form>
    </div>
  );
}

const GM_STEPS: { v: number; l: string }[] = [
  { v: -1, l: "−1" }, { v: -0.5, l: "−½" }, { v: -0.25, l: "−¼" }, { v: 0, l: "0" }, { v: 0.25, l: "+¼" }, { v: 0.5, l: "+½" }, { v: 1, l: "+1" },
];
export function GmMacros({ value, update }: { value: number; update: Upd }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1">
        {GM_STEPS.map((s) => (
          <button key={s.v} onClick={() => update({ gm: s.v })} className={`rounded-md py-2 text-[11px] font-semibold active:scale-95 ${Math.abs(value - s.v) < 0.01 ? "bg-primary text-primary-foreground" : s.v < 0 ? "bg-surface-elevated text-[rgb(255,120,220)]" : s.v > 0 ? "bg-surface-elevated text-success" : "bg-surface-elevated"}`}>{s.l}</button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">− = minus green (magenta) · + = plus green · steps like ¼, ½, full gel</p>
    </div>
  );
}

/** Hue/saturation colour wheel. Tapping switches the light to full colour (HSI) mix. */
export function ColorWheel({ hue, sat, crossfade, update }: { hue: number; sat: number; crossfade: number; update: Upd }) {
  const ref = useRef<HTMLDivElement>(null);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const s = clamp(Math.hypot(x, y) / (r.width / 2), 0, 1);
    const h = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    update({ hue: h, saturation: s, cctOnly: false, ...(crossfade < 1 ? { crossfade: 1 } : {}), gel: "" });
  };
  const a = ((hue - 90) * Math.PI) / 180;
  return (
    <div className="flex items-center gap-4">
      <div ref={ref} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); pick(e); }} onPointerMove={(e) => e.buttons && pick(e)}
        className="relative aspect-square w-40 shrink-0 touch-none rounded-full"
        style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
        <div className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow"
          style={{ left: `${50 + Math.cos(a) * sat * 50}%`, top: `${50 + Math.sin(a) * sat * 50}%`, background: `hsl(${hue} ${sat * 100}% ${100 - sat * 50}%)` }} />
      </div>
      <div className="space-y-1 font-mono text-xs">
        <div>H {Math.round(hue)}°</div>
        <div>S {Math.round(sat * 100)}%</div>
        <div className="text-muted-foreground">Mix {Math.round(crossfade * 100)}%</div>
      </div>
    </div>
  );
}

export function FanControl({ value, update }: { value: PatchedFixture["fan"]; update: Upd }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {FAN_MODES.map((m) => (
        <button key={m} onClick={() => update({ fan: m })} className={`flex items-center justify-center gap-1 rounded-md py-2 text-[11px] font-semibold capitalize active:scale-95 ${(value ?? "auto") === m ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
          {m === "auto" && <Fan className="h-3 w-3" />}{m}
        </button>
      ))}
    </div>
  );
}

/** Rosco / LEE gel picker: corrections set CCT / G-M, colours set hue + saturation. */
export function GelPicker({ value, update }: { value?: string; update: Upd }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<"all" | "Rosco" | "LEE" | "fav">("all");
  const fav = useFavorites("gels");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GELS.filter((g) => (brand === "all" || (brand === "fav" ? fav.has(g.id) : g.brand === brand)) && (!s || g.code.toLowerCase().startsWith(s.replace(/^[rl]/, "")) || g.name.toLowerCase().includes(s))).slice(0, 80);
  }, [q, brand, fav]);
  const cur = value ? GEL_BY_ID[value] : undefined;
  const apply = (g: Gel) => {
    if (g.kelvin) update({ cct: clamp(cctFromKelvin(g.kelvin), 0, 1), crossfade: 0, gel: g.id });
    else if (g.gm !== undefined) update({ gm: g.gm, gel: g.id });
    else { const { h, s } = hexToHs(g.hex); update({ hue: h, saturation: s, crossfade: 1, cctOnly: false, gel: g.id }); }
  };
  return (
    <div className="space-y-2">
      {cur && (
        <div className="flex items-center gap-2 rounded-md bg-primary/15 px-2 py-1.5 text-xs">
          <span className="h-5 w-5 rounded" style={{ background: cur.hex }} />
          <span className="flex-1 font-semibold">{cur.brand} {cur.code} · {cur.name}</span>
          <button onClick={() => update({ gel: "" })} aria-label="Clear gel"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="flex gap-1">
        {(["all", "Rosco", "LEE", "fav"] as const).map((b) => (
          <button key={b} onClick={() => setBrand(b)} className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold ${brand === b ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{b === "all" ? "All" : b === "fav" ? `★ ${fav.list.length}` : b}</button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number or name (e.g. 201, CTO, 3202)" className="w-full rounded-md border border-input bg-surface-elevated py-2 pl-9 pr-3 text-sm" />
      </div>
      <div className="max-h-56 space-y-1 overflow-auto">
        {hits.map((g) => (
          <div key={g.id} className={`flex items-center gap-1 rounded-md pr-2 ${value === g.id ? "bg-primary/20" : "bg-surface-elevated"}`}>
          <button onClick={() => apply(g)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs active:scale-[0.98]">
            <span className="h-5 w-5 shrink-0 rounded border border-border" style={{ background: g.hex }} />
            <span className="w-14 font-mono font-semibold">{g.brand === "LEE" ? "L" : "R"}{g.code}</span>
            <span className="min-w-0 flex-1 truncate">{g.name}</span>
            {g.kelvin && <span className="font-mono text-[10px] text-muted-foreground">{g.kelvin}K</span>}
          </button>
          <button onClick={() => fav.toggle(g.id)} aria-label="Favourite gel"><Star className={`h-3.5 w-3.5 ${fav.has(g.id) ? "fill-amber-glow text-amber-glow" : "text-muted-foreground"}`} /></button>
          </div>
        ))}
        {hits.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">{brand === "fav" ? "No favourites yet — tap ★ on a gel" : "No gels found"}</p>}
      </div>
      <p className="text-[10px] text-muted-foreground">{GELS.length} gels. Colours are approximate on LED lights.</p>
    </div>
  );
}
