import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "./NumberField";
import { useEffect, useRef, useState } from "react";
import { Play, Square, ArrowLeftRight, Plus, X, ArrowUp, ArrowDown, Trash2, Scan, ChevronDown, ChevronRight, Copy, ClipboardPaste } from "lucide-react";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { groupNamesOf, membersOf } from "@/lib/fixture-groups";
import { PaletteEditor } from "./PaletteEditor";
import { Button } from "@/components/ui/button";
import { SpeedControl } from "./SpeedControl";
import { PIXEL_LIBRARY, PIXEL_GROUPS, lookOf, POLICE_FLASHES, defaultLayer, initArea, isPixelFixture, pixelCount, pixelGrid, stageSize, copyPixelEffect, pastePixelEffect, applyPixelEffect, savePixelEffectClipboard, loadPixelEffectClipboard, type PixelLayer, type PixelEffectClipboard } from "@/lib/pixels";
import { pixelPreview } from "./pixel-preview";
import { saveVideo, videoMissing } from "@/lib/pixel-media";

type RGB = [number, number, number];

export function PixelPanel({ fixtures, selected = [], layers, setLayers, frame, activeId, onActiveChange, pixelMaster = 1, onPixelMaster, hidePreview }: {
  hidePreview?: boolean; fixtures: PatchedFixture[]; selected?: string[]; layers: PixelLayer[]; setLayers: (l: PixelLayer[]) => void; frame: Map<string, RGB[]>; activeId: string; onActiveChange: (id: string) => void;
  pixelMaster?: number; onPixelMaster?: (value: number) => void;
}) {
  const setActiveId = onActiveChange;
  const [coloursOpen, setColoursOpen] = useState(true);
  const [effectsOpen, setEffectsOpen] = useState(true);
  const [fixturesOpen, setFixturesOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(true);
  const [effectClip, setEffectClip] = useState<PixelEffectClipboard | null>(null);
  useEffect(() => { setEffectClip(loadPixelEffectClipboard()); }, []);
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
    const l = { ...defaultLayer(`Layer ${layers.length + 1}`, selPx.map((f) => f.uid)), area: initArea(stageSize()) };
    setLayers([...layers, l]);
    setActiveId(l.id);
  };
  const anyPlaying = layers.some((l) => l.playing);
  const copyEffect = () => { const c = copyPixelEffect(layer); setEffectClip(c); savePixelEffectClipboard(c); };
  const pasteEffect = () => {
    if (!effectClip) return;
    const selIds = selPx.map((f) => f.uid);
    if (selIds.length && !selIds.every((u) => inMap.includes(u))) {
      // selected lights that aren't in this layer yet get a fresh copy of the effect
      const l = pastePixelEffect(`${layer.name} paste`, selIds, effectClip);
      setLayers([...layers, l]);
      setActiveId(l.id);
    } else {
      setLayerRaw(applyPixelEffect(layer, effectClip));
    }
  };

  // preview only the lights placed on the PIXEL map (when any are placed)
  const mapUids = new Set(fixtures.filter((f) => f.pixelPos).map((f) => f.uid));
  const onlyMap = (u: string) => !mapUids.size || mapUids.has(u);
  const { placed, W, H, frame: preview } = pixelPreview({ ...layer, order: inMap.filter(onlyMap) }, fixtures, new Map([...frame].filter(([u]) => onlyMap(u))), now);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pixel map</h2>
        {anyPlaying && <button onClick={() => setLayers(layers.map((l) => ({ ...l, playing: false })))} className="rounded-md bg-destructive px-3 py-1.5 text-[11px] font-bold text-destructive-foreground">STOP ALL</button>}
      </div>

      {allPx.length === 0 && <p className="rounded-md bg-surface-elevated/60 px-2 py-1.5 text-[11px] text-muted-foreground">No pixel lights yet — you can prepare effects now. Patch a light in a pixel mode (search "pixel" in PATCH) to play them.</p>}
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
        <input value={layer.name} onChange={(e) => set({ name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" aria-label="Layer name" />
        <button onClick={copyEffect} title="Copy this pixel effect" aria-label="Copy pixel effect" className="rounded-md bg-surface-elevated px-2 py-2 text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
        <button onClick={pasteEffect} disabled={!effectClip} title="Paste the copied effect onto the selected lights" aria-label="Paste pixel effect" className="rounded-md bg-surface-elevated px-2 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"><ClipboardPaste className="h-4 w-4" /></button>
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
      {placed.length > 0 && !hidePreview && (
        <InfiniteGrid columns={W} rows={H}>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${W}, 10px)`, gridTemplateRows: `repeat(${H}, 10px)` }}>
            {placed.flatMap((p, fi) => p.cells.map((c, i) => {
              const col = preview.get(p.f.uid)?.[i];
              return <div key={`${p.f.uid}-${i}`} title={`${p.f.name} px ${i + 1}`} className="rounded-[2px]"
                style={{ gridColumn: c.x + 1, gridRow: c.y + 1, background: col ? `rgb(${col[0]},${col[1]},${col[2]})` : `hsl(${(fi * 47) % 360} 30% 22%)` }} />;
            }))}
          </div>
        </InfiniteGrid>
      )}

      <section className="space-y-2" aria-label="Pixel effects">
        <Button variant="ghost" className="w-full justify-start px-0" aria-expanded={effectsOpen} aria-controls="pixel-effect-choices" onClick={() => setEffectsOpen((open) => !open)}>
          {effectsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Effects
          <span className="ml-auto text-xs text-muted-foreground">{lookOf(layer)?.label}</span>
        </Button>
        <div id="pixel-effect-choices" hidden={!effectsOpen} className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Every effect plays over the whole PIXEL canvas like a video — each light shows the part it sits on.</p>
          {PIXEL_GROUPS.map((g) => (
            <div key={g} className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
              <div className="grid grid-cols-3 gap-1">
                {PIXEL_LIBRARY.filter((x) => x.group === g).map((x) => {
                  const on = !layer.empty && lookOf(layer)?.key === x.key;
                  return <button key={x.key} aria-pressed={on} onClick={() => set(x.gen ? { kind: x.kind, gen: x.gen, empty: false } : { kind: x.kind, empty: false })}
                    className={`rounded-md px-1 py-1.5 text-[11px] font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{x.label}</button>;
                })}
              </div>
            </div>
          ))}

      {layer.kind === "video" && (
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-input py-3 text-xs font-semibold hover:border-primary">
            {layer.videoName ? `Video: ${layer.videoName} — replace` : "Choose a video (MP4, MOV, WebM)"}
            <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = "";
              if (!file) return;
              try { const id = await saveVideo(file); set({ videoId: id, videoName: file.name }); } catch { alert("This video could not be saved on this device."); }
            }} />
          </label>
          {videoMissing(layer.videoId) && <p className="text-[10px] text-destructive">This video is not on this device — choose it again.</p>}
          <p className="text-[10px] text-muted-foreground">The video fills the whole PIXEL canvas and loops; each light shows its spot. It is kept only on this device.</p>
        </div>
      )}

      {layer.kind === "text" && (
        <div className="space-y-1">
          <input value={layer.text} onChange={(e) => set({ text: e.target.value.slice(0, 60) })} placeholder="Type text to scroll…" className="w-full font-mono uppercase rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <p className="text-[10px] text-muted-foreground">Text is {H} pixels tall.</p>
        </div>
      )}

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

      <div className="space-y-1.5">
        <button onClick={() => set({ reverse: !layer.reverse })} className={`flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-semibold ${layer.reverse ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><ArrowLeftRight className="h-3.5 w-3.5" />Reverse direction</button>
      </div>
        </div>
      </section>
      <section className="space-y-2" aria-label="Pixel speed settings">
        {onPixelMaster && <Slider label="Pixel master" value={pixelMaster} min={0} max={1} display={`${Math.round(pixelMaster * 100)}%`} onChange={onPixelMaster} />}
        <Button variant="ghost" className="w-full justify-start px-0" aria-expanded={speedOpen} aria-controls="pixel-speed-settings" onClick={() => setSpeedOpen((open) => !open)}>{speedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Pixel speed</Button>
        <div id="pixel-speed-settings" hidden={!speedOpen} className="space-y-3">
      {layers.length > 1 && <button onClick={() => setLayers(layers.map((l) => ({ ...l, speed: layer.speed, size: layer.size, phase: layer.phase ?? 0 })))} className="w-full rounded-md bg-surface-elevated py-2 text-xs font-semibold">Use this speed & size on all layers (run in sync)</button>}
      <SpeedControl label="Pixel speed" value={layer.speed} unit="×" onChange={(speed) => set({ speed })} />
      {["runner", "meteor", "text"].includes(layer.kind) && <div className="font-mono text-[10px] text-muted-foreground">{+(layer.speed * 10).toFixed(3)} px/s · {+(W / (layer.speed * 10)).toFixed(3)} s / map</div>}
      <Slider label="Brightness" value={layer.brightness ?? 1} min={0} max={1} display={`${Math.round((layer.brightness ?? 1) * 100)}%`} onChange={(brightness) => set({ brightness })} />
      <Slider label="Background level" value={layer.background ?? 0} min={0} max={1} display={`${Math.round((layer.background ?? 0) * 100)}%`} onChange={(background) => set({ background })} />
      {layer.kind === "runner" && <Slider label="Edge softness" value={layer.softness ?? 0} min={0} max={1} display={`${Math.round((layer.softness ?? 0) * 100)}%`} onChange={(softness) => set({ softness })} />}
      {layer.kind === "strobe" && <Slider label="On time" value={layer.duty ?? 0.5} min={0.001} max={1} display={`${+((layer.duty ?? 0.5) * 100).toFixed(1)}%`} onChange={(duty) => set({ duty })} />}
      {layer.kind === "sparkle" && <Slider label="Density" value={layer.density ?? 0.15} min={0} max={1} display={`${Math.round((layer.density ?? 0.15) * 100)}%`} onChange={(density) => set({ density })} />}
      <Slider label="Spread" value={layer.spread ?? 0} min={0} max={8} step={0.5} display={`${layer.spread ?? 0} px`} onChange={(spread) => set({ spread })} />
      <Slider label="Blur" value={layer.blur ?? 0} min={0} max={8} step={0.5} display={`${layer.blur ?? 0} px`} onChange={(blur) => set({ blur })} />
      <Slider label="Edge fade" value={layer.feather ?? 0} min={0} max={20} step={1} display={`${layer.feather ?? 0} px`} onChange={(feather) => set({ feather })} />
      <Slider label="Phase offset" value={layer.phase ?? 0} min={0} max={1} display={`${Math.round((layer.phase ?? 0) * 100)}%`} onChange={(phase) => set({ phase })} />
      {layer.kind === "runner" && <Slider label="Runners" value={layer.runners ?? 1} min={1} max={8} step={1} display={`${layer.runners ?? 1}`} onChange={(v) => set({ runners: v })} />}
      {layer.kind === "runner" && <p className="text-[10px] text-muted-foreground">A block of {layer.size} px travels through all {placed.length} lights ({W} px) one after another.</p>}
      {["runner", "chase", "wave", "meteor", "bounce"].includes(layer.kind) && <Slider label="Size" value={layer.size} min={1} max={Math.max(32, W)} step={1} display={`${layer.size} px`} onChange={(v) => set({ size: v })} />}

        </div>
      </section>
      <section className="space-y-2" aria-label="Pixel colours">
        <Button variant="ghost" className="w-full justify-start px-0" aria-expanded={coloursOpen} aria-controls="pixel-colour-editor" onClick={() => setColoursOpen((open) => !open)}>
          {coloursOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Colours
          {!coloursOpen && <span className="ml-auto flex gap-1" aria-hidden="true">{layer.colors.map((colour, i) => <span key={i} className="h-3 w-3 rounded-sm" style={{ background: colour }} />)}</span>}
        </Button>
        <div id="pixel-colour-editor" hidden={!coloursOpen}>
          <PaletteEditor colours={layer.colors} native={["rainbow", "plasma", "generator", "twinkle"].includes(layer.kind) && !layer.customPalette}
            onChange={(colors) => set({ colors, customPalette: true, tint: "" })}
            onReset={() => set({ customPalette: false, tint: "" })} />
        </div>
      </section>
      <section className="space-y-2" aria-label="Pixel fixtures">
        <Button variant="ghost" className="w-full justify-start px-0" aria-expanded={fixturesOpen} aria-controls="pixel-fixture-choices" onClick={() => setFixturesOpen((open) => !open)}>{fixturesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Fixtures<span className="ml-auto text-xs text-muted-foreground">{inMap.length}</span></Button>
        <div id="pixel-fixture-choices" hidden={!fixturesOpen} className="space-y-3">
      {(() => { const gs = groupNamesOf(allPx); return gs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Groups</div>
          <div className="flex flex-wrap gap-1.5">{gs.map((g) => { const ids = membersOf(allPx, g).map((f) => f.uid); const all = ids.every((u) => inMap.includes(u)); return (
            <button key={g} aria-pressed={all} onClick={() => set({ order: all ? inMap.filter((u) => !ids.includes(u)) : [...inMap, ...ids.filter((u) => !inMap.includes(u))] })} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${all ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{g}</button>); })}</div>
        </div>); })()}
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
              <Checkbox checked={on} onCheckedChange={() => toggle(f.uid)} />
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
      </section>
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
    let raf = 0; const start = 0;
    const loop = () => { setT((performance.now() - start) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

/** Endless preview viewport; gestures change only the view, never the programmed output. */
function InfiniteGrid({ children, columns, rows }: { children: React.ReactNode; columns: number; rows: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState<[number, number]>([12, 12]);
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const gridWidth = columns * 11 - 1;
  const gridHeight = rows * 11 - 1;
  const fitZoom = Math.max(0.001, Math.min(Math.max(1, size.width - 32) / gridWidth, Math.max(1, size.height - 64) / gridHeight));
  const viewZoom = autoFit ? fitZoom : zoom;
  const viewPan: [number, number] = autoFit ? [(size.width - gridWidth * fitZoom) / 2, (size.height - gridHeight * fitZoom) / 2] : pan;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setAutoFit(true); }, [columns, rows]);
  const changeZoom = (factor: number) => {
    const next = Math.max(.001, Math.min(32, viewZoom * factor));
    const ratio = next / viewZoom;
    setPan([size.width / 2 - (size.width / 2 - viewPan[0]) * ratio, size.height / 2 - (size.height / 2 - viewPan[1]) * ratio]);
    setZoom(next);
    setAutoFit(false);
  };
  const pointers = useRef(new Map<number, [number, number]>());
  const gesture = useRef<{ pan: [number, number]; zoom: number; mid: [number, number]; distance: number; angle: number; count: number } | null>(null);
  const measure = () => {
    const pts = [...pointers.current.values()];
    const a = pts[0], b = pts[1];
    if (!a) return null;
    return { mid: [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] as [number, number], distance: b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 1, angle: b ? Math.atan2(b[1] - a[1], b[0] - a[0]) : 0, count: pts.length };
  };
  const begin = () => { const m = measure(); gesture.current = m ? { ...m, pan: viewPan, zoom: viewZoom } : null; };
  const end = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); begin(); };
  const cell = 11 * viewZoom;
  return <div className="space-y-2">
    <div ref={viewport} aria-label="Pixel mapping viewport" className="relative h-56 touch-none overflow-hidden rounded-lg bg-background"
      style={{ backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)", backgroundSize: `${cell}px ${cell}px`, backgroundPosition: `${viewPan[0]}px ${viewPan[1]}px` }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, [e.clientX, e.clientY]); begin(); }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, [e.clientX, e.clientY]); const m = measure(), g = gesture.current;
        if (!m || !g) return;
        setAutoFit(false);
        setPan([g.pan[0] + m.mid[0] - g.mid[0], g.pan[1] + m.mid[1] - g.mid[1]]);
        setZoom(m.count === 2 ? Math.max(.001, Math.min(32, g.zoom * m.distance / Math.max(1, g.distance))) : g.zoom);
      }} onPointerUp={end} onPointerCancel={end}
      onWheel={(e) => changeZoom(e.deltaY < 0 ? 1.1 : .9)}>
      <div data-testid="pixel-preview-grid" className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${viewPan[0]}px, ${viewPan[1]}px) scale(${viewZoom})` }}>{children}</div>
      <div className="absolute bottom-1.5 right-1.5 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <Button size="icon" variant="secondary" onClick={() => changeZoom(1.25)} title="Zoom in" aria-label="Zoom in"><Plus /></Button>
        <Button size="icon" variant="secondary" onClick={() => changeZoom(.8)} title="Zoom out" aria-label="Zoom out">−</Button>
        <Button size="icon" variant="secondary" title="Scale to fit" aria-label="Scale to fit" aria-pressed={autoFit} onClick={() => setAutoFit(true)}><Scan /></Button>
      </div>
    </div>
  </div>;
}
