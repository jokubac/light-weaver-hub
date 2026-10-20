import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type React from "react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCw, ZoomIn, ZoomOut, LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { layerAt, canvasPositions, canvasSize, layerArea, renderCanvasComposite, stageSize, textMask, isPixelFixture, pixelCount, pixelGrid, pixelCell, type PixelLayer } from "@/lib/pixels";
import { pixelPreview } from "./pixel-preview";
import { useClock } from "./PixelPanel";

type RGB = [number, number, number];

/** PIXEL window: free canvas where pixel lights are placed like on the GRID, a strip with every light, and the effect controls. */
export function PixelStage({ fixtures, layers, activeId, frame, controls, onMove, onToggle, onArea, onSelect, onAdd, onPlay, onPause, onRemoveLayer, onRemoveLight, onLayer, addFixtures }: {
  addFixtures?: ReactNode;
  fixtures: PatchedFixture[]; layers: PixelLayer[]; activeId: string; frame: Map<string, RGB[]>; controls: ReactNode;
  onMove: (uid: string, pos: { x: number; y: number; r?: number }) => void; onToggle: (uid: string) => void;
  onSelect?: (id: string) => void; onAdd?: () => void; onPlay?: (id: string) => void; onPause?: (id: string) => void; onRemoveLayer?: (id: string) => void; onRemoveLight?: (uid: string) => void;
  onArea?: (area: { x: number; y: number; w: number; h: number }) => void;
  onLayer?: (patch: Partial<PixelLayer>) => void;
}) {
  const [cell, setCell] = useState(20);
  // zoom is the cell size so drag maths stay in exact grid units; the map itself never rotates
  const scroller = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; a: number; mx: number; my: number; cell: number; effect: null | { area: { x: number; y: number; w: number; h: number }; angle: number } } | null>(null);
  /** screen delta → grid delta */
  const toLocal = (dx: number, dy: number) => [dx / cell, dy / cell] as const;
  const [addOpen, setAddOpen] = useState(false);
  const now = useClock();
  const px = fixtures.filter((f) => isPixelFixture(f) && !!f.pixelPos);
  const layer = layers.find((l) => l.id === activeId) ?? layers[0];
  const pos = canvasPositions(fixtures);
  const preview = layer ? pixelPreview({ ...layer, order: layer.order.filter((u) => px.some((f) => f.uid === u)) }, fixtures, frame, now).frame : frame;
  const drag = useRef<{ uid: string; x: number; y: number; ox: number; oy: number; moved: boolean; group: { f: PatchedFixture; p: { x: number; y: number; r?: number } }[] } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const marquee = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const [mq, setMq] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const stage = stageSize(fixtures);
  const W = stage.W, H = stage.H;
  const rec = useRef<{ start: number; pts: { t: number; x: number; y: number; a: number }[] } | null>(null);
  const [recording, setRecording] = useState(false);
  const live = layer && !recording ? layerAt(layer, now) : layer;
  const area = layerArea(live ?? {}, stage);
  const baseArea = layerArea(layer ?? {}, stage);
  const sample = (x: number, y: number, a: number) => { const r = rec.current; if (r) r.pts.push({ t: performance.now() / 1000 - r.start, x, y, a }); };
  const setArea = (a: { x: number; y: number; w: number; h: number }) => { onArea?.(a); sample(a.x, a.y, layer?.angle ?? 0); };
  const setAngle = (a: number) => { onLayer?.({ angle: a }); sample(baseArea.x, baseArea.y, a); };
  const toggleRec = () => {
    if (!layer || !onLayer) return;
    if (!rec.current) { rec.current = { start: performance.now() / 1000, pts: [] }; sample(baseArea.x, baseArea.y, layer.angle ?? 0); onLayer({ motion: [], motionLen: 0, area: baseArea }); setRecording(true); return; }
    const r = rec.current; rec.current = null; setRecording(false);
    const len = performance.now() / 1000 - r.start;
    if (r.pts.length > 1 && len > 0.2) { const last = r.pts[r.pts.length - 1]!; onLayer({ motion: [...r.pts, { ...last, t: len }], motionLen: len }); }
  };
  const toGrid = (cx: number, cy: number) => { const b = board.current?.getBoundingClientRect(); if (!b) return [0, 0] as const; const [lx, ly] = toLocal(cx - (b.left + b.width / 2), cy - (b.top + b.height / 2)); return [lx + W / 2, ly + H / 2] as const; };
  const pair = () => { const [p, q] = [...touches.current.values()]; return { d: Math.hypot(q!.x - p!.x, q!.y - p!.y) || 1, a: (Math.atan2(q!.y - p!.y, q!.x - p!.x) * 180) / Math.PI, mx: (p!.x + q!.x) / 2, my: (p!.y + q!.y) / 2 }; };
  const gDown = (e: React.PointerEvent) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 1) {
      // dragging on an empty map spot draws a selection rectangle over the lights
      const t = e.target as HTMLElement;
      if (t === board.current || t === bg.current) {
        const [gx, gy] = toGrid(e.clientX, e.clientY);
        marquee.current = { id: e.pointerId, x0: gx, y0: gy };
        setMq({ x: gx, y: gy, w: 0, h: 0 });
      }
      return;
    }
    marquee.current = null; setMq(null);
    if (touches.current.size !== 2) return;
    drag.current = null; areaDrag.current = null;
    const g = pair(); const [gx, gy] = toGrid(g.mx, g.my); const a = baseArea;
    // two fingers inside the selected effect box move/scale/rotate the effect, elsewhere the whole map
    const onEffect = !!layer && onLayer && gx >= a.x && gy >= a.y && gx <= a.x + a.w && gy <= a.y + a.h;
    gesture.current = { ...g, cell, effect: onEffect ? { area: a, angle: layer!.angle ?? 0 } : null };
  };
  const gMove = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = marquee.current;
    if (m && touches.current.size === 1 && e.pointerId === m.id) {
      const [gx, gy] = toGrid(e.clientX, e.clientY);
      const r = { x: Math.min(m.x0, gx), y: Math.min(m.y0, gy), w: Math.abs(gx - m.x0), h: Math.abs(gy - m.y0) };
      setMq(r);
      const hit = new Set<string>();
      for (const f of px) { const p = pos.get(f.uid); if (!p) continue; const [w, h] = canvasSize({ ...f, pixelPos: p });
        if (p.x < r.x + r.w && p.x + w > r.x && p.y < r.y + r.h && p.y + h > r.y) hit.add(f.uid); }
      setSel(hit);
      return;
    }
    const s0 = gesture.current; if (!s0 || touches.current.size < 2) return;
    e.stopPropagation(); drag.current = null; areaDrag.current = null;
    const g = pair(), k = g.d / s0.d, rot = g.a - s0.a;
    if (s0.effect) {
      const a0 = s0.effect.area; const [dx, dy] = toLocal(g.mx - s0.mx, g.my - s0.my);
      const w = Math.max(1, Math.min(W, Math.round(a0.w * k))), h = Math.max(1, Math.min(H, Math.round(a0.h * k)));
      const cx = a0.x + a0.w / 2 + dx, cy = a0.y + a0.h / 2 + dy;
      const area2 = layerArea({ area: { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h } }, stage);
      const ang = ((s0.effect.angle + rot + 540) % 360) - 180;
      onLayer?.({ area: area2, angle: ang }); sample(area2.x, area2.y, ang);
    } else {
      setCell(Math.max(4, Math.min(60, s0.cell * k)));
      const sc = scroller.current; if (sc) { sc.scrollLeft -= g.mx - s0.mx; sc.scrollTop -= g.my - s0.my; }
      gesture.current = { ...s0, mx: g.mx, my: g.my };
    }
  };
  const gUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size === 0) {
      const m = marquee.current; marquee.current = null;
      // a tap on an empty map spot (no drag) deselects everything
      if (m && e.pointerId === m.id && mq && mq.w < 0.5 && mq.h < 0.5) setSel(new Set());
      setMq(null);
    }
    if (touches.current.size < 2) gesture.current = null;
  };
  // open centred on the map
  useEffect(() => { const sc = scroller.current; if (sc) { sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2; } }, [px.length > 0]);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setCell((c) => Math.max(4, Math.min(60, c * Math.exp(-dy * 0.0015))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const areaDrag = useRef<{ mode: "move" | "size"; x: number; y: number; a: typeof area } | null>(null);
  const clampPos = (f: PatchedFixture, x: number, y: number, r = 0) => { const [w, h] = canvasSize({ ...f, pixelPos: { x: 0, y: 0, r } }); return { x: Math.max(0, Math.min(W - w, x)), y: Math.max(0, Math.min(H - h, y)), r }; };
  // effect painted over the whole canvas, like a video; lights pick up the spot they sit on
  const bg = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = bg.current; if (!c || !layer) return;
    const shown = layers.filter((l) => l.playing || l.id === layer.id);
    const { W: w, H: h, img } = renderCanvasComposite(shown, fixtures, now, (l) => (l.kind === "text" ? textMask(l.text.toUpperCase(), layerArea(l, stage).h) : null));
    c.width = w; c.height = h;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const data = ctx.createImageData(w, h);
    img.forEach((p, i) => { data.data[i * 4] = p[0]; data.data[i * 4 + 1] = p[1]; data.data[i * 4 + 2] = p[2]; data.data[i * 4 + 3] = 255; });
    ctx.putImageData(data, 0, 0);
  });

  const autoArrange = () => { let x = 0, y = 0, rowH = 0; for (const f of px) { const [w, h] = canvasSize({ ...f, pixelPos: { x: 0, y: 0 } }); if (x + w > W) { x = 0; y += rowH + 1; rowH = 0; } onMove(f.uid, clampPos(f, x, y, 0)); x += w + 1; rowH = Math.max(rowH, h); } };

  const pixels = (f: PatchedFixture, size: number, rot: number) => {
    const [lc, lr] = pixelGrid(f);
    const cols = preview.get(f.uid) ?? frame.get(f.uid);
    const [gw, gh] = rot === 90 ? [lr, lc] : [lc, lr];
    return (
      <div className="grid h-full w-full gap-px" style={{ gridTemplateColumns: `repeat(${gw}, 1fr)`, gridTemplateRows: `repeat(${gh}, 1fr)` }}>
        {Array.from({ length: pixelCount(f) }, (_, i) => {
          const [x, y] = pixelCell(f, i); const [cx, cy] = rot === 90 ? [y, x] : [x, y]; const c = cols?.[i];
          return <div key={i} className="rounded-[2px]" style={{ gridColumn: cx + 1, gridRow: cy + 1, minWidth: size > 6 ? 0 : undefined, background: c ? `rgb(${c[0]},${c[1]},${c[2]})` : "var(--muted)" }} />;
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5 text-xs">
          <span className="font-semibold">Pixel canvas</span>
          <span className="text-muted-foreground">All playing layers combine on one canvas · drag the dashed box to move the selected effect, its corner to resize it · two fingers on the effect: move, pinch, turn it · two fingers elsewhere: zoom and move the map (Ctrl + wheel on a mouse) · the map itself never turns, only the effect does · every effect plays on all lights on the map · ✕ on a light removes it</span>
          <div className="ml-auto flex gap-1">
            {addFixtures && <Button size="sm" onClick={() => setAddOpen(true)}><Plus />Add fixtures</Button>}
            <Button size="sm" variant="secondary" onClick={autoArrange}><LayoutGrid />Arrange</Button>
            <Button size="sm" variant={multi ? "default" : "secondary"} aria-pressed={multi} onClick={() => { setMulti((m) => !m); setSel(new Set()); }}>Multi select{multi && sel.size ? ` (${sel.size})` : ""}</Button>
            {multi && <Button size="sm" variant="secondary" onClick={() => setSel(sel.size === px.length ? new Set() : new Set(px.map((f) => f.uid)))}>{sel.size === px.length ? "Select none" : "Select all"}</Button>}
            <Button size="icon" variant="secondary" aria-label="Zoom out" onClick={() => setCell((c) => Math.max(4, c / 1.25))}><ZoomOut /></Button>
            <Button size="icon" variant="secondary" aria-label="Zoom in" onClick={() => setCell((c) => Math.min(60, c * 1.25))}><ZoomIn /></Button>
          </div>
        </div>
        {layer && onLayer && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs" aria-label="Effect motion">
            <span className="font-semibold">Motion</span>
            <span className="flex items-center gap-1"><span className="font-semibold">Rotate</span>
              <input type="number" step={5} min={-180} max={180} aria-label="Rotate degrees" value={Math.round(layer.angle ?? 0)} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAngle(((v + 540) % 360) - 180); }} className="w-14 rounded bg-surface-elevated px-1 py-0.5 tabular-nums" />°
              <input type="range" min={-180} max={180} value={Math.round(layer.angle ?? 0)} onChange={(e) => setAngle(Number(e.target.value))} className="w-28" />
              <Button size="sm" variant="secondary" onClick={() => setAngle((((layer.angle ?? 0) + 45 + 540) % 360) - 180)}>45°</Button>
              <Button size="sm" variant="secondary" onClick={() => setAngle((((layer.angle ?? 0) + 90 + 540) % 360) - 180)}>90°</Button>
            </span>
            <label className="flex items-center gap-1">Spin
              <input type="number" step={5} value={layer.spin ?? 0} onChange={(e) => onLayer({ spin: Number(e.target.value) || 0 })} className="w-16 rounded bg-surface-elevated px-1 py-0.5" />°/s
            </label>
            <Button size="sm" variant={recording ? "destructive" : "secondary"} onClick={toggleRec}>{recording ? "■ Stop REC" : "● REC move"}</Button>
            {layer.motion?.length ? <><span className="text-muted-foreground">Recorded {layer.motionLen?.toFixed(1)} s · loops</span><Button size="sm" variant="secondary" onClick={() => onLayer({ motion: [], motionLen: 0 })}>Clear move</Button></> : <span className="text-muted-foreground">{recording ? "Drag the box and rotate now…" : "Press REC, then drag/rotate the box"}</span>}
          </div>
        )}
        {onSelect && (
          <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface px-3 py-1.5 text-xs" aria-label="Effect layers">
            <span className="mr-1 font-semibold">Layers</span>
            {layers.map((l) => (
              <span key={l.id} className={`flex items-center overflow-hidden rounded-md ${l.id === layer?.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
                <button onClick={() => onPlay?.(l.id)} aria-label={`${l.playing ? "Stop" : "Play"} ${l.name}`} className="px-1.5 py-1">{l.playing ? "■" : "▶"}</button>
                {l.playing && onPause && <button onClick={() => onPause(l.id)} aria-label={`${l.pausedAt != null ? "Resume" : "Pause"} ${l.name}`} className="px-1 py-1">{l.pausedAt != null ? "⏵" : "❚❚"}</button>}
                <button onClick={() => onSelect(l.id)} className="py-1 pr-2 font-semibold">{l.name}{l.pausedAt != null && l.playing ? " (paused)" : ""}</button>
                {onRemoveLayer && layers.length > 1 && <button onClick={() => { if (confirm(`Delete effect “${l.name}”?`)) onRemoveLayer(l.id); }} aria-label={`Delete ${l.name}`} className="px-1.5 py-1 opacity-70 hover:opacity-100">✕</button>}
              </span>
            ))}
            {onAdd && <Button size="sm" variant="secondary" onClick={onAdd}>+ Layer</Button>}
          </div>
        )}
        <div ref={scroller} className="flex min-h-0 flex-1 touch-none overflow-auto p-3"
          onPointerDownCapture={gDown} onPointerMoveCapture={gMove} onPointerUpCapture={gUp} onPointerCancelCapture={gUp}>
          {px.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No lights on the pixel map yet. Press “Add fixtures” to add pixel lights.</p> : (
            <div ref={board} className="relative mx-auto my-auto shrink-0 rounded-md border border-border" style={{ width: W * cell, height: H * cell, backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize: `${cell}px ${cell}px` }}>
              <canvas ref={bg} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 opacity-40" style={{ width: stage.W * cell, height: stage.H * cell, imageRendering: "pixelated" }} />

              {layers.filter((l) => l.id !== layer?.id).map((l) => { const a = layerArea(l, stage); return (
                <button key={l.id} title={`Select ${l.name}`} onClick={() => onSelect?.(l.id)}
                  className="absolute z-[5] rounded-sm border border-dashed border-muted-foreground/70 text-left align-top" style={{ left: a.x * cell, top: a.y * cell, width: a.w * cell, height: a.h * cell, pointerEvents: "none" }}>
                  <span className="pointer-events-auto absolute left-0 top-0 rounded-br bg-secondary px-1 text-[10px] font-semibold">{l.name}{l.playing ? " ▶" : ""}</span>
                </button>
              ); })}
              {layer && onArea && (() => {
                const start = (mode: "move" | "size") => (e: React.PointerEvent) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); areaDrag.current = { mode, x: e.clientX, y: e.clientY, a: baseArea }; };
                const move = (e: React.PointerEvent) => { const d = areaDrag.current; if (!d) return; const [lx, ly] = toLocal(e.clientX - d.x, e.clientY - d.y); const dx = Math.round(lx), dy = Math.round(ly);
                  setArea(layerArea({ area: d.mode === "move" ? { ...d.a, x: d.a.x + dx, y: d.a.y + dy } : { ...d.a, w: Math.min(W - d.a.x, d.a.w + dx), h: Math.min(H - d.a.y, d.a.h + dy) } }, stage)); };
                const end = () => { areaDrag.current = null; };
                return (
                  <div aria-label="Effect area" className="pointer-events-none absolute z-10 rounded-sm border-2 border-dashed border-primary" style={{ left: area.x * cell, top: area.y * cell, width: area.w * cell, height: area.h * cell, transform: `rotate(${live?.angle ?? 0}deg)` }}>
                    <div title="Move effect area" onPointerDown={start("move")} onPointerMove={move} onPointerUp={end}
                      className="pointer-events-auto absolute -top-5 left-0 cursor-move touch-none rounded-t bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">Effect {area.w}×{area.h}</div>
                    <div className="pointer-events-auto absolute -top-5 right-0 flex gap-px">
                      {([["Full", 1], ["1/2", 2], ["1/4", 4]] as const).map(([l, d]) => (
                        <button key={l} onPointerDown={(e) => e.stopPropagation()} onClick={() => setArea(d === 1 ? { x: 0, y: 0, w: W, h: H } : layerArea({ area: { x: area.x, y: area.y, w: Math.round(W / d), h: Math.round(H / d) } }, stage))}
                          className={`rounded-t px-1.5 text-[10px] font-semibold ${area.w === Math.round(W / d) && area.h === Math.round(H / d) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{l}</button>
                      ))}
                    </div>
                    <div title="Resize effect area" aria-label="Resize effect area" onPointerDown={start("size")} onPointerMove={move} onPointerUp={end}
                      className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-sm border-2 border-background bg-primary" />
                  </div>
                );
              })()}
              {px.map((f) => {
                const p = pos.get(f.uid)!; const [w, h] = canvasSize({ ...f, pixelPos: p }); const inLayer = !multi || sel.has(f.uid);
                return (
                  <div key={f.uid} title={`${f.name} · ${getDef(f.defId).model}`}
                    className={`absolute cursor-grab touch-none rounded-sm p-px ${multi && sel.has(f.uid) ? "ring-4 ring-primary" : inLayer ? "ring-2 ring-primary" : "ring-1 ring-border opacity-70"}`}
                    style={{ left: p.x * cell, top: p.y * cell, width: w * cell, height: h * cell }}
                    onPointerDown={(e) => {
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      const group = multi && sel.has(f.uid) ? px.filter((g) => sel.has(g.uid)) : [f];
                      drag.current = { uid: f.uid, x: e.clientX, y: e.clientY, ox: p.x, oy: p.y, moved: false, group: group.map((g) => ({ f: g, p: pos.get(g.uid)! })) };
                    }}
                    onPointerMove={(e) => { const d = drag.current; if (!d || d.uid !== f.uid) return; const [lx, ly] = toLocal(e.clientX - d.x, e.clientY - d.y); const dx = Math.round(lx), dy = Math.round(ly); if (!dx && !dy && !d.moved) return; d.moved = true; for (const g of d.group) onMove(g.f.uid, clampPos(g.f, g.p.x + dx, g.p.y + dy, g.p.r)); }}
                    onPointerUp={() => { const d = drag.current; drag.current = null; if (multi && d && !d.moved) setSel((s) => { const n = new Set(s); if (n.has(f.uid)) n.delete(f.uid); else n.add(f.uid); return n; }); }}>
                    {pixels(f, cell, p.r)}
                    <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap text-[10px] font-semibold">{f.name}</span>
                    <button aria-label={`Rotate ${f.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onMove(f.uid, clampPos(f, p.x, p.y, p.r === 90 ? 0 : 90)); }}
                      className="absolute -right-2 -top-2 rounded-full bg-surface-elevated p-0.5 text-muted-foreground hover:text-foreground"><RotateCw className="h-3 w-3" /></button>
                    {onRemoveLight && <button aria-label={`Remove ${f.name} from the pixel map`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemoveLight(f.uid); }}
                      className="absolute -left-2 -top-2 rounded-full bg-surface-elevated px-1 text-[10px] leading-4 text-muted-foreground hover:text-destructive">✕</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <section aria-label="All pixel lights" className="shrink-0 border-t border-border bg-surface p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All lights ({px.length})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {px.map((f) => { const [c, r] = pixelGrid(f); const tall = r > c; return (
              <button key={f.uid} onClick={() => onToggle(f.uid)} className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1.5 ${layer?.order.includes(f.uid) ? "bg-primary/20 ring-1 ring-primary" : "bg-surface-elevated"}`}>
                <div style={{ width: tall ? 24 : Math.min(140, c * 8), height: tall ? Math.min(60, r * 8) : Math.max(8, r * 8) }}>{pixels(f, 8, 0)}</div>
                <span className="max-w-24 truncate text-[10px]">{f.name}</span>
              </button>); })}
          </div>
        </section>
      </div>
      <aside aria-label="Pixel effect controls" className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">{controls}</aside>
      {addFixtures && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>Add pixel fixtures</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Only pixel modes are shown.</p>
            {addFixtures}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
