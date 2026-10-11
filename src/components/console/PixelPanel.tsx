import { Play, Square, ArrowLeftRight, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { PIXEL_FX, isPixelFixture, pixelCount, type PixelMap } from "@/lib/pixels";

export function PixelPanel({ fixtures, pm, setPm, frame }: {
  fixtures: PatchedFixture[]; pm: PixelMap; setPm: (p: PixelMap) => void; frame: Map<string, [number, number, number][]>;
}) {
  const px = fixtures.filter(isPixelFixture);
  const set = (p: Partial<PixelMap>) => setPm({ ...pm, ...p });
  const inMap = pm.order.filter((u) => px.some((f) => f.uid === u));
  const toggle = (u: string) => set({ order: inMap.includes(u) ? inMap.filter((x) => x !== u) : [...inMap, u] });
  const move = (u: string, d: number) => {
    const i = inMap.indexOf(u); const j = i + d;
    if (j < 0 || j >= inMap.length) return;
    const o = [...inMap]; [o[i], o[j]] = [o[j]!, o[i]!]; set({ order: o });
  };
  const list = inMap.map((u) => px.find((f) => f.uid === u)!);
  const maxPx = Math.max(0, ...list.map(pixelCount));

  if (px.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pixel map</h2>
        <p className="text-sm text-muted-foreground">Patch a light in a pixel mode first (e.g. Astera Titan Tube → "Pixel RGB (16 px)"). Search "pixel" in Patch.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pixel map</h2>
        <button onClick={() => set({ playing: !pm.playing })} disabled={!inMap.length}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40 ${pm.playing ? "bg-destructive text-destructive-foreground" : "bg-amber-glow text-primary-foreground"}`}>
          {pm.playing ? <><Square className="h-3.5 w-3.5" />STOP</> : <><Play className="h-3.5 w-3.5" />PLAY</>}
        </button>
      </div>

      {/* live preview */}
      {list.length > 0 && (
        <div className={`flex gap-1 overflow-x-auto rounded-lg bg-background p-2 ${pm.vertical ? "flex-row" : "flex-col"}`}>
          {list.map((f) => (
            <div key={f.uid} className={`flex gap-px ${pm.vertical ? "flex-col" : "flex-row"}`}>
              {Array.from({ length: pixelCount(f) }, (_, i) => {
                const c = pm.playing ? frame.get(f.uid)?.[i] : undefined;
                return <div key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c ? `rgb(${c[0]},${c[1]},${c[2]})` : "var(--color-surface-elevated)" }} />;
              })}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {PIXEL_FX.map((e) => (
          <button key={e.id} onClick={() => set({ kind: e.id, playing: true })} className={`rounded-md py-2.5 text-xs font-semibold ${pm.kind === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>{e.label}</button>
        ))}
      </div>

      {pm.kind === "text" && (
        <div className="space-y-1">
          <input value={pm.text} onChange={(e) => set({ text: e.target.value.slice(0, 60) })} placeholder="Type text to scroll…" className="w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 font-mono text-sm uppercase" />
          <p className="text-[10px] text-muted-foreground">Text is {maxPx && pm.vertical ? maxPx : list.length} pixels tall — {pm.vertical ? "stand tubes upright side by side" : "lay tubes horizontally, stacked"}. More tubes = wider text.</p>
        </div>
      )}

      {pm.kind !== "rainbow" && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colours</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pm.colors.map((c, i) => (
              <span key={i} className="relative">
                <input type="color" value={c} onChange={(e) => set({ colors: pm.colors.map((x, j) => (j === i ? e.target.value : x)) })} className="h-9 w-9 cursor-pointer rounded border border-input bg-transparent" />
                {pm.colors.length > 1 && <button onClick={() => set({ colors: pm.colors.filter((_, j) => j !== i) })} className="absolute -right-1 -top-1 rounded-full bg-surface p-0.5"><X className="h-2.5 w-2.5" /></button>}
              </span>
            ))}
            {pm.colors.length < 8 && <button onClick={() => set({ colors: [...pm.colors, "#ffffff"] })} className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-input"><Plus className="h-4 w-4" /></button>}
          </div>
        </div>
      )}

      <Slider label="Speed" value={pm.speed} min={0.05} max={4} display={`×${pm.speed.toFixed(2)}`} onChange={(v) => set({ speed: v })} />
      {(pm.kind === "chase" || pm.kind === "wave") && <Slider label="Size" value={pm.size} min={1} max={16} step={1} display={`${pm.size} px`} onChange={(v) => set({ size: v })} />}

      <div className="flex gap-2">
        <button onClick={() => set({ vertical: !pm.vertical })} className="flex-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold">{pm.vertical ? "Tubes upright" : "Tubes horizontal"}</button>
        <button onClick={() => set({ reverse: !pm.reverse })} className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold ${pm.reverse ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><ArrowLeftRight className="h-3.5 w-3.5" />Reverse</button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Lights in map (order = position)</span>
          <button onClick={() => set({ order: inMap.length === px.length ? [] : px.map((f) => f.uid) })} className="text-primary">{inMap.length === px.length ? "None" : "All"}</button>
        </div>
        {px.map((f) => {
          const on = inMap.includes(f.uid);
          return (
            <div key={f.uid} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${on ? "bg-primary/15" : "bg-surface-elevated"}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(f.uid)} className="h-4 w-4 accent-[var(--color-primary)]" />
              {on && <span className="w-5 font-mono text-amber-glow">{inMap.indexOf(f.uid) + 1}</span>}
              <span className="min-w-0 flex-1 truncate">{f.name} <span className="text-muted-foreground">· {getDef(f.defId).model} · {pixelCount(f)} px</span></span>
              {on && <>
                <button onClick={() => move(f.uid, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(f.uid, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs"><span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><span className="font-mono">{display}</span></div>
      <input type="range" min={min} max={max} step={step ?? (max - min) / 200} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}
