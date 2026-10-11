// Live light plot: draw the set (or drop in a floor plan photo) per floor, place lights on stands,
// see their beams live in 2D or tilted 3D, and control them straight from the plot.
// View: wheel / pinch zoom, hand or middle-drag pan, right-drag (or shift+hand) rotates / tilts.
import { useEffect, useRef, useState } from "react";
import { Box, Eraser, Hand, ImagePlus, Layers, Maximize, Minus, MousePointer2, Pencil, Plus, Power, Square as SquareIcon, Trash2, X, DoorOpen, PanelsTopLeft, Undo2, Redo2 } from "lucide-react";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { fixtureWatts } from "@/lib/power";
import { OPTICS, OPTIC_BY_ID, defaultOptic, type Optic } from "@/lib/optics";
import { ColourControls } from "./ColourControls";
import { Button } from "@/components/ui/button";
import { wallSegments, openingBounds, wallPanels, rayBlocked, type Opening } from "@/lib/plot-geometry";
import { editHistory } from "@/lib/edit-history";
import { hexToHs } from "@/lib/gels";

const WALL_H = 2.6; // drawn lines and boxes are treated as walls this tall
const LREF = 8; // illuminance that reads as ~60% glow on the plot

export interface PlotItem { x: number; y: number; rot: number; h: number; beam: number; tilt?: number; floor?: number; optic?: Optic }
export interface PlotFloor { name: string; z: number; bg?: string }
export interface Plot {
  bg?: string; // ground floor plan / photo (data URL)
  bgOpacity?: number;
  strokes: { pts: [number, number][]; color: string; w: number; floor?: number }[];
  items: Record<string, PlotItem>;
  size: [number, number]; // stage size in metres
  floors?: PlotFloor[];
  openings?: Opening[];
}
export const emptyPlot = (): Plot => ({ strokes: [], items: {}, size: [20, 14] });

type Tool = "move" | "pan" | "draw" | "rect" | "erase" | "door" | "window";
type Mat = [number, number, number, number, number, number];
interface View { m: Mat; zs: number }
type Drag =
  | { kind: "item"; last: [number, number]; z: number }
  | { kind: "rot"; uid: string; sy: number; tilt0: number; alt: boolean }
  | { kind: "stroke"; start: [number, number] }
  | { kind: "box"; sx: number; sy: number; add: boolean }
  | { kind: "pan"; sx: number; sy: number; pan0: [number, number] }
  | { kind: "orbit"; sx: number; sy: number; yaw0: number; pitch0: number }
  | { kind: "pinch"; d0: number; z0: number; mid0: [number, number]; pan0: [number, number] };

const DEFAULT_TILT = 24;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function PlotPanel({ plot, setPlot: commitPlot, fixtures, selected, setSelected, colorOf, levelOf, update: commitFixture, onClose, onOpenControls }: {
  plot: Plot; setPlot: (p: Plot) => void; fixtures: PatchedFixture[]; selected: string[]; setSelected: (s: string[]) => void;
  colorOf: (f: PatchedFixture) => [number, number, number]; levelOf: (f: PatchedFixture) => number;
  update: (uid: string, p: Partial<PatchedFixture>) => void; onClose: () => void; onOpenControls: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [view3d, setView3d] = useState(false);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [tool, setTool] = useState<Tool>("move");
  const [ink, setInk] = useState("#e5e7eb");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const plotRef = useRef(plot);
  plotRef.current = plot;
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const [, force] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  type Snapshot = { plot: Plot; lights: PatchedFixture[] };
  const history = useRef(editHistory<Snapshot>());
  const gesture = useRef({ active: false, recorded: false });
  const snapshot = (): Snapshot => ({ plot: plotRef.current, lights: fixtures.map((f) => ({ ...f })) });
  const record = () => {
    if (gesture.current.active && gesture.current.recorded) return;
    history.current.push(snapshot());
    gesture.current.recorded = true;
    force((n) => n + 1);
  };
  const setPlot = (p: Plot) => { record(); plotRef.current = p; commitPlot(p); };
  const update = (uid: string, p: Partial<PatchedFixture>) => { record(); commitFixture(uid, p); };
  const restore = (s: Snapshot | undefined) => {
    if (!s) return;
    plotRef.current = s.plot; commitPlot(s.plot);
    for (const f of s.lights) commitFixture(f.uid, { intensity: f.intensity, on: f.on !== false, cct: f.cct, hue: f.hue, saturation: f.saturation, crossfade: f.crossfade, cctOnly: f.cctOnly, gm: f.gm, gel: f.gel ?? "" });
    force((n) => n + 1);
  };
  const undo = () => restore(history.current.undo(snapshot()));
  const redo = () => restore(history.current.redo(snapshot()));

  const floors: PlotFloor[] = plot.floors?.length ? plot.floors : [{ name: "Ground", z: 0 }];
  const fl = Math.min(active, floors.length - 1);
  const bgOf = (i: number) => (i === 0 ? plot.bg : floors[i]?.bg);
  const fz = (it: PlotItem) => floors[it.floor ?? 0]?.z ?? 0;
  const floorOf = (it: PlotItem) => Math.min(it.floor ?? 0, floors.length - 1);
  const opticsOf = (f: PatchedFixture, it: PlotItem) => {
    const model = getDef(f.defId).model;
    const optic = it.optic ?? defaultOptic(model);
    return { optic, beam: it.optic ? it.beam : OPTIC_BY_ID[optic].angle, watts: fixtureWatts(model) };
  };
  const segsOf = (floor: number) => wallSegments(plot.strokes, floor);

  useEffect(() => {
    for (let i = 0; i < floors.length; i++) {
      const src = bgOf(i);
      if (!src || imgs.current.has(src)) continue;
      const im = new Image();
      im.onload = () => { imgs.current.set(src, im); force((n) => n + 1); };
      im.src = src;
    }
  });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [SW, SH] = plot.size;
  const viewOf = (z = zoom, p = pan): View => {
    const s = Math.min(dims.w / (SW * (view3d ? 1.25 : 1.08)), dims.h / (SH * (view3d ? 1.1 : 1.08))) * z;
    const a = (yaw * Math.PI) / 180, pr = (pitch * Math.PI) / 180;
    const k = view3d ? Math.sin(pr) : 1;
    const ca = Math.cos(a), sa = Math.sin(a);
    const m: Mat = [s * ca, s * sa * k, -s * sa, s * ca * k, 0, 0];
    m[4] = dims.w / 2 - (m[0] * SW / 2 + m[2] * SH / 2) + p[0];
    m[5] = dims.h / 2 + (view3d ? 40 * z : 0) - (m[1] * SW / 2 + m[3] * SH / 2) + p[1];
    return { m, zs: view3d ? s * Math.cos(pr) : 0 };
  };
  const proj = ({ m, zs }: View, x: number, y: number, z = 0): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5] - z * zs];
  const unproj = ({ m, zs }: View, sx: number, sy: number, z = 0): [number, number] => {
    const det = m[0] * m[3] - m[1] * m[2];
    const dx = sx - m[4], dy = sy + z * zs - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det];
  };
  const visible = (it: PlotItem) => view3d || floorOf(it) === fl;
  const headOf = (V: View, it: PlotItem) => proj(V, it.x, it.y, fz(it) + it.h);
  const handleOf = (V: View, it: PlotItem): [number, number] => {
    const h = headOf(V, it), a = (it.rot * Math.PI) / 180;
    const d = proj(V, it.x + Math.cos(a), it.y + Math.sin(a), fz(it) + it.h);
    const len = Math.hypot(d[0] - h[0], d[1] - h[1]) || 1;
    return [h[0] + ((d[0] - h[0]) / len) * 36, h[1] + ((d[1] - h[1]) / len) * 36];
  };

  // zoom anchored at a screen point
  const zoomAt = (nz: number, sx: number, sy: number, z0 = zoom, p0 = pan) => {
    nz = clampN(nz, 0.2, 12);
    const fp = unproj(viewOf(z0, p0), sx, sy);
    const q = proj(viewOf(nz, p0), fp[0], fp[1]);
    setZoom(nz);
    setPan([p0[0] + sx - q[0], p0[1] + sy - q[1]]);
  };
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e) => {
    const r = canvas.current!.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  };
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); wheelRef.current(e); };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  // ---- draw every frame (parent re-renders on its clock) ----
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== dims.w * dpr || c.height !== dims.h * dpr) { c.width = dims.w * dpr; c.height = dims.h * dpr; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0d10";
    ctx.fillRect(0, 0, dims.w, dims.h);
    const V = viewOf();
    const { m, zs } = V;

    // floors (3D: all stacked, 2D: active only)
    const order = view3d ? floors.map((_, i) => i) : [fl];
    for (const i of order) {
      const z = floors[i]!.z;
      const isActive = i === fl;
      ctx.save();
      ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, (m[5] - z * zs) * dpr);
      ctx.globalAlpha = isActive ? 1 : 0.45;
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect(0, 0, SW, SH);
      const src = bgOf(i);
      const im = src ? imgs.current.get(src) : undefined;
      if (im) {
        ctx.globalAlpha = (plot.bgOpacity ?? 0.8) * (isActive ? 1 : 0.4);
        const ir = im.width / im.height, fr = SW / SH;
        const [w, h] = ir > fr ? [SW, SW / ir] : [SH * ir, SH];
        ctx.drawImage(im, (SW - w) / 2, (SH - h) / 2, w, h);
        ctx.globalAlpha = isActive ? 1 : 0.45;
      }
      ctx.strokeStyle = isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.02;
      for (let x = 0; x <= SW; x++) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SH); ctx.stroke(); }
      for (let y = 0; y <= SH; y++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SW, y); ctx.stroke(); }
      ctx.strokeStyle = isActive ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.05;
      ctx.strokeRect(0, 0, SW, SH);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const s of plot.strokes) {
        if ((s.floor ?? 0) !== i) continue;
        ctx.strokeStyle = s.color; ctx.lineWidth = s.w;
        ctx.beginPath();
        s.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
      if (view3d) {
        ctx.fillStyle = isActive ? "rgba(200,210,225,0.16)" : "rgba(200,210,225,0.07)";
        ctx.strokeStyle = isActive ? "rgba(220,225,235,0.45)" : "rgba(220,225,235,0.2)";
        ctx.lineWidth = 1;
        for (const s of plot.strokes) {
          if ((s.floor ?? 0) !== i) continue;
          for (let k = 1; k < s.pts.length; k++) {
            const [x1, y1] = s.pts[k - 1]!, [x2, y2] = s.pts[k]!;
            const stroke = plot.strokes.indexOf(s);
            const wall = { x: x1, y: y1, dx: x2 - x1, dy: y2 - y1, stroke, segment: k - 1 };
            for (const [a, b, lo, hi] of wallPanels(wall, plot.openings ?? [])) {
              const q = [proj(V, x1 + wall.dx * a, y1 + wall.dy * a, z + lo), proj(V, x1 + wall.dx * b, y1 + wall.dy * b, z + lo), proj(V, x1 + wall.dx * b, y1 + wall.dy * b, z + hi), proj(V, x1 + wall.dx * a, y1 + wall.dy * a, z + hi)];
              ctx.beginPath(); q.forEach((pt, j) => (j ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
          }
        }
      }
      if (view3d && floors.length > 1) {
        const [lx, ly] = proj(V, 0, 0, z);
        ctx.fillStyle = isActive ? "#22d3ee" : "#6b7280";
        ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(floors[i]!.name, lx + 4, ly - 4);
      }
    }

    for (const o of plot.openings ?? []) {
      const st = plot.strokes[o.stroke];
      if (!st || (!view3d && (st.floor ?? 0) !== fl)) continue;
      const wall = segsOf(st.floor ?? 0).find((w) => w.stroke === o.stroke && w.segment === o.segment);
      if (!wall) continue;
      const z = floors[st.floor ?? 0]?.z ?? 0;
      const [a, b] = openingBounds(o, wall);
      const points = view3d
        ? [[a, o.bottom], [b, o.bottom], [b, o.bottom + o.height], [a, o.bottom + o.height]]
        : [[a, 0], [b, 0]];
      ctx.strokeStyle = getComputedStyle(c).getPropertyValue(o.kind === "door" ? "--color-success" : "--color-primary");
      ctx.lineWidth = openingId === o.id ? 5 : 3;
      ctx.beginPath();
      points.forEach(([u, h], k) => { const q = proj(V, wall.x + wall.dx * (u ?? 0), wall.y + wall.dy * (u ?? 0), z + (h ?? 0)); if (k) ctx.lineTo(...q); else ctx.moveTo(...q); });
      if (view3d) ctx.closePath();
      ctx.stroke();
    }

    const placed = fixtures.filter((f) => plot.items[f.uid] && visible(plot.items[f.uid]!));
    const sorted = [...placed].sort((a, b) => headOf(V, plot.items[a.uid]!)[1] - headOf(V, plot.items[b.uid]!)[1]);

    // beams: light pool on the floor with inverse-square falloff, blocked by walls
    ctx.globalCompositeOperation = "lighter";
    for (const f of sorted) {
      const it = plot.items[f.uid]!;
      const lv = levelOf(f);
      if (lv <= 0.002) continue;
      const [r, g, b] = colorOf(f);
      const { watts, beam } = opticsOf(f, it);
      const tilt = clampN(it.tilt ?? DEFAULT_TILT, 0, 90);
      const h = Math.max(0.2, it.h);
      const half = beam / 2;
      const th = 90 - tilt; // centre ray, degrees from straight down
      const farDeg = Math.min(87, th + half), nearDeg = th - half;
      const rFar = Math.min(30, h * Math.tan((farDeg * Math.PI) / 180));
      const all = nearDeg <= 0;
      const rNear = all ? 0 : h * Math.tan((nearDeg * Math.PI) / 180);
      const hs = all ? 180 : Math.min(180, half / Math.max(0.35, Math.sin(((th || 1) * Math.PI) / 180)) );
      const a = (it.rot * Math.PI) / 180;
      const walls = segsOf(floorOf(it));
      const omega = Math.max(0.001, 2 * Math.PI * (1 - Math.cos((Math.min(half, 90) * Math.PI) / 180)));
      const z0 = fz(it);
      ctx.save();
      ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, (m[5] - z0 * zs) * dpr);
      const cell = 0.3;
      for (let x = Math.max(0, it.x - rFar); x < Math.min(SW, it.x + rFar); x += cell) {
        for (let y = Math.max(0, it.y - rFar); y < Math.min(SH, it.y + rFar); y += cell) {
          const cx = x + cell / 2, cy = y + cell / 2;
          const dx = cx - it.x, dy = cy - it.y, rr = Math.hypot(dx, dy);
          if (rr > rFar || rr < rNear) continue;
          const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a));
          if (Math.abs(diff) > hs * Math.PI / 180) continue;
          if (rayBlocked([it.x, it.y, h], [cx, cy, 0], walls, plot.openings ?? [])) continue;
          const lux = ((watts * lv) / omega) * h / Math.pow(rr * rr + h * h, 1.5);
          const alpha = 0.85 * (1 - Math.exp(-lux / LREF));
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.fillRect(x, y, Math.min(cell, SW - x), Math.min(cell, SH - y));
        }
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";

    for (const f of sorted) {
      const it = plot.items[f.uid]!;
      const isSel = selected.includes(f.uid);
      const z0 = fz(it);
      const base = proj(V, it.x, it.y, z0);
      const head = headOf(V, it);
      const [r, g, b] = colorOf(f);
      const lv = levelOf(f);
      ctx.strokeStyle = view3d ? "rgba(200,205,215,0.8)" : "rgba(200,205,215,0.6)";
      ctx.lineWidth = view3d ? 1.5 : 1;
      for (let k = 0; k < 3; k++) {
        const la = (k * 2 * Math.PI) / 3 + 0.5;
        const foot = proj(V, it.x + Math.cos(la) * 0.45, it.y + Math.sin(la) * 0.45, z0);
        const knee = proj(V, it.x, it.y, z0 + Math.min(0.7, it.h));
        ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(knee[0], knee[1]); ctx.stroke();
      }
      if (view3d) { ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(head[0], head[1]); ctx.stroke(); }
      const hd = handleOf(V, it);
      ctx.save();
      ctx.translate(head[0], head[1]);
      ctx.rotate(Math.atan2(hd[1] - head[1], hd[0] - head[0]));
      ctx.fillStyle = "#1f2937";
      ctx.strokeStyle = isSel ? "#22d3ee" : f.label ?? "#9ca3af";
      ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.fillRect(-9, -11, 18, 22); ctx.strokeRect(-9, -11, 18, 22);
      ctx.fillStyle = `rgb(${r * lv},${g * lv},${b * lv})`;
      ctx.shadowColor = `rgb(${r},${g},${b})`; ctx.shadowBlur = 14 * lv;
      ctx.fillRect(6, -9, 5, 18);
      ctx.restore();
      if (isSel) {
        // rotate handle (alt / 3D vertical drag = tilt)
        ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(head[0], head[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
        ctx.fillStyle = "#0b0d10";
        ctx.beginPath(); ctx.arc(hd[0], hd[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
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
  const pos = (e: { clientX: number; clientY: number }): [number, number] => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hit = (sx: number, sy: number) => {
    const V = viewOf();
    let best: string | null = null, bd = 22;
    for (const f of fixtures) {
      const it = plot.items[f.uid];
      if (!it || !visible(it)) continue;
      const [hx, hy] = headOf(V, it);
      const d = Math.hypot(hx - sx, hy - sy);
      if (d < bd) { bd = d; best = f.uid; }
    }
    return best;
  };
  const hitHandle = (sx: number, sy: number) => {
    const V = viewOf();
    for (const u of selected) {
      const it = plot.items[u];
      if (!it || !visible(it)) continue;
      const [hx, hy] = handleOf(V, it);
      if (Math.hypot(hx - sx, hy - sy) < 12) return u;
    }
    return null;
  };
  const clampFloor = ([x, y]: [number, number]): [number, number] => [clampN(x, 0, SW), clampN(y, 0, SH)];
  const floorZ = floors[fl]!.z;

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const [sx, sy] = pos(e);
    pointers.current.set(e.pointerId, [sx, sy]);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      drag.current = { kind: "pinch", d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: zoom, mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pan0: pan };
      setBox(null);
      return;
    }
    if (e.button === 2 || (tool === "pan" && e.shiftKey)) { drag.current = { kind: "orbit", sx, sy, yaw0: yaw, pitch0: pitch }; return; }
    if (e.button === 1 || tool === "pan") { drag.current = { kind: "pan", sx, sy, pan0: pan }; return; }
    const fp = clampFloor(unproj(viewOf(), sx, sy, floorZ));
    if (tool === "door" || tool === "window") {
      let nearest: { wall: ReturnType<typeof segsOf>[number]; u: number; distance: number } | undefined;
      for (const wall of segsOf(fl)) {
        const len2 = wall.dx * wall.dx + wall.dy * wall.dy;
        if (len2 < 0.001) continue;
        const u = clampN(((fp[0] - wall.x) * wall.dx + (fp[1] - wall.y) * wall.dy) / len2, 0, 1);
        const q = proj(viewOf(), wall.x + wall.dx * u, wall.y + wall.dy * u, floorZ);
        const distance = Math.hypot(q[0] - sx, q[1] - sy);
        if (distance < 24 && (!nearest || distance < nearest.distance)) nearest = { wall, u, distance };
      }
      if (nearest) {
        const { wall, u } = nearest;
        const len = Math.hypot(wall.dx, wall.dy);
        const width = Math.min(len, tool === "door" ? 0.9 : 1.2);
        const o: Opening = { id: crypto.randomUUID(), kind: tool, stroke: wall.stroke, segment: wall.segment, center: clampN(u, width / (2 * len), 1 - width / (2 * len)), width, bottom: tool === "door" ? 0 : 0.9, height: tool === "door" ? 2.1 : 1.2 };
        setPlot({ ...plot, openings: [...(plot.openings ?? []), o] });
        setOpeningId(o.id);
      }
      return;
    }
    if (tool === "move") {
      const h = hitHandle(sx, sy);
      if (h) { drag.current = { kind: "rot", uid: h, sy, tilt0: plot.items[h]!.tilt ?? DEFAULT_TILT, alt: e.altKey }; return; }
      const u = hit(sx, sy);
      if (u) {
        const add = e.shiftKey || e.metaKey || e.ctrlKey;
        if (add) setSelected(selected.includes(u) ? selected.filter((x) => x !== u) : [...selected, u]);
        else if (!selected.includes(u)) setSelected([u]);
        const it = plot.items[u]!;
        drag.current = { kind: "item", last: unproj(viewOf(), sx, sy, fz(it)), z: fz(it) };
      } else {
        drag.current = { kind: "box", sx, sy, add: e.shiftKey || e.metaKey || e.ctrlKey };
        setBox([sx, sy, sx, sy]);
      }
    } else if (tool === "draw" || tool === "rect") {
      drag.current = { kind: "stroke", start: fp };
      setPlot({ ...plot, strokes: [...plot.strokes, { pts: [fp, fp], color: ink, w: 0.08, ...(fl ? { floor: fl } : {}) }] });
    } else if (tool === "erase") {
      const keep = plot.strokes.filter((s) => (s.floor ?? 0) !== fl || !s.pts.some(([x, y]) => Math.hypot(x - fp[0], y - fp[1]) < 0.4));
      setPlot({ ...plot, strokes: keep, openings: remapOpenings(keep) });
    }
  };
  const move = (e: React.PointerEvent) => {
    const [sx, sy] = pos(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [sx, sy]);
    const d = drag.current;
    if (!d) return;
    const p = plotRef.current;
    if (d.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts as [[number, number], [number, number]];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const nz = clampN(d.z0 * (dist / d.d0), 0.2, 12);
      const fp = unproj(viewOf(d.z0, d.pan0), d.mid0[0], d.mid0[1]);
      const q = proj(viewOf(nz, d.pan0), fp[0], fp[1]);
      setZoom(nz); setPan([d.pan0[0] + mid[0] - q[0], d.pan0[1] + mid[1] - q[1]]);
    } else if (d.kind === "pan") {
      setPan([d.pan0[0] + sx - d.sx, d.pan0[1] + sy - d.sy]);
    } else if (d.kind === "orbit") {
      let ny = d.yaw0 + (sx - d.sx) * 0.4;
      ny = ((ny + 540) % 360) - 180;
      setYaw(Math.round(ny));
      if (view3d) setPitch(Math.round(clampN(d.pitch0 - (sy - d.sy) * 0.3, 15, 89)));
    } else if (d.kind === "box") {
      setBox([d.sx, d.sy, sx, sy]);
    } else if (d.kind === "rot") {
      const it = p.items[d.uid]!;
      const sel = selected.filter((u) => p.items[u]);
      if (d.alt || e.altKey) {
        const nt = Math.round(clampN(d.tilt0 + (sy - d.sy) * 0.4, 0, 90));
        setPlot({ ...p, items: Object.fromEntries(Object.entries(p.items).map(([k, v]) => [k, sel.includes(k) ? { ...v, tilt: nt } : v])) });
      } else {
        const fp = unproj(viewOf(), sx, sy, fz(it) + it.h);
        const ang = (Math.atan2(fp[1] - it.y, fp[0] - it.x) * 180) / Math.PI;
        const delta = ang - it.rot;
        const norm = (r: number) => Math.round(((r + 540) % 360) - 180);
        setPlot({ ...p, items: Object.fromEntries(Object.entries(p.items).map(([k, v]) => [k, sel.includes(k) ? { ...v, rot: norm(v.rot + delta) } : v])) });
      }
    } else if (d.kind === "item") {
      const fp = unproj(viewOf(), sx, sy, d.z);
      const dx = fp[0] - d.last[0], dy = fp[1] - d.last[1];
      d.last = fp;
      const sel = selected.filter((u) => p.items[u]);
      setPlot({ ...p, items: Object.fromEntries(Object.entries(p.items).map(([k, v]) => [k, sel.includes(k) ? { ...v, x: +clampN(v.x + dx, 0, SW).toFixed(2), y: +clampN(v.y + dy, 0, SH).toFixed(2) } : v])) });
    } else {
      const fp = clampFloor(unproj(viewOf(), sx, sy, floorZ));
      const strokes = [...p.strokes];
      const last = strokes[strokes.length - 1]!;
      const [x0, y0] = d.start;
      strokes[strokes.length - 1] = tool === "rect"
        ? { ...last, pts: [[x0, y0], [fp[0], y0], fp, [x0, fp[1]], [x0, y0]] }
        : { ...last, pts: [...last.pts, fp] };
      setPlot({ ...p, strokes });
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "box" && box) {
      const [x0, y0, x1, y1] = box;
      const V = viewOf();
      const inside = fixtures.filter((f) => {
        const it = plot.items[f.uid];
        if (!it || !visible(it)) return false;
        const [hx, hy] = headOf(V, it);
        return hx >= Math.min(x0, x1) && hx <= Math.max(x0, x1) && hy >= Math.min(y0, y1) && hy <= Math.max(y0, y1);
      }).map((f) => f.uid);
      const tiny = Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4;
      setSelected(tiny ? (d.add ? selected : []) : d.add ? [...new Set([...selected, ...inside])] : inside);
      setBox(null);
    }
    drag.current = pointers.current.size ? drag.current : null;
    if (d?.kind === "pinch") drag.current = null;
  };
  const dbl = (e: React.MouseEvent) => {
    if (tool !== "move") return;
    const [sx, sy] = pos(e);
    const u = hit(sx, sy);
    const f = fixtures.find((x) => x.uid === u);
    if (f) update(f.uid, { on: f.on === false, ...(f.on === false && f.intensity === 0 ? { intensity: 1 } : {}) });
  };

  const upload = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        const k = Math.min(1, 1600 / Math.max(i.width, i.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(i.width * k); cv.height = Math.round(i.height * k);
        cv.getContext("2d")!.drawImage(i, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL("image/jpeg", 0.75);
        const p = plotRef.current;
        if (fl === 0) {
          const ratio = i.width / i.height;
          setPlot({ ...p, bg: url, size: ratio >= 1 ? [20, +(20 / ratio).toFixed(1)] : [+(14 * ratio).toFixed(1), 14] });
        } else setPlot({ ...p, floors: floors.map((x, j) => (j === fl ? { ...x, bg: url } : x)) });
      };
      i.src = r.result as string;
    };
    r.readAsDataURL(file);
  };
  const removeImage = () => {
    if (fl === 0) { const { bg: _b, ...rest } = plot; setPlot(rest); }
    else setPlot({ ...plot, floors: floors.map((x, j) => (j === fl ? { name: x.name, z: x.z } : x)) });
  };

  const unplaced = fixtures.filter((f) => !plot.items[f.uid]);
  const newItem = (n: number): PlotItem => ({ x: 2 + (n % 8) * 2, y: SH - 2 - Math.floor(n / 8) * 2, rot: -90, h: 2.5, beam: 45, tilt: DEFAULT_TILT, ...(fl ? { floor: fl } : {}) });
  const place = (uid: string) => {
    setPlot({ ...plot, items: { ...plot.items, [uid]: newItem(Object.keys(plot.items).length) } });
    setSelected([uid]);
    setTool("move");
  };
  const placeAll = () => {
    const items = { ...plot.items };
    unplaced.forEach((f) => { items[f.uid] = newItem(Object.keys(items).length); });
    setPlot({ ...plot, items });
  };
  const selItems = selected.filter((u) => plot.items[u]);
  const first = fixtures.find((f) => f.uid === selItems[0]);
  const firstItem = first ? plot.items[first.uid] : undefined;
  const setItems = (p: Partial<PlotItem>) => setPlot({ ...plot, items: Object.fromEntries(Object.entries(plot.items).map(([k, v]) => [k, selItems.includes(k) ? { ...v, ...p } : v])) });
  const nudge = (d: number) => selItems.forEach((u) => { const f = fixtures.find((x) => x.uid === u); if (f) update(u, { intensity: clampN(+(f.intensity + d).toFixed(3), 0, 1), on: true }); });
  const allOn = selItems.every((u) => fixtures.find((x) => x.uid === u)?.on !== false);

  const addFloor = () => {
    const top = floors[floors.length - 1]!;
    const nf = [...floors, { name: `Floor ${floors.length}`, z: +(top.z + 3).toFixed(1) }];
    setPlot({ ...plot, floors: nf });
    setActive(nf.length - 1);
  };
  const setFloor = (p: Partial<PlotFloor>) => setPlot({ ...plot, floors: floors.map((x, j) => (j === fl ? { ...x, ...p } : x)) });
  const remapOpenings = (strokes: Plot["strokes"]) => (plot.openings ?? []).flatMap((o) => {
    const old = plot.strokes[o.stroke];
    const stroke = old ? strokes.indexOf(old) : -1;
    return stroke < 0 ? [] : [{ ...o, stroke }];
  });
  const deleteFloor = () => {
    if (fl === 0 || !confirm(`Delete "${floors[fl]!.name}"? Its lights go back to the list.`)) return;
    const items: Record<string, PlotItem> = {};
    for (const [k, v] of Object.entries(plot.items)) {
      const f0 = v.floor ?? 0;
      if (f0 === fl) continue;
      items[k] = f0 > fl ? { ...v, floor: f0 - 1 } : v;
    }
    const keptStrokes = plot.strokes.filter((s) => (s.floor ?? 0) !== fl);
    const openings = remapOpenings(keptStrokes);
    const strokes = keptStrokes.map((s) => ((s.floor ?? 0) > fl ? { ...s, floor: (s.floor ?? 0) - 1 } : s));
    setPlot({ ...plot, items, strokes, openings, floors: floors.filter((_, j) => j !== fl) });
    setActive(fl - 1);
  };

  // floating quick controls above the first selected light
  const V = viewOf();
  const quick = firstItem && visible(firstItem) ? headOf(V, firstItem) : null;

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <Button variant="secondary" title={label} onClick={() => setTool(t)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${tool === t ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`} aria-label={label}>{icon}<span className="hidden md:inline">{label}</span></Button>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" onPointerDownCapture={() => { gesture.current = { active: true, recorded: false }; }} onPointerUp={() => { gesture.current.active = false; }} onPointerCancel={() => { gesture.current.active = false; }}>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <h2 className="mr-2 font-display text-lg font-semibold">Live plot</h2>
        <div className="flex overflow-hidden rounded-lg">
          <button onClick={() => setView3d(false)} className={`px-3 py-2 text-xs font-bold ${!view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>2D</button>
          <button onClick={() => { setView3d(true); if (yaw === 0) setYaw(-30); }} className={`flex items-center gap-1 px-3 py-2 text-xs font-bold ${view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><Box className="h-3.5 w-3.5" />3D</button>
        </div>
        {toolBtn("move", <MousePointer2 className="h-4 w-4" />, "Select / move")}
        {toolBtn("pan", <Hand className="h-4 w-4" />, "Pan")}
        {toolBtn("draw", <Pencil className="h-4 w-4" />, "Draw")}
        {toolBtn("rect", <SquareIcon className="h-4 w-4" />, "Wall / box")}
        {toolBtn("door", <DoorOpen className="h-4 w-4" />, "Door")}
        {toolBtn("window", <PanelsTopLeft className="h-4 w-4" />, "Window")}
        <Button variant="secondary" size="icon" title="Undo" aria-label="Undo" disabled={!history.current.canUndo} onClick={undo}><Undo2 /></Button>
        <Button variant="secondary" size="icon" title="Redo" aria-label="Redo" disabled={!history.current.canRedo} onClick={redo}><Redo2 /></Button>
        {toolBtn("erase", <Eraser className="h-4 w-4" />, "Erase")}
        {(tool === "draw" || tool === "rect") && (
          <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Drawing colour" />
        )}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs font-semibold">
          <ImagePlus className="h-4 w-4" /><span className="hidden md:inline">Floor plan / photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
        {bgOf(fl) && <button onClick={removeImage} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Remove image</button>}
        {plot.strokes.some((s) => (s.floor ?? 0) === fl) && <button onClick={() => { if (confirm("Clear the drawing on this floor?"))  { const strokes = plot.strokes.filter((s) => (s.floor ?? 0) !== fl); setPlot({ ...plot, strokes, openings: remapOpenings(strokes) }); } }} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Clear drawing</button>}
        <div className="flex-1" />
        <button onClick={onClose} className="rounded-lg bg-surface-elevated p-2.5" aria-label="Close plot"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div ref={wrap} className="relative min-h-[300px] flex-1 touch-none overflow-hidden">
          <canvas ref={canvas} style={{ width: dims.w, height: dims.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            onDoubleClick={dbl} onContextMenu={(e) => e.preventDefault()}
            aria-label="Live plot canvas" className={tool === "pan" ? "cursor-move" : tool === "move" ? "cursor-default" : "cursor-crosshair"} />
          {box && (
            <div className="pointer-events-none absolute border border-primary bg-primary/10"
              style={{ left: Math.min(box[0], box[2]), top: Math.min(box[1], box[3]), width: Math.abs(box[2] - box[0]), height: Math.abs(box[3] - box[1]) }} />
          )}
          {quick && first && !box && (
            <div className="absolute flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-lg"
              style={{ left: clampN(quick[0], 90, dims.w - 90), top: clampN(quick[1] - 64, 4, dims.h - 40) }}
              onPointerDown={(e) => e.stopPropagation()}>
              <button onClick={() => selItems.forEach((u) => update(u, { on: !allOn }))} className={`rounded-md p-1.5 ${allOn ? "bg-success text-primary-foreground" : "bg-surface-elevated"}`} aria-label="On / off"><Power className="h-3.5 w-3.5" /></button>
              <button onClick={() => nudge(-0.1)} className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-bold">−10</button>
              <button onClick={() => nudge(-0.01)} className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-bold">−1</button>
              <span className="w-10 text-center font-mono text-xs">{Math.round(first.intensity * 100)}%</span>
              <button onClick={() => nudge(0.01)} className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-bold">+1</button>
              <button onClick={() => nudge(0.1)} className="rounded-md bg-surface-elevated px-2 py-1 text-xs font-bold">+10</button>
            </div>
          )}
          {/* floors */}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1 rounded-lg bg-surface/90 p-1">
            <Layers className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
            {floors.map((f, i) => (
              <button key={i} onClick={() => setActive(i)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${i === fl ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{f.name}</button>
            ))}
            <button onClick={addFloor} className="rounded-md bg-surface-elevated p-1.5" aria-label="Add floor"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {/* view */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-lg bg-surface/90 p-2 text-[10px] text-muted-foreground">
            <label className="flex items-center gap-2">Turn <input type="range" min={-180} max={180} value={yaw} onChange={(e) => setYaw(+e.target.value)} className="w-24" /></label>
            {view3d && <label className="flex items-center gap-2">Tilt <input type="range" min={15} max={89} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="w-20" /></label>}
            <div className="flex items-center gap-1">
              <button onClick={() => zoomAt(zoom / 1.25, dims.w / 2, dims.h / 2)} className="rounded-md bg-surface-elevated p-1.5" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomAt(zoom * 1.25, dims.w / 2, dims.h / 2)} className="rounded-md bg-surface-elevated p-1.5" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setZoom(1); setPan([0, 0]); setYaw(view3d ? -30 : 0); }} className="rounded-md bg-surface-elevated p-1.5" aria-label="Reset view"><Maximize className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="absolute right-3 top-3 rounded-md bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted-foreground">{SW} × {SH} m · grid 1 m</div>
        </div>

        <aside className="max-h-[45vh] lg:max-h-none w-full shrink-0 space-y-4 overflow-auto border-t border-border bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
          {first && firstItem ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selItems.length > 1 ? `${selItems.length} lights` : first.name}</p>
                <button onClick={() => selItems.forEach((u) => update(u, { on: !allOn }))} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${allOn ? "bg-success text-primary-foreground" : "bg-surface-elevated"}`}><Power className="h-3.5 w-3.5" />{allOn ? "ON" : "OFF"}</button>
              </div>
              <Slider label="Intensity" value={first.intensity * 100} min={0} max={100} unit="%" onChange={(v) => selItems.forEach((u) => update(u, { intensity: v / 100, on: true }))} />
              <Slider label="Direction (pan)" value={firstItem.rot} min={-180} max={180} unit="°" onChange={(v) => setItems({ rot: v })} />
              <Slider label="Tilt down" value={firstItem.tilt ?? DEFAULT_TILT} min={0} max={90} unit="°" onChange={(v) => setItems({ tilt: v })} />
              <Slider label="Height" value={firstItem.h} min={0.3} max={12} step={0.1} unit=" m" onChange={(v) => setItems({ h: v })} />
              {(() => {
                const o = opticsOf(first, firstItem);
                const spec = OPTIC_BY_ID[o.optic];
                return (
                  <>
                    <label className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">Optic</span>
                      <select value={o.optic} onChange={(e) => { const id = e.target.value as Optic; setItems({ optic: id, beam: OPTIC_BY_ID[id].angle }); }} className="min-w-0 flex-1 rounded-md bg-surface-elevated px-2 py-1 text-xs">
                        {OPTICS.map((x) => <option key={x.id} value={x.id}>{x.label} · {x.angle}°</option>)}
                      </select>
                    </label>
                    <Slider label="Beam angle" value={o.beam} min={spec.min} max={spec.max} unit="°" onChange={(v) => setItems({ optic: o.optic, beam: v })} />
                    <p className="text-[10px] text-muted-foreground">≈ {o.watts} W · light fades with distance; walls block it</p>
                  </>
                );
              })()}
              <div className="grid grid-cols-8 gap-1">{["#ffffff","#ff0000","#ff8000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff"].map((c) => <button key={c} aria-label={c} onClick={() => selItems.forEach((u) => update(u, c === "#ffffff" ? { crossfade: 0 } : { hue: hexToHs(c).h, saturation: hexToHs(c).s, crossfade: 1, cctOnly: false }))} className="h-6 rounded border border-input" style={{ background: c }} />)}</div>
              <ColourControls value={first} update={(p) => selItems.forEach((u) => update(u, p))} />
              {floors.length > 1 && (
                <label className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">Floor</span>
                  <select value={floorOf(firstItem)} onChange={(e) => { const n = +e.target.value; setItems({ floor: n }); setActive(n); }} className="rounded-md bg-surface-elevated px-2 py-1 text-xs">
                    {floors.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
                  </select>
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={onOpenControls} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground">Colour & effects…</button>
                <button onClick={() => { const items = { ...plot.items }; selItems.forEach((u) => delete items[u]); setPlot({ ...plot, items }); }} className="rounded-md bg-surface-elevated px-3 text-muted-foreground hover:text-destructive" aria-label="Remove from plot"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Tap a light to control it, drag to move. Drag on empty space to select several. Double-tap a light to switch it on/off. Drag the round handle to turn a light (hold Alt to tilt it). Scroll or pinch to zoom, right-drag to rotate the view.</p>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold">Doors / windows</p>
            {(plot.openings ?? []).filter((o) => (plot.strokes[o.stroke]?.floor ?? 0) === fl).map((o, i) => <div key={o.id} className="space-y-2">
              <div className="flex items-center gap-2"><Button variant={openingId === o.id ? "default" : "secondary"} size="sm" onClick={() => setOpeningId(o.id)}>{o.kind === "door" ? <DoorOpen /> : <PanelsTopLeft />}{o.kind} {i + 1}</Button><Button variant="ghost" size="icon" aria-label={`Remove ${o.kind} ${i + 1}`} onClick={() => setPlot({ ...plot, openings: plot.openings?.filter((x) => x.id !== o.id) ?? [] })}><Trash2 /></Button></div>
              {openingId === o.id && <>
                <Slider label="Opening width" value={o.width} min={0.2} max={Math.hypot((plot.strokes[o.stroke]?.pts[o.segment + 1]?.[0] ?? 0) - (plot.strokes[o.stroke]?.pts[o.segment]?.[0] ?? 0), (plot.strokes[o.stroke]?.pts[o.segment + 1]?.[1] ?? 0) - (plot.strokes[o.stroke]?.pts[o.segment]?.[1] ?? 0))} step={0.1} unit=" m" onChange={(width) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, width } : x) ?? [] })} />
                <Slider label="Opening position" value={o.center * 100} min={0} max={100} unit="%" onChange={(v) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, center: v / 100 } : x) ?? [] })} />
                <Slider label="Sill height" value={o.bottom} min={0} max={WALL_H - 0.1} step={0.1} unit=" m" onChange={(bottom) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, bottom, height: Math.min(x.height, WALL_H - bottom) } : x) ?? [] })} />
                <Slider label="Opening height" value={o.height} min={0.1} max={WALL_H - o.bottom} step={0.1} unit=" m" onChange={(height) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, height } : x) ?? [] })} />
              </>}
            </div>)}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Fixture on {floors[fl]!.name}</p>
            {unplaced.length === 0 && <p className="text-xs text-muted-foreground">{fixtures.length ? "All patched lights are on the plot." : "Patch lights first."}</p>}
            <div className="flex flex-wrap gap-1.5">
              {unplaced.map((f) => (
                <button key={f.uid} onClick={() => place(f.uid)} className="flex items-center gap-1 rounded-md bg-surface-elevated px-2.5 py-1.5 text-xs font-semibold hover:text-primary">
                  <Plus className="h-3 w-3" />{f.name}
                </button>
              ))}
            </div>
            {unplaced.length > 1 && <button onClick={placeAll} className="w-full rounded-md bg-surface-elevated py-2 text-xs font-semibold">Place all</button>}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Floor</p>
            <input value={floors[fl]!.name} onChange={(e) => setFloor({ name: e.target.value })} className="w-full rounded-md bg-surface-elevated px-2 py-1.5 text-xs" aria-label="Floor name" />
            {fl > 0 && <Slider label="Height above ground" value={floors[fl]!.z} min={0.5} max={60} step={0.1} unit=" m" onChange={(v) => setFloor({ z: v })} />}
            <div className="flex gap-2">
              <button onClick={addFloor} className="flex-1 rounded-md bg-surface-elevated py-1.5 text-xs font-semibold">+ Add floor</button>
              {fl > 0 && <button onClick={deleteFloor} className="rounded-md bg-surface-elevated px-3 text-xs text-muted-foreground hover:text-destructive">Delete</button>}
            </div>
          </div>

          {bgOf(fl) && <Slider label="Image visibility" value={(plot.bgOpacity ?? 0.8) * 100} min={5} max={100} unit="%" onChange={(v) => setPlot({ ...plot, bgOpacity: v / 100 })} />}
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
