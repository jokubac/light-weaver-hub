// Live light plot: draw the set (or drop in a floor plan photo), place lights on stands,
// see their beams live in 2D or tilted 3D, and control them straight from the plot.
import { useEffect, useRef, useState } from "react";
import { Box, Eraser, Hand, ImagePlus, Pencil, Plus, Power, Square as SquareIcon, Trash2, X } from "lucide-react";
import type { PatchedFixture } from "@/lib/dmx";

export interface PlotItem { x: number; y: number; rot: number; h: number; beam: number }
export interface Plot {
  bg?: string; // floor plan / photo (data URL)
  bgOpacity?: number;
  strokes: { pts: [number, number][]; color: string; w: number }[];
  items: Record<string, PlotItem>;
  size: [number, number]; // stage size in metres
}
export const emptyPlot = (): Plot => ({ strokes: [], items: {}, size: [20, 14] });

type Tool = "move" | "draw" | "rect" | "erase";
type Mat = [number, number, number, number, number, number]; // canvas affine a b c d e f

export function PlotPanel({ plot, setPlot, fixtures, selected, setSelected, colorOf, levelOf, update, onClose, onOpenControls }: {
  plot: Plot; setPlot: (p: Plot) => void; fixtures: PatchedFixture[]; selected: string[]; setSelected: (s: string[]) => void;
  colorOf: (f: PatchedFixture) => [number, number, number]; levelOf: (f: PatchedFixture) => number;
  update: (uid: string, p: Partial<PatchedFixture>) => void; onClose: () => void; onOpenControls: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [view3d, setView3d] = useState(false);
  const [yaw, setYaw] = useState(-30);
  const [pitch, setPitch] = useState(55);
  const [tool, setTool] = useState<Tool>("move");
  const [ink, setInk] = useState("#e5e7eb");
  const drag = useRef<{ kind: "item"; uid: string } | { kind: "stroke"; start: [number, number] } | null>(null);
  const plotRef = useRef(plot);
  plotRef.current = plot;
  const img = useRef<HTMLImageElement | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!plot.bg) { img.current = null; return; }
    const i = new Image();
    i.onload = () => { img.current = i; force((n) => n + 1); };
    i.src = plot.bg;
  }, [plot.bg]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [SW, SH] = plot.size;
  // floor (metres, z = 0) → screen affine; 3D = rotate by yaw, tilt by pitch (orthographic)
  const floor = (): Mat => {
    const s = Math.min(dims.w / (SW * (view3d ? 1.25 : 1.08)), dims.h / (SH * (view3d ? 1.1 : 1.08)));
    if (!view3d) return [s, 0, 0, s, dims.w / 2 - (SW / 2) * s, dims.h / 2 - (SH / 2) * s];
    const a = (yaw * Math.PI) / 180, k = Math.sin((pitch * Math.PI) / 180);
    const ca = Math.cos(a), sa = Math.sin(a);
    const m: Mat = [s * ca, s * sa * k, -s * sa, s * ca * k, 0, 0];
    m[4] = dims.w / 2 - (m[0] * SW / 2 + m[2] * SH / 2);
    m[5] = dims.h / 2 + 40 - (m[1] * SW / 2 + m[3] * SH / 2);
    return m;
  };
  const zScale = () => (view3d ? Math.min(dims.w / (SW * 1.25), dims.h / (SH * 1.1)) * Math.cos((pitch * Math.PI) / 180) : 0);
  const proj = (m: Mat, x: number, y: number, z = 0): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5] - z * zScale()];
  const unproj = (m: Mat, sx: number, sy: number): [number, number] => {
    const det = m[0] * m[3] - m[1] * m[2];
    const dx = sx - m[4], dy = sy - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det];
  };

  // ---- draw every frame (parent re-renders on its clock) ----
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== dims.w * dpr) { c.width = dims.w * dpr; c.height = dims.h * dpr; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(c);
    ctx.fillStyle = css.getPropertyValue("--background").trim() || "#0b0d10";
    ctx.fillRect(0, 0, dims.w, dims.h);
    const m = floor();

    // floor plane
    ctx.save();
    ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, 0, SW, SH);
    if (img.current) {
      ctx.globalAlpha = plot.bgOpacity ?? 0.8;
      const ir = img.current.width / img.current.height, fr = SW / SH;
      const [w, h] = ir > fr ? [SW, SW / ir] : [SH * ir, SH];
      ctx.drawImage(img.current, (SW - w) / 2, (SH - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.02;
    for (let x = 0; x <= SW; x++) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SH); ctx.stroke(); }
    for (let y = 0; y <= SH; y++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SW, y); ctx.stroke(); }
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const s of plot.strokes) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();

    // beams on the floor first, then stands + heads on top
    const placed = fixtures.filter((f) => plot.items[f.uid]);
    const sorted = [...placed].sort((a, b) => proj(m, plot.items[a.uid]!.x, plot.items[a.uid]!.y)[1] - proj(m, plot.items[b.uid]!.x, plot.items[b.uid]!.y)[1]);
    ctx.globalCompositeOperation = "lighter";
    for (const f of sorted) {
      const it = plot.items[f.uid]!;
      const lv = levelOf(f);
      if (lv <= 0.002) continue;
      const [r, g, b] = colorOf(f);
      const reach = Math.max(2, it.h * 2.2);
      const half = (it.beam * Math.PI) / 360;
      const a = (it.rot * Math.PI) / 180;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i++) {
        const ang = a - half + (2 * half * i) / 16;
        pts.push([it.x + Math.cos(ang) * reach, it.y + Math.sin(ang) * reach]);
      }
      const origin = proj(m, it.x, it.y, view3d ? it.h : 0);
      const tip = proj(m, it.x + Math.cos(a) * reach, it.y + Math.sin(a) * reach);
      const grad = ctx.createLinearGradient(origin[0], origin[1], tip[0], tip[1]);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.55 * lv})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      for (const p of pts) { const s = proj(m, p[0], p[1]); ctx.lineTo(s[0], s[1]); }
      ctx.closePath();
      ctx.fill();
      // floor pool
      const pool = proj(m, it.x + Math.cos(a) * reach * 0.6, it.y + Math.sin(a) * reach * 0.6);
      const rg = ctx.createRadialGradient(pool[0], pool[1], 0, pool[0], pool[1], reach * 0.5 * Math.abs(m[0] || 1));
      rg.addColorStop(0, `rgba(${r},${g},${b},${0.35 * lv})`);
      rg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(pool[0], pool[1], reach * 0.5 * Math.hypot(m[0], m[1]), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (const f of sorted) {
      const it = plot.items[f.uid]!;
      const isSel = selected.includes(f.uid);
      const base = proj(m, it.x, it.y);
      const head = proj(m, it.x, it.y, view3d ? it.h : 0);
      const [r, g, b] = colorOf(f);
      const lv = levelOf(f);
      if (view3d) {
        // stand: tripod legs + pole
        ctx.strokeStyle = "rgba(200,205,215,0.8)"; ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          const la = (k * 2 * Math.PI) / 3;
          const foot = proj(m, it.x + Math.cos(la) * 0.45, it.y + Math.sin(la) * 0.45);
          const knee = proj(m, it.x, it.y, 0.7);
          ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(knee[0], knee[1]); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(head[0], head[1]); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(200,205,215,0.6)"; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const la = (k * 2 * Math.PI) / 3 + 0.5;
          const foot = proj(m, it.x + Math.cos(la) * 0.45, it.y + Math.sin(la) * 0.45);
          ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(foot[0], foot[1]); ctx.stroke();
        }
      }
      // head: small box facing the beam direction
      ctx.save();
      ctx.translate(head[0], head[1]);
      const dir = proj(m, it.x + Math.cos((it.rot * Math.PI) / 180), it.y + Math.sin((it.rot * Math.PI) / 180), view3d ? it.h : 0);
      ctx.rotate(Math.atan2(dir[1] - head[1], dir[0] - head[0]));
      ctx.fillStyle = "#1f2937";
      ctx.strokeStyle = isSel ? "#22d3ee" : f.label ?? "#9ca3af";
      ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.fillRect(-9, -11, 18, 22); ctx.strokeRect(-9, -11, 18, 22);
      ctx.fillStyle = `rgb(${r * lv},${g * lv},${b * lv})`;
      ctx.shadowColor = `rgb(${r},${g},${b})`; ctx.shadowBlur = 14 * lv;
      ctx.fillRect(6, -9, 5, 18);
      ctx.restore();
      ctx.fillStyle = isSel ? "#22d3ee" : "#e5e7eb";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.name, head[0], head[1] - 16);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${Math.round((f.on === false ? 0 : f.intensity) * 100)}%`, head[0], head[1] + 24);
    }
  });

  // ---- pointer ----
  const pos = (e: React.PointerEvent): [number, number] => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hit = (sx: number, sy: number) => {
    const m = floor();
    let best: string | null = null, bd = 22;
    for (const f of fixtures) {
      const it = plot.items[f.uid];
      if (!it) continue;
      const [hx, hy] = proj(m, it.x, it.y, view3d ? it.h : 0);
      const d = Math.hypot(hx - sx, hy - sy);
      if (d < bd) { bd = d; best = f.uid; }
    }
    return best;
  };
  const clamp = ([x, y]: [number, number]): [number, number] => [Math.max(0, Math.min(SW, x)), Math.max(0, Math.min(SH, y))];
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const [sx, sy] = pos(e);
    const fp = clamp(unproj(floor(), sx, sy));
    if (tool === "move") {
      const u = hit(sx, sy);
      if (u) { drag.current = { kind: "item", uid: u }; setSelected(e.shiftKey || e.metaKey ? (selected.includes(u) ? selected.filter((x) => x !== u) : [...selected, u]) : [u]); }
      else setSelected([]);
    } else if (tool === "draw" || tool === "rect") {
      drag.current = { kind: "stroke", start: fp };
      setPlot({ ...plot, strokes: [...plot.strokes, { pts: [fp, fp], color: ink, w: 0.08 }] });
    } else if (tool === "erase") {
      const keep = plot.strokes.filter((s) => !s.pts.some(([x, y]) => Math.hypot(x - fp[0], y - fp[1]) < 0.4));
      setPlot({ ...plot, strokes: keep });
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const [sx, sy] = pos(e);
    const fp = clamp(unproj(floor(), sx, sy));
    const p = plotRef.current;
    if (d.kind === "item") {
      const it = p.items[d.uid]!;
      setPlot({ ...p, items: { ...p.items, [d.uid]: { ...it, x: +fp[0].toFixed(2), y: +fp[1].toFixed(2) } } });
    } else {
      const strokes = [...p.strokes];
      const last = strokes[strokes.length - 1]!;
      const [x0, y0] = d.start;
      strokes[strokes.length - 1] = tool === "rect"
        ? { ...last, pts: [[x0, y0], [fp[0], y0], fp, [x0, fp[1]], [x0, y0]] }
        : { ...last, pts: [...last.pts, fp] };
      setPlot({ ...p, strokes });
    }
  };
  const up = () => { drag.current = null; };

  const upload = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        // downscale so the plan fits in saved project data
        const k = Math.min(1, 1600 / Math.max(i.width, i.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(i.width * k); cv.height = Math.round(i.height * k);
        cv.getContext("2d")!.drawImage(i, 0, 0, cv.width, cv.height);
        const ratio = i.width / i.height;
        setPlot({ ...plotRef.current, bg: cv.toDataURL("image/jpeg", 0.75), size: ratio >= 1 ? [20, +(20 / ratio).toFixed(1)] : [+(14 * ratio).toFixed(1), 14] });
      };
      i.src = r.result as string;
    };
    r.readAsDataURL(file);
  };

  const unplaced = fixtures.filter((f) => !plot.items[f.uid]);
  const place = (uid: string) => {
    const n = Object.keys(plot.items).length;
    setPlot({ ...plot, items: { ...plot.items, [uid]: { x: 2 + (n % 8) * 2, y: SH - 2 - Math.floor(n / 8) * 2, rot: -90, h: 2.5, beam: 45 } } });
    setSelected([uid]);
    setTool("move");
  };
  const selItems = selected.filter((u) => plot.items[u]);
  const first = fixtures.find((f) => f.uid === selItems[0]);
  const firstItem = first ? plot.items[first.uid] : undefined;
  const setItems = (p: Partial<PlotItem>) => setPlot({ ...plot, items: Object.fromEntries(Object.entries(plot.items).map(([k, v]) => [k, selItems.includes(k) ? { ...v, ...p } : v])) });

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button onClick={() => setTool(t)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${tool === t ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`} aria-label={label}>{icon}<span className="hidden sm:inline">{label}</span></button>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <h2 className="mr-2 font-display text-lg font-semibold">Live plot</h2>
        <div className="flex overflow-hidden rounded-lg">
          <button onClick={() => setView3d(false)} className={`px-3 py-2 text-xs font-bold ${!view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>2D</button>
          <button onClick={() => setView3d(true)} className={`flex items-center gap-1 px-3 py-2 text-xs font-bold ${view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><Box className="h-3.5 w-3.5" />3D</button>
        </div>
        {toolBtn("move", <Hand className="h-4 w-4" />, "Select / move")}
        {toolBtn("draw", <Pencil className="h-4 w-4" />, "Draw")}
        {toolBtn("rect", <SquareIcon className="h-4 w-4" />, "Wall / box")}
        {toolBtn("erase", <Eraser className="h-4 w-4" />, "Erase")}
        {(tool === "draw" || tool === "rect") && (
          <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Drawing colour" />
        )}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs font-semibold">
          <ImagePlus className="h-4 w-4" /><span className="hidden sm:inline">Floor plan / photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
        {plot.bg && <button onClick={() => { const { bg: _b, ...rest } = plot; setPlot({ ...rest, size: [20, 14] }); }} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Remove image</button>}
        {plot.strokes.length > 0 && <button onClick={() => { if (confirm("Clear the whole drawing?")) setPlot({ ...plot, strokes: [] }); }} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Clear drawing</button>}
        <div className="flex-1" />
        <button onClick={onClose} className="rounded-lg bg-surface-elevated p-2.5" aria-label="Close plot"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={wrap} className="relative min-h-[300px] flex-1 touch-none">
          <canvas ref={canvas} style={{ width: dims.w, height: dims.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            className={tool === "move" ? "cursor-grab" : "cursor-crosshair"} />
          {view3d && (
            <div className="absolute bottom-3 left-3 flex gap-4 rounded-lg bg-surface/90 p-2.5 text-[10px] text-muted-foreground">
              <label className="flex items-center gap-2">Turn <input type="range" min={-180} max={180} value={yaw} onChange={(e) => setYaw(+e.target.value)} className="w-28" /></label>
              <label className="flex items-center gap-2">Tilt <input type="range" min={20} max={85} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="w-24" /></label>
            </div>
          )}
          <div className="absolute right-3 top-3 rounded-md bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted-foreground">{SW} × {SH} m · grid 1 m</div>
        </div>

        <aside className="w-full shrink-0 space-y-4 overflow-auto border-t border-border bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
          {first && firstItem ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selItems.length > 1 ? `${selItems.length} lights` : first.name}</p>
                <button onClick={() => { selItems.forEach((u) => update(u, { on: first.on === false })); }} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${first.on === false ? "bg-surface-elevated" : "bg-success text-primary-foreground"}`}><Power className="h-3.5 w-3.5" />{first.on === false ? "OFF" : "ON"}</button>
              </div>
              <Slider label="Intensity" value={first.intensity * 100} min={0} max={100} unit="%" onChange={(v) => selItems.forEach((u) => update(u, { intensity: v / 100, on: true }))} />
              <Slider label="Direction" value={firstItem.rot} min={-180} max={180} unit="°" onChange={(v) => setItems({ rot: v })} />
              <Slider label="Stand height" value={firstItem.h} min={0.3} max={8} step={0.1} unit=" m" onChange={(v) => setItems({ h: v })} />
              <Slider label="Beam angle" value={firstItem.beam} min={5} max={160} unit="°" onChange={(v) => setItems({ beam: v })} />
              <div className="flex gap-2">
                <button onClick={onOpenControls} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground">Colour & effects…</button>
                <button onClick={() => { const items = { ...plot.items }; selItems.forEach((u) => delete items[u]); setPlot({ ...plot, items }); }} className="rounded-md bg-surface-elevated px-3 text-muted-foreground hover:text-destructive" aria-label="Remove from plot"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Tap a light on the plot to control it. Drag to move it. Shift-click to pick several.</p>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Fixture on stand</p>
            {unplaced.length === 0 && <p className="text-xs text-muted-foreground">{fixtures.length ? "All patched lights are on the plot." : "Patch lights first."}</p>}
            <div className="flex flex-wrap gap-1.5">
              {unplaced.map((f) => (
                <button key={f.uid} onClick={() => place(f.uid)} className="flex items-center gap-1 rounded-md bg-surface-elevated px-2.5 py-1.5 text-xs font-semibold hover:text-primary">
                  <Plus className="h-3 w-3" />{f.name}
                </button>
              ))}
            </div>
            {unplaced.length > 1 && <button onClick={() => { let p = plot; unplaced.forEach((f, i) => { const n = Object.keys(p.items).length + 0 * i; p = { ...p, items: { ...p.items, [f.uid]: { x: 2 + (n % 8) * 2, y: SH - 2 - Math.floor(n / 8) * 2, rot: -90, h: 2.5, beam: 45 } } }; }); setPlot(p); }} className="w-full rounded-md bg-surface-elevated py-2 text-xs font-semibold">Place all</button>}
          </div>

          {plot.bg && <Slider label="Image visibility" value={(plot.bgOpacity ?? 0.8) * 100} min={5} max={100} unit="%" onChange={(v) => setPlot({ ...plot, bgOpacity: v / 100 })} />}
          <div className="grid grid-cols-2 gap-2">
            <Slider label="Stage width" value={SW} min={4} max={80} unit=" m" onChange={(v) => setPlot({ ...plot, size: [v, SH] })} />
            <Slider label="Stage depth" value={SH} min={4} max={80} unit=" m" onChange={(v) => setPlot({ ...plot, size: [SW, v] })} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-mono">{+value.toFixed(1)}{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}
