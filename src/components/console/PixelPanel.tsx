import { NumberField } from "./NumberField";
import { useEffect, useRef, useState } from "react";
import { Play, Square, ArrowLeftRight, Plus, X, ArrowUp, ArrowDown, Trash2, RotateCcw } from "lucide-react";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { PaletteEditor } from "./PaletteEditor";
import { Button } from "@/components/ui/button";
import { SpeedControl } from "./SpeedControl";
import { renderLayer, textMask, PIXEL_FX, POLICE_FLASHES, defaultLayer, isPixelFixture, layoutLayer, pixelCount, pixelGrid, type PixelLayer, type PixelLayout } from "@/lib/pixels";

type RGB = [number, number, number];

const LAYOUTS: { id: PixelLayout; label: string; hint: string }[] = [
  { id: "line", label: "In a line", hint: "End to end — effects flow from one light into the next" },
  { id: "upright", label: "Upright", hint: "Tubes standing side by side (best for text)" },
  { id: "stack", label: "Stacked", hint: "Horizontal lights stacked on top of each other" },
];

export function PixelPanel({ fixtures, selected = [], layers, setLayers, frame, activeId, onActiveChange }: {
  fixtures: PatchedFixture[]; selected?: string[]; layers: PixelLayer[]; setLayers: (l: PixelLayer[]) => void; frame: Map<string, RGB[]>; activeId: string; onActiveChange: (id: string) => void;
}) {
  const setActiveId = onActiveChange;
  const allPx = fixtures.filter(isPixelFixture);
  const selPx = allPx.filter((f) => selected.includes(f.uid));
  // programming works on the lights selected in the console; with nothing selected every pixel light is listed
  const px = selPx.length ? selPx : allPx;
  const layer = layers.find((l) => l.id === activeId) ?? layers[0];
  const now = useClock();
  if (!layer) return null;
  const set = (p: Partial<PixelLayer>) => setLayers(layers.map((l) => (l.id === layer.id ? { ...l, ...p } : l)));
  const setLayerRaw = (next: PixelLayer) => setLayers(layers.map((l) => (l.id === layer.id ? next : l)));
  const inMap = layer.order.filter((u) => allPx.some((f) => f.uid === u));
  const toggle = (u: string) => set({ order: inMap.includes(u) ? inMap.filter((x) => x !== u) : [...inMap, u] });
  const move = (u: string, d: number) => {
    const i = inMap.indexOf(u); const j = i + d;
    if (j < 0 || j >= inMap.length) return;
    const o = [...inMap]; [o[i], o[j]] = [o[j]!, o[i]!]; set({ order: o });
  };
  const usedElsewhere = (u: string) => layers.filter((l) => l.id !== layer.id && l.order.includes(u)).map((l) => l.name);
  const addLayer = () => {
    const l = defaultLayer(`Layer ${layers.length + 1}`, selPx.map((f) => f.uid));
    setLayers([...layers, l]);
    setActiveId(l.id);
  };
  const anyPlaying = layers.some((l) => l.playing);

  if (allPx.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pixel map</h2>
        <p className="text-sm text-muted-foreground">Patch a light in a pixel mode first (e.g. Astera Titan Tube → "Pixel RGB (16 px)"). Search "pixel" in Patch.</p>
      </div>
    );
  }

  const { placed, W, H } = layoutLayer({ ...layer, order: inMap }, fixtures);
  const preview = layer.playing ? new Map<string, RGB[]>() : renderLayer({ ...layer, order: inMap }, fixtures, now, layer.kind === "text" ? textMask(layer.text.toUpperCase(), H) : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pixel map</h2>
        {anyPlaying && <button onClick={() => setLayers(layers.map((l) => ({ ...l, playing: false })))} className="rounded-md bg-destructive px-3 py-1.5 text-[11px] font-bold text-destructive-foreground">STOP ALL</button>}
      </div>

      {/* layers: several effects can run at once on different lights */}
      <div className="flex flex-wrap gap-1.5">
        {layers.map((l) => (
          <button key={l.id} onClick={() => setActiveId(l.id)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${l.id === layer.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
            {l.playing && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-glow" />}{l.name}
          </button>
        ))}
        <button onClick={() => { const l = { ...layer, id: Math.random().toString(36).slice(2, 9), name: `${layer.name} copy`, order: [] }; setLayers([...layers, l]); setActiveId(l.id); }} className="rounded-md border border-dashed border-input px-2.5 py-1.5 text-xs">Duplicate</button>
        <button onClick={addLayer} className="flex items-center gap-1 rounded-md border border-dashed border-input px-2.5 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" />Layer</button>
      </div>

      <div className="flex gap-2">
        <input value={layer.name} onChange={(e) => set({ name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" aria-label="Layer name" />
        {layers.length > 1 && (
          <button onClick={() => { const rest = layers.filter((l) => l.id !== layer.id); setLayers(rest); setActiveId(rest[0]!.id); }} className="rounded-md bg-surface-elevated px-3 text-muted-foreground hover:text-destructive" aria-label="Delete layer"><Trash2 className="h-4 w-4" /></button>
        )}
        <button onClick={() => set({ playing: !layer.playing })} disabled={!inMap.length}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40 ${layer.playing ? "bg-destructive text-destructive-foreground" : "bg-amber-glow text-primary-foreground"}`}>
          {layer.playing ? <><Square className="h-3.5 w-3.5" />STOP</> : <><Play className="h-3.5 w-3.5" />PLAY</>}
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-surface-elevated/60 px-2 py-1.5 text-[11px]">
        <span className="min-w-0 flex-1 text-muted-foreground">{selPx.length ? `Programming ${selPx.length} selected pixel light${selPx.length > 1 ? "s" : ""}` : "No lights selected in the console — showing all pixel lights"}</span>
        {selPx.length > 0 && <button onClick={() => set({ order: selPx.map((f) => f.uid) })} className="rounded bg-primary px-2 py-1 font-semibold text-primary-foreground">Use selected</button>}
      </div>
      {!layer.playing && inMap.length > 0 && <p className="text-[10px] text-muted-foreground">Preview below — press PLAY to send it to the lights.</p>}
      {/* live preview of the layer grid */}
      {placed.length > 0 && (
        <InfiniteGrid>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${W}, 10px)`, gridTemplateRows: `repeat(${H}, 10px)` }}>
            {placed.flatMap((p, fi) => p.cells.map((c, i) => {
              const col = (layer.playing ? frame.get(p.f.uid) : preview.get(p.f.uid))?.[i];
              return <div key={`${p.f.uid}-${i}`} title={`${p.f.name} px ${i + 1}`} className="rounded-[2px]"
                style={{ gridColumn: c.x + 1, gridRow: c.y + 1, background: col ? `rgb(${col[0]},${col[1]},${col[2]})` : `hsl(${(fi * 47) % 360} 30% 22%)` }} />;
            }))}
          </div>
        </InfiniteGrid>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {PIXEL_FX.map((e) => (
          <button key={e.id} onClick={() => set({ kind: e.id })} className={`rounded-md py-2.5 text-xs font-semibold ${layer.kind === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>{e.label}</button>
        ))}
      </div>

      {layer.kind === "text" && (
        <div className="space-y-1">
          <input value={layer.text} onChange={(e) => set({ text: e.target.value.slice(0, 60) })} placeholder="Type text to scroll…" className="w-full rounded-lg border border-input bg-surface-elevated px-3 py-2.5 font-mono text-sm uppercase" />
          <p className="text-[10px] text-muted-foreground">Text is {H} pixels tall. Use "Upright" with several tubes side by side for readable letters.</p>
        </div>
      )}

      <PaletteEditor colours={layer.colors} native={["rainbow", "plasma", "fire"].includes(layer.kind) && !layer.customPalette}
        onChange={(colors) => set({ colors, customPalette: true, tint: "" })}
        onReset={() => set({ customPalette: false, tint: "" })} />

      {layer.kind === "police" && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flash pattern</div>
          <div className="grid grid-cols-4 gap-1.5">
            {POLICE_FLASHES.map((p) => (
              <button key={p.n} onClick={() => set({ flashes: p.n })} className={`rounded-md py-2 text-xs font-semibold ${(layer.flashes ?? 2) === p.n ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{p.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([["alternate", "Left / right"], ["together", "Both sides"], ["wigwag", "Wig-wag"]] as const).map(([id, l]) => (
              <button key={id} onClick={() => set({ policeMode: id })} className={`rounded-md py-2 text-xs font-semibold ${(layer.policeMode ?? "alternate") === id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {layers.length > 1 && <button onClick={() => setLayers(layers.map((l) => ({ ...l, speed: layer.speed, size: layer.size, phase: layer.phase ?? 0 })))} className="w-full rounded-md bg-surface-elevated py-2 text-xs font-semibold">Use this speed & size on all layers (run in sync)</button>}
      <SpeedControl label="Pixel speed" value={layer.speed} unit="×" onChange={(speed) => set({ speed })} />
      {["runner", "meteor", "text"].includes(layer.kind) && <div className="font-mono text-[10px] text-muted-foreground">{+(layer.speed * 10).toFixed(3)} px/s · {+(W / (layer.speed * 10)).toFixed(3)} s / map</div>}
      <Slider label="Brightness" value={layer.brightness ?? 1} min={0} max={1} display={`${Math.round((layer.brightness ?? 1) * 100)}%`} onChange={(brightness) => set({ brightness })} />
      <Slider label="Background level" value={layer.background ?? 0} min={0} max={1} display={`${Math.round((layer.background ?? 0) * 100)}%`} onChange={(background) => set({ background })} />
      {layer.kind === "runner" && <Slider label="Edge softness" value={layer.softness ?? 0} min={0} max={1} display={`${Math.round((layer.softness ?? 0) * 100)}%`} onChange={(softness) => set({ softness })} />}
      {layer.kind === "strobe" && <Slider label="On time" value={layer.duty ?? 0.5} min={0.001} max={1} display={`${+((layer.duty ?? 0.5) * 100).toFixed(1)}%`} onChange={(duty) => set({ duty })} />}
      {layer.kind === "sparkle" && <Slider label="Density" value={layer.density ?? 0.15} min={0} max={1} display={`${Math.round((layer.density ?? 0.15) * 100)}%`} onChange={(density) => set({ density })} />}
      <Slider label="Phase offset" value={layer.phase ?? 0} min={0} max={1} display={`${Math.round((layer.phase ?? 0) * 100)}%`} onChange={(phase) => set({ phase })} />
      {layer.kind === "runner" && <Slider label="Runners" value={layer.runners ?? 1} min={1} max={8} step={1} display={`${layer.runners ?? 1}`} onChange={(v) => set({ runners: v })} />}
      {layer.kind === "runner" && <p className="text-[10px] text-muted-foreground">A block of {layer.size} px travels through all {placed.length} lights ({W} px) one after another. Use "In a line".</p>}
      {["runner", "chase", "wave", "meteor", "bounce"].includes(layer.kind) && <Slider label="Size" value={layer.size} min={1} max={Math.max(32, W)} step={1} display={`${layer.size} px`} onChange={(v) => set({ size: v })} />}

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Layout</div>
        <div className="grid grid-cols-3 gap-1.5">
          {LAYOUTS.map((l) => (
            <button key={l.id} title={l.hint} onClick={() => set({ layout: l.id })} className={`rounded-md py-2 text-xs font-semibold ${layer.layout === l.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{l.label}</button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">{LAYOUTS.find((l) => l.id === layer.layout)!.hint}</p>
        <button onClick={() => set({ reverse: !layer.reverse })} className={`flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold ${layer.reverse ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><ArrowLeftRight className="h-3.5 w-3.5" />Reverse direction</button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Lights in this layer (order = position)</span>
          <button onClick={() => set({ order: inMap.length === px.length ? [] : px.map((f) => f.uid) })} className="text-primary">{inMap.length === px.length ? "None" : "All"}</button>
        </div>
        {px.map((f) => {
          const on = inMap.includes(f.uid);
          const other = usedElsewhere(f.uid);
          const [c, r] = pixelGrid(f);
          return (
            <div key={f.uid} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${on ? "bg-primary/15" : "bg-surface-elevated"}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(f.uid)} className="h-4 w-4 accent-[var(--color-primary)]" />
              {on && <span className="w-5 font-mono text-amber-glow">{inMap.indexOf(f.uid) + 1}</span>}
              <span className="min-w-0 flex-1 truncate">{f.name} <span className="text-muted-foreground">· {getDef(f.defId).model} · {pixelCount(f)} px{r > 1 ? ` (${c}×${r})` : ""}{other.length ? ` · also in ${other.join(", ")}` : ""}</span></span>
              {on && <>
                <button onClick={() => move(f.uid, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(f.uid, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
              </>}
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">If a light is in several playing layers, the lower layer in the list wins.</p>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs"><span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><span className="flex items-center gap-1 font-mono"><NumberField aria-label={`${label} value`} min={display.endsWith("%") ? min * 100 : min} max={display.endsWith("%") ? max * 100 : max} integer={step === 1} value={+(value * (display.endsWith("%") ? 100 : 1)).toFixed(2)} onChange={(n) => { if (n !== undefined) onChange(n / (display.endsWith("%") ? 100 : 1)); }} className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right" />{display.endsWith("%") ? "%" : display.endsWith("°") ? "°" : display.endsWith(" px") ? "px" : ""}</span></div>
      <input type="range" min={min} max={max} step={step ?? (max - min) / 200} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}

/** Seconds since mount, refreshed every animation frame (drives the effect preview). */
export function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const loop = () => { setT((performance.now() - start) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

/** Endless preview viewport; gestures change only the view, never the programmed output. */
function InfiniteGrid({ children }: { children: React.ReactNode }) {
  const [pan, setPan] = useState<[number, number]>([12, 12]);
  const [zoom, setZoom] = useState(1);
  const [tilt, setTilt] = useState(0);
  const [turn, setTurn] = useState(0);
  const pointers = useRef(new Map<number, [number, number]>());
  const gesture = useRef<{ pan: [number, number]; zoom: number; turn: number; tilt: number; mid: [number, number]; distance: number; angle: number; count: number } | null>(null);
  const measure = () => {
    const pts = [...pointers.current.values()];
    const a = pts[0], b = pts[1];
    if (!a) return null;
    return { mid: [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] as [number, number], distance: b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 1, angle: b ? Math.atan2(b[1] - a[1], b[0] - a[0]) : 0, count: pts.length };
  };
  const begin = () => { const m = measure(); gesture.current = m ? { ...m, pan, zoom, turn, tilt } : null; };
  const end = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); begin(); };
  const cell = 11 * zoom;
  return <div className="space-y-2">
    <div aria-label="Pixel mapping viewport" className="relative h-56 touch-none overflow-hidden rounded-lg bg-background"
      style={{ backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)", backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `${pan[0]}px ${pan[1]}px` }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, [e.clientX, e.clientY]); begin(); }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, [e.clientX, e.clientY]); const m = measure(), g = gesture.current;
        if (!m || !g) return;
        if (m.count >= 3 || e.shiftKey) setTilt(Math.max(-80, Math.min(80, g.tilt + (m.mid[1] - g.mid[1]) * .4)));
        else {
          setPan([g.pan[0] + m.mid[0] - g.mid[0], g.pan[1] + m.mid[1] - g.mid[1]]);
          if (m.count === 2) {
            setZoom(Math.max(.1, Math.min(10, g.zoom * m.distance / Math.max(1, g.distance))));
            const delta = Math.atan2(Math.sin(m.angle - g.angle), Math.cos(m.angle - g.angle));
            setTurn(g.turn + delta * 180 / Math.PI);
          }
        }
      }} onPointerUp={end} onPointerCancel={end}
      onWheel={(e) => setZoom((z) => Math.max(.1, Math.min(10, z * (e.deltaY < 0 ? 1.1 : .9))))}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${pan[0]}px, ${pan[1]}px) scale(${zoom}) rotate(${turn}deg) scaleY(${Math.cos(tilt * Math.PI / 180)})` }}>{children}</div>
      <div className="absolute bottom-1.5 right-1.5 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.min(10, z * 1.25))} title="Zoom in" aria-label="Zoom in"><Plus /></Button>
        <Button size="icon" variant="secondary" onClick={() => setZoom((z) => Math.max(.1, z / 1.25))} title="Zoom out" aria-label="Zoom out">−</Button>
        <Button size="icon" variant="secondary" title="Reset pixel view" aria-label="Reset pixel view" onClick={() => { setZoom(1); setPan([12, 12]); setTilt(0); setTurn(0); }}><RotateCcw /></Button>
      </div>
    </div>
    <Slider label="View tilt" value={tilt} min={-80} max={80} step={1} display={`${Math.round(tilt)}°`} onChange={setTilt} />
    <Slider label="View rotation" value={((turn + 180) % 360 + 360) % 360 - 180} min={-180} max={180} step={1} display={`${Math.round(turn)}°`} onChange={setTurn} />
  </div>;
}
