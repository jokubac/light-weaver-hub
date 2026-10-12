import { NumberField } from "./NumberField";
// Live light plot: draw the set (or drop in a floor plan photo) per floor, place lights on stands,
// see their beams live in 2D or tilted 3D, and control them straight from the plot.
// View: wheel / pinch zoom, hand or middle-drag pan, right-drag (or shift+hand) rotates / tilts.
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, ChevronDown, Hand, ImagePlus, Layers, Maximize, Minus, MousePointer2, Pencil, Plus, Power, Square as SquareIcon, Trash2, X, DoorOpen, PanelsTopLeft, Undo2, Redo2, Armchair, UserRound, LampDesk, LockKeyhole, Unlock, ListChecks } from "lucide-react";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { illuminanceAt, lux3m as lux3mOf, footcandles, shutterSeconds, tStopFor, roundToThirdStop, stopsDifference, type MeterLight } from "@/lib/photometry";
import { fixtureWatts } from "@/lib/power";
import { OPTICS, OPTIC_BY_ID, defaultOptic, type Optic } from "@/lib/optics";
import { ColourControls } from "./ColourControls";
import { Button } from "@/components/ui/button";
import { wallSegments, openingBounds, wallPanels, rayBlocked, segmentDistance, type Opening } from "@/lib/plot-geometry";
import { editHistory } from "@/lib/edit-history";
import { CameraView } from "./CameraView";
import { FSTOPS, ISOS, LENSES, SENSORS, FPS_OPTIONS, SHUTTER_ANGLES, defaultCamera, horizontalFov, type PlotCamera } from "@/lib/plot-camera";
import { Video, Gauge } from "lucide-react";
import { SET_OBJECTS, objectContains, type SetObject, type SetObjectKind } from "@/lib/plot-objects";
import { hexToHs } from "@/lib/gels";
import { SettingsTransfer } from "./SettingsTransfer";
import { plotEditSession } from "@/lib/plot-edit-session";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const WALL_H = 2.6; // drawn lines and boxes are treated as walls this tall
const LREF = 8; // illuminance that reads as ~60% glow on the plot

export interface PlotItem { x: number; y: number; rot: number; h: number; beam: number; tilt?: number; floor?: number; optic?: Optic }
export interface PlotFloor { name: string; z: number; bg?: string }
export interface Plot {
  bg?: string; // ground floor plan / photo (data URL)
  bgOpacity?: number;
  strokes: { pts: [number, number][]; color: string; w: number; floor?: number; height?: number }[];
  items: Record<string, PlotItem>;
  size: [number, number]; // stage size in metres
  floors?: PlotFloor[];
  openings?: Opening[];
  objects?: SetObject[];
  cameras?: PlotCamera[];
  meters?: { id: string; x: number; y: number; z: number; floor?: number }[];
  view?: { view3d: boolean; yaw: number; pitch: number; zoom: number; pan: [number, number]; active: number };
}
export const emptyPlot = (): Plot => ({ strokes: [], items: {}, size: [20, 14] });

type Tool = "move" | "pan" | "draw" | "rect" | "door" | "window" | "fixture" | "object" | "camera" | "meter";
type Mat = [number, number, number, number, number, number];
interface View { m: Mat; zs: number }
type Drag =
  | { kind: "camera"; id: string; last: [number, number]; z: number }
  | { kind: "meter"; id: string; last: [number, number]; z: number }
  | { kind: "item"; last: [number, number]; z: number }
  | { kind: "rot"; uid: string; sy: number; tilt0: number; alt: boolean }
  | { kind: "layout"; target: "wall" | "object"; id: number | string; segment?: number; last: [number, number] }
  | { kind: "stroke"; start: [number, number] }
  | { kind: "box"; sx: number; sy: number; add: boolean }
  | { kind: "pan"; sx: number; sy: number; pan0: [number, number] }
  | { kind: "orbit"; sx: number; sy: number; yaw0: number; pitch0: number }
  | { kind: "pinch"; d0: number; z0: number; mid0: [number, number]; pan0: [number, number]; a0: number; yaw0: number; objRot0?: number; itemRot0?: Record<string, number>; cameraRot0?: number }
  | { kind: "tilt3"; my0: number; pitch0: number };

const DEFAULT_TILT = 24;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Beam textures are reused until the fixture, its light or the wall geometry changes. */
const beamCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();
/** Theme colours are read once and refreshed only when the root theme class/style changes. */
let themeCache: { sig: string; values: Map<string, string> } | null = null;
function themeOf() {
  const root = document.documentElement;
  const sig = `${root.className}|${root.getAttribute("style") ?? ""}`;
  if (!themeCache || themeCache.sig !== sig) {
    const cs = getComputedStyle(root);
    const values = new Map<string, string>();
    for (const n of ["--color-success", "--color-primary", "--color-foreground", "--color-muted-foreground", "--color-surface-elevated"]) values.set(n, cs.getPropertyValue(n));
    themeCache = { sig, values };
  }
  const values = themeCache.values;
  return { getPropertyValue: (n: string) => values.get(n) ?? "" };
}

export function PlotPanel({ plot, setPlot: commitPlot, fixtures, selected, setSelected, colorOf, levelOf, update: commitFixture, onClose, onOpenControls, copiedSource, onCopy, onPaste }: {
  plot: Plot; setPlot: (p: Plot) => void; fixtures: PatchedFixture[]; selected: string[]; setSelected: (s: string[]) => void;
  colorOf: (f: PatchedFixture) => [number, number, number]; levelOf: (f: PatchedFixture) => number;
  update: (uid: string, p: Partial<PatchedFixture>) => void; onClose: () => void; onOpenControls: () => void;
  copiedSource?: string | undefined; onCopy: () => void; onPaste: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [view3d, setView3d] = useState(plot.view?.view3d ?? false);
  const [spaceGap, setSpaceGap] = useState(0);
  const [yaw, setYaw] = useState(plot.view?.yaw ?? 0);
  const [pitch, setPitch] = useState(plot.view?.pitch ?? 55);
  const [zoom, setZoom] = useState(plot.view?.zoom ?? 1);
  const [pan, setPan] = useState<[number, number]>(plot.view?.pan ?? [0, 0]);
  const [tool, setTool] = useState<Tool>("move");
  const [ink, setInk] = useState("#e5e7eb");
  const [active, setActive] = useState(plot.view?.active ?? 0);
  const [beamsOn, setBeamsOn] = useState(true);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, [number, number]>());
  const plotRef = useRef(plot);
  plotRef.current = plot;
  useEffect(() => {
    const next = { ...plotRef.current, view: { view3d, yaw, pitch, zoom, pan, active } };
    plotRef.current = next;
    commitPlot(next);
    // Camera changes are persisted without adding geometry undo steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view3d, yaw, pitch, zoom, pan, active]);
  const imgs = useRef(new Map<string, HTMLImageElement>());
  const [, force] = useState(0);
  const [layoutUnlocked, setLayoutUnlocked] = useState(false);
  useEffect(() => { setLayoutUnlocked(plotEditSession.isUnlocked()); }, []);
  const ensureUnlocked = () => {
    const allowed = plotEditSession.request(() => confirm("Unlock layout editing? You can move and edit everything for this app session."));
    if (allowed) setLayoutUnlocked(true);
    return allowed;
  };
  const dragStart = useRef<[number, number]>([0, 0]);
  const [wallIndex, setWallIndex] = useState<number | null>(null);
  const [objectId, focusObject] = useState<string | null>(null);
  const [cameraId, focusCamera] = useState<string | null>(null);
  const [objectIds, setObjectIds] = useState<string[]>([]);
  const [cameraIds, setCameraIds] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const setObjectId = (id: string | null) => { focusObject(id); setObjectIds(id ? [id] : []); };
  const setCameraId = (id: string | null) => { focusCamera(id); setCameraIds(id ? [id] : []); };
  const clearSelection = () => { setSelected([]); setObjectId(null); setCameraId(null); setWallIndex(null); setOpeningId(null); setMeterId(null); };
  const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  const [camViewOpen, setCamViewOpen] = useState(false);
  const [objectKind, setObjectKind] = useState<SetObjectKind>("bed");
  const [placementUid, setPlacementUid] = useState("");
  const [wallHeight, setWallHeight] = useState(2.6);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [meterId, setMeterId] = useState<string | null>(null);
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
  const setPlot = (p: Plot) => { if (!ensureUnlocked()) return; record(); plotRef.current = p; commitPlot(p); };
  const update = (uid: string, p: Partial<PatchedFixture>) => { record(); commitFixture(uid, p); };
  const restore = (s: Snapshot | undefined) => {
    if (!s) return;
    plotRef.current = s.plot; commitPlot(s.plot);
    for (const f of s.lights) commitFixture(f.uid, { intensity: f.intensity, on: f.on !== false, cct: f.cct, hue: f.hue, saturation: f.saturation, crossfade: f.crossfade, cctOnly: f.cctOnly, gm: f.gm, gel: f.gel ?? "", fan: f.fan ?? "auto", fx: structuredClone(f.fx), fxPlaying: f.fxPlaying !== false });
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

  /** Light sources for the meter, recomputed only when the plot or the fixtures that light it change. */
  const meterLights = useMemo<Record<number, MeterLight[]>>(() => {
    const byFloor: Record<number, MeterLight[]> = {};
    for (const f of fixtures) {
      const it = plot.items[f.uid];
      if (!it) continue;
      const floor = floorOf(it);
      const o = opticsOf(f, it);
      const model = getDef(f.defId).model;
      const l: MeterLight = { x: it.x, y: it.y, z: fz(it) + it.h, rot: it.rot, tilt: it.tilt ?? DEFAULT_TILT, beam: o.beam, lux3m: lux3mOf(model, o.watts, o.beam, (f as any).lux3m), level: levelOf(f) * (f.on === false ? 0 : 1) };
      (byFloor[floor] ??= []).push(l);
    }
    return byFloor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot.items, plot.objects, fixtures]);
  /** Meter points: user-placed plus one automatically at every person's head height. */
  const meterPoints = useMemo(() => {
    const manual = (plot.meters ?? []).map((m) => ({ ...m, floor: m.floor ?? 0, auto: false }));
    const people = (plot.objects ?? []).filter((o) => o.kind === "person").map((o) => ({ id: `person:${o.id}`, x: o.x, y: o.y, z: o.h - 0.15, floor: o.floor, auto: true }));
    return [...manual, ...people];
  }, [plot.meters, plot.objects]);
  const meterReading = (pt: { x: number; y: number; z: number; floor: number }) => {
    const z = (floors[pt.floor]?.z ?? 0) + pt.z;
    const lux = illuminanceAt([pt.x, pt.y, z], meterLights[pt.floor] ?? [], segsOf(pt.floor), plot.openings ?? []);
    return { lux, fc: footcandles(lux) };
  };

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
  const viewOf = (z = zoom, p = pan, yw = yaw): View => {
    const s = Math.min(dims.w / (SW * (view3d ? 1.25 : 1.08)), dims.h / (SH * (view3d ? 1.1 : 1.08))) * z;
    const a = (yw * Math.PI) / 180, pr = (pitch * Math.PI) / 180;
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
    const theme = themeOf();
    const geoKeys = new Map<number, string>();
    const geometryKey = (floor: number) => {
      let k = geoKeys.get(floor);
      if (k === undefined) { k = JSON.stringify([segsOf(floor), plot.openings ?? []]); geoKeys.set(floor, k); }
      return k;
    };
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
      const corners = [[0, 0], [dims.w, 0], [0, dims.h], [dims.w, dims.h]].map(([x, y]) => unproj(V, x ?? 0, y ?? 0, z));
      const left = Math.min(...corners.map((q) => q[0])), top = Math.min(...corners.map((q) => q[1]));
      ctx.fillRect(left, top, Math.max(...corners.map((q) => q[0])) - left, Math.max(...corners.map((q) => q[1])) - top);
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
      {
        // infinite grid: cover whatever part of the floor plane is on screen
        const cs = [[0, 0], [dims.w, 0], [0, dims.h], [dims.w, dims.h]].map(([a, b]) => unproj(V, a!, b!, z));
        const xs = cs.map((q) => q[0]), ys = cs.map((q) => q[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const span = Math.max(x1 - x0, y1 - y0);
        const step = span > 2000 ? 100 : span > 400 ? 10 : span > 150 ? 5 : 1;
        ctx.beginPath();
        for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = isActive ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.05;

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
            const wall = { x: x1, y: y1, dx: x2 - x1, dy: y2 - y1, stroke, segment: k - 1, height: s.height ?? WALL_H };
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
      ctx.strokeStyle = theme.getPropertyValue(o.kind === "door" ? "--color-success" : "--color-primary");
      ctx.lineWidth = openingId === o.id ? 5 : 3;
      ctx.beginPath();
      points.forEach(([u, h], k) => { const q = proj(V, wall.x + wall.dx * (u ?? 0), wall.y + wall.dy * (u ?? 0), z + (h ?? 0)); if (k) ctx.lineTo(...q); else ctx.moveTo(...q); });
      if (view3d) ctx.closePath();
      ctx.stroke();
    }

    // Measured walls and recognisable set objects share the scene coordinate system.
    for (const [index, st] of plot.strokes.entries()) {
      if (!view3d && (st.floor ?? 0) !== fl) continue;
      const z = floors[st.floor ?? 0]?.z ?? 0;
      for (let k = 1; k < st.pts.length; k++) {
        const a = st.pts[k - 1], b = st.pts[k];
        if (!a || !b) continue;
        const q = proj(V, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
        ctx.fillStyle = theme.getPropertyValue(index === wallIndex ? "--color-primary" : "--color-foreground");
        ctx.font = "11px system-ui"; ctx.textAlign = "center";
        ctx.fillText(`${Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(2)} m`, q[0], q[1] - 8);
      }
    }
    for (const o of plot.objects ?? []) {
      if (!view3d && o.floor !== fl) continue;
      const z = floors[o.floor]?.z ?? 0;
      const a = o.rot * Math.PI / 180;
      const point = (x: number, y: number, h = 0) => proj(V, o.x + x * Math.cos(a) - y * Math.sin(a), o.y + x * Math.sin(a) + y * Math.cos(a), z + h);
      ctx.strokeStyle = theme.getPropertyValue(objectIds.includes(o.id) ? "--color-primary" : "--color-muted-foreground");
      ctx.fillStyle = theme.getPropertyValue("--color-surface-elevated"); ctx.lineWidth = 2;
      const face = (pts: [number, number][]) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      if (o.kind === "tree") {
        const c = point(0, 0, view3d ? o.h * 0.7 : 0);
        if (view3d) { ctx.beginPath(); ctx.moveTo(...point(0, 0)); ctx.lineTo(...c); ctx.stroke(); }
        const edge = point(o.w / 2, 0, view3d ? o.h * 0.7 : 0);
        ctx.save(); ctx.fillStyle = "rgba(60,140,70,0.55)";
        ctx.beginPath(); ctx.arc(...c, Math.hypot(edge[0] - c[0], edge[1] - c[1]), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      } else if (o.kind === "car") {
        const body = view3d ? o.h * 0.55 : 0;
        const corners: [number, number][] = [[-o.w / 2, -o.d / 2], [o.w / 2, -o.d / 2], [o.w / 2, o.d / 2], [-o.w / 2, o.d / 2]];
        if (view3d) for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i+1)%4]; if (a && b) face([point(...a), point(...b), point(...b,body), point(...a,body)]); }
        face(corners.map(([x,y]) => point(x,y,body)));
        // cabin with glass windows (light passes through)
        const cab: [number, number][] = [[-o.w * .42, -o.d * .25], [o.w * .42, -o.d * .25], [o.w * .42, o.d * .2], [-o.w * .42, o.d * .2]];
        ctx.save(); ctx.fillStyle = "rgba(140,190,230,0.35)";
        if (view3d) for (let i = 0; i < 4; i++) { const a = cab[i], b = cab[(i+1)%4]; if (a && b) face([point(...a, body), point(...b, body), point(...b, o.h), point(...a, o.h)]); }
        face(cab.map(([x,y]) => point(x,y,view3d ? o.h : 0))); ctx.restore();
      } else if (o.kind === "person") {
        const head = point(0, 0, view3d ? o.h - 0.15 : 0);
        const base = point(0, 0);
        ctx.beginPath(); ctx.arc(...head, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(head[0], head[1] + 8); ctx.lineTo(...base); ctx.stroke();
        const shoulders = [point(-o.w / 2, 0, view3d ? o.h * 0.7 : 0), point(o.w / 2, 0, view3d ? o.h * 0.7 : 0)];
        ctx.beginPath(); ctx.moveTo(...(shoulders[0] ?? base)); ctx.lineTo(...(shoulders[1] ?? base)); ctx.stroke();
      } else {
        const corners: [number, number][] = [[-o.w / 2, -o.d / 2], [o.w / 2, -o.d / 2], [o.w / 2, o.d / 2], [-o.w / 2, o.d / 2]];
        face(corners.map(([x,y]) => point(x,y,view3d ? o.h : 0)));
        if (view3d) for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i+1)%4]; if (a && b) face([point(...a), point(...b), point(...b,o.h), point(...a,o.h)]); }
        if (o.kind === "bed" || o.kind === "sofa") face([point(-o.w * .4,-o.d * .4,view3d ? o.h + .1 : 0),point(o.w * .4,-o.d * .4,view3d ? o.h + .1 : 0),point(o.w * .4,-o.d * .15,view3d ? o.h + .1 : 0),point(-o.w * .4,-o.d * .15,view3d ? o.h + .1 : 0)]);
      }
      const q = point(0,0,view3d ? o.h : 0); ctx.fillStyle = theme.getPropertyValue("--color-foreground"); ctx.font = "11px system-ui"; ctx.textAlign = "center"; ctx.fillText(o.name,q[0],q[1]-14);
    }

    for (const cam of plot.cameras ?? []) {
      if (!view3d && cam.floor !== fl) continue;
      const z = floors[cam.floor]?.z ?? 0;
      const half = horizontalFov(cam) * Math.PI / 360, a = cam.rot * Math.PI / 180, reach = Math.max(SW, SH) * 0.35;
      const o = proj(V, cam.x, cam.y, z + cam.h);
      const l = proj(V, cam.x + Math.cos(a - half) * reach, cam.y + Math.sin(a - half) * reach, z + cam.h);
      const r = proj(V, cam.x + Math.cos(a + half) * reach, cam.y + Math.sin(a + half) * reach, z + cam.h);
      ctx.save();
      ctx.fillStyle = cameraIds.includes(cam.id) ? "rgba(255,90,90,0.16)" : "rgba(255,90,90,0.08)"; ctx.strokeStyle = "rgba(255,90,90,0.8)"; ctx.lineWidth = cameraIds.includes(cam.id) ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(...l); ctx.lineTo(...r); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgb(255,90,90)"; ctx.fillRect(o[0] - 7, o[1] - 5, 14, 10);
      ctx.font = "11px system-ui"; ctx.textAlign = "center"; ctx.fillText(`${cam.name} · ${cam.lens}mm`, o[0], o[1] - 10);
      ctx.restore();
    }

    // light meters: a dot at each manual point plus one automatically at every person's head,
    // with a "xxx lx · T y" badge — only drawn once there is something on the floor to measure.
    for (const pt of meterPoints) {
      const mf = pt.floor;
      if (!view3d && mf !== fl) continue;
      const lights = meterLights[mf];
      if (!lights || !lights.length) continue;
      const z = floors[mf]?.z ?? 0;
      const q = proj(V, pt.x, pt.y, z + pt.z);
      const isSel = !pt.auto && pt.id === meterId;
      if (!pt.auto) {
        ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? "rgba(250,204,21,0.9)" : "rgba(250,204,21,0.55)";
        ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1; ctx.stroke();
      }
      const { lux } = meterReading(pt);
      const cams = plot.cameras ?? [];
      const cam = cams.find((c) => c.id === cameraId) ?? cams[0];
      const tLabel = cam ? ` · ${roundToThirdStop(tStopFor(lux, cam.iso, shutterSeconds(cam.fps, cam.shutterAngle))).label}` : "";
      const label = `${Math.round(lux)} lx${tLabel}`;
      const ty = q[1] - (pt.auto ? 28 : 14);
      ctx.font = "600 10px system-ui, sans-serif"; ctx.textAlign = "center";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(11,13,16,0.75)";
      ctx.fillRect(q[0] - tw / 2 - 4, ty - 11, tw + 8, 14);
      ctx.fillStyle = isSel ? "#facc15" : "#e5e7eb";
      ctx.fillText(label, q[0], ty);
    }

    const placed = fixtures.filter((f) => plot.items[f.uid] && visible(plot.items[f.uid]!));
    const sorted = [...placed].sort((a, b) => headOf(V, plot.items[a.uid]!)[1] - headOf(V, plot.items[b.uid]!)[1]);

    // beams: light pool on the floor with inverse-square falloff, blocked by walls
    ctx.globalCompositeOperation = "lighter";
    for (const f of beamsOn ? sorted : []) {
      const it = plot.items[f.uid]!;
      const lv = levelOf(f);
      if (lv <= 0.002) continue;
      const [r, g, b] = colorOf(f);
      const { watts, beam } = opticsOf(f, it);
      const tilt = clampN(it.tilt ?? DEFAULT_TILT, 0, 90);
      const h = Math.max(0.2, it.h);
      const half = beam / 2;
      const th = 90 - tilt; // centre ray, degrees from straight down
      const farDeg = Math.min(87, th + half);
      const rFar = Math.min(30, h * Math.tan((farDeg * Math.PI) / 180));
      const a = (it.rot * Math.PI) / 180;
      const walls = segsOf(floorOf(it));
      const omega = Math.max(0.001, 2 * Math.PI * (1 - Math.cos((Math.min(half, 90) * Math.PI) / 180)));
      const z0 = fz(it);
      const extent = Math.max(1, rFar * 2);
      const cell = Math.max(.04, extent / 256);
      const bx = it.x - extent / 2, by = it.y - extent / 2;
      const key = `${it.x},${it.y},${h},${it.rot},${tilt},${watts},${beam},${lv.toFixed(4)},${r},${g},${b},${extent}|${geometryKey(floorOf(it))}`;
      let entry = beamCache.get(f.uid);
      if (!entry || entry.key !== key) {
        const texture = entry?.canvas ?? document.createElement("canvas");
        const tw = Math.ceil(extent / cell), th2 = tw;
        if (texture.width !== tw || texture.height !== th2) { texture.width = tw; texture.height = th2; }
        const tc = texture.getContext("2d");
        if (!tc) continue;
        const image = tc.createImageData(tw, th2);
        const tiltRad = tilt * Math.PI / 180;
        const axis = [Math.cos(a) * Math.cos(tiltRad), Math.sin(a) * Math.cos(tiltRad), -Math.sin(tiltRad)];
        const halfRad = Math.min(90, half) * Math.PI / 180;
        const openings = plot.openings ?? [];
        for (let ix = 0; ix < tw; ix++) {
          for (let iy = 0; iy < th2; iy++) {
            const cx = bx + (ix + .5) * cell, cy = by + (iy + .5) * cell;
            const dx = cx - it.x, dy = cy - it.y, rr = Math.hypot(dx,dy), distance = Math.hypot(rr,h);
            const angle = Math.acos(clampN((dx * (axis[0] ?? 0) + dy * (axis[1] ?? 0) - h * (axis[2] ?? 0)) / distance,-1,1));
            if (angle > halfRad || rayBlocked([it.x,it.y,h],[cx,cy,0],walls,openings)) continue;
            const edge = Math.pow(Math.max(0,1 - Math.pow(angle / Math.max(.001,halfRad),2)),2);
            const lux = ((watts * lv) / omega) * h / Math.pow(distance,3) * edge;
            const offset = (iy * tw + ix) * 4;
            image.data[offset] = r; image.data[offset+1] = g; image.data[offset+2] = b;
            image.data[offset+3] = Math.round(255 * .85 * (1 - Math.exp(-lux / LREF)));
          }
        }
        tc.putImageData(image,0,0);
        entry = { key, canvas: texture };
        beamCache.set(f.uid, entry);
      }
      ctx.save();
      ctx.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, (m[5] - z0 * zs) * dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(entry.canvas,bx,by,extent,extent);
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
  const hitCamera = (sx: number, sy: number) => {
    const V = viewOf();
    return [...(plot.cameras ?? [])].reverse().find((cam) => {
      if (!view3d && cam.floor !== fl) return false;
      const q = proj(V, cam.x, cam.y, (floors[cam.floor]?.z ?? 0) + cam.h);
      return Math.hypot(q[0] - sx, q[1] - sy) < 22;
    });
  };
  const selectCamera = (cam: PlotCamera) => {
    setCameraId(cam.id); setSelected([]); setObjectId(null); setWallIndex(null); setOpeningId(null); setActive(cam.floor);
  };
  const removeCamera = (id: string) => {
    if (!ensureUnlocked()) return;
    const cam = plot.cameras?.find((c) => c.id === id);
    if (!cam || !confirm(`Remove ${cam.name}?`)) return;
    setPlot({ ...plot, cameras: (plot.cameras ?? []).filter((c) => c.id !== id) });
    setCameraId(null); setCamViewOpen(false);
  };
  const hitMeter = (sx: number, sy: number) => {
    const V = viewOf();
    return [...(plot.meters ?? [])].reverse().find((m) => {
      const mf = m.floor ?? 0;
      if (!view3d && mf !== fl) return false;
      const q = proj(V, m.x, m.y, (floors[mf]?.z ?? 0) + m.z);
      return Math.hypot(q[0] - sx, q[1] - sy) < 16;
    });
  };
  const removeMeter = (id: string) => {
    if (!ensureUnlocked()) return;
    if (!confirm("Remove this light meter?")) return;
    setPlot({ ...plot, meters: (plot.meters ?? []).filter((m) => m.id !== id) });
    setMeterId(null);
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
  const clampFloor = ([x, y]: [number, number]): [number, number] => [x, y];
  const floorZ = floors[fl]!.z;

  const wallHit = (sx: number, sy: number) => {
    let best: { index: number; segment: number; t: number; distance: number } | undefined;
    plot.strokes.forEach((st,index) => {
      if ((st.floor ?? 0) !== fl) return;
      for (let k = 1; k < st.pts.length; k++) {
        const a = st.pts[k-1], b = st.pts[k]; if (!a || !b) continue;
        const hit = segmentDistance([sx,sy],proj(viewOf(),...a,floorZ),proj(viewOf(),...b,floorZ));
        if (hit.distance < 18 && (!best || hit.distance < best.distance)) best = { index, segment: k-1, ...hit };
      }
    });
    return best;
  };
  const removeWall = (index: number) => {
    if (!ensureUnlocked()) return;
    if (!confirm("Delete this wall and its doors/windows?")) return;
    const strokes = plot.strokes.filter((_,i) => i !== index);
    setPlot({ ...plot, strokes, openings: remapOpenings(strokes) }); setWallIndex(null);
  };
  const removeObject = (id: string) => { if (!ensureUnlocked()) return; if (confirm("Remove this object from the plot?")) { setPlot({ ...plot, objects: (plot.objects ?? []).filter((o) => o.id !== id) }); setObjectId(null); } };
  const addObjectAt = (x: number,y: number) => {
    const spec = SET_OBJECTS.find((o) => o.kind === objectKind); if (!spec) return;
    const o: SetObject = { ...spec, id: crypto.randomUUID(), name: spec.label, x,y,rot:0,floor:fl };
    clearSelection(); setPlot({ ...plot, objects:[...(plot.objects ?? []),o] }); setObjectId(o.id); setWallIndex(null); setOpeningId(null); setSelected([]); setTool("move");
  };
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const [sx, sy] = pos(e);
    dragStart.current = [sx, sy];
    pointers.current.set(e.pointerId, [sx, sy]);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [[number, number], [number, number]];
      const obj = layoutUnlocked && objectId ? plot.objects?.find((o) => o.id === objectId) : undefined;
      const cam = layoutUnlocked && cameraId ? plot.cameras?.find((c) => c.id === cameraId) : undefined;
      const selIt = layoutUnlocked && !obj && !cam ? selected.filter((u) => plot.items[u]) : [];
      drag.current = { kind: "pinch", d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: zoom, mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pan0: pan,
        a0: Math.atan2(b[1] - a[1], b[0] - a[0]), yaw0: yaw,
        ...(cam ? { cameraRot0: cam.rot } : {}), ...(obj ? { objRot0: obj.rot } : {}), ...(selIt.length ? { itemRot0: Object.fromEntries(selIt.map((u) => [u, plot.items[u]!.rot])) } : {}) };
      setBox(null);
      return;
    }
    if (pointers.current.size === 3) {
      const pts = [...pointers.current.values()];
      drag.current = { kind: "tilt3", my0: pts.reduce((s, q) => s + q[1], 0) / 3, pitch0: pitch };
      if (!view3d) { setView3d(true); }
      return;
    }
    if (pointers.current.size > 3) return;
    if (e.button === 2 || (tool === "pan" && e.shiftKey)) { drag.current = { kind: "orbit", sx, sy, yaw0: yaw, pitch0: pitch }; return; }
    if (e.button === 1 || tool === "pan") { drag.current = { kind: "pan", sx, sy, pan0: pan }; return; }
    const fp = clampFloor(unproj(viewOf(), sx, sy, floorZ));
    if (tool === "fixture") {
      if (placementUid && !plot.items[placementUid]) { setPlot({ ...plot, items:{ ...plot.items,[placementUid]:{ ...newItem(0),x:fp[0],y:fp[1] } } }); setSelected([placementUid]); setTool("move"); }
      return;
    }
    if (tool === "camera") {
      const c = { ...defaultCamera(fp[0], fp[1], fl), name: `Camera ${(plot.cameras?.length ?? 0) + 1}`, rot: -90 };
      setPlot({ ...plot, cameras: [...(plot.cameras ?? []), c] }); selectCamera(c); setTool("move");
      return;
    }
    if (tool === "object") { setCameraId(null); addObjectAt(...fp); return; }
    if (tool === "meter") {
      const m = { id: crypto.randomUUID(), x: fp[0], y: fp[1], z: 1.6, floor: fl };
      clearSelection(); setPlot({ ...plot, meters: [...(plot.meters ?? []), m] }); setMeterId(m.id); setTool("move");
      return;
    }
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
      const add = multiSelect || e.shiftKey || e.metaKey || e.ctrlKey;
      const cam = hitCamera(sx, sy);
      if (cam) {
        const already = cameraIds.includes(cam.id);
        if (add) { const ids = toggleId(cameraIds, cam.id); setCameraIds(ids); focusCamera(ids.includes(cam.id) ? cam.id : ids[0] ?? null); }
        else if (!already) { clearSelection(); setCameraId(cam.id); }
        setWallIndex(null); setOpeningId(null);
        const z = (floors[cam.floor]?.z ?? 0) + cam.h;
        if (!add) drag.current = { kind: "item", last: unproj(viewOf(), sx, sy, z), z };
        return;
      }
      const met = hitMeter(sx, sy);
      if (met) {
        clearSelection(); setMeterId(met.id);
        setWallIndex(null); setOpeningId(null);
        const z = (floors[met.floor ?? 0]?.z ?? 0) + met.z;
        drag.current = { kind: "meter", id: met.id, last: unproj(viewOf(), sx, sy, z), z };
        return;
      }
      const h = !add ? hitHandle(sx, sy) : null;
      const handleItem = h ? plot.items[h] : undefined;
      if (h && handleItem) { drag.current = { kind: "rot", uid: h, sy, tilt0: handleItem.tilt ?? DEFAULT_TILT, alt: e.altKey }; return; }
      const u = hit(sx, sy);
      if (u) {
        if (add) setSelected(toggleId(selected, u));
        else if (!selected.includes(u)) { clearSelection(); setSelected([u]); }
        const it = plot.items[u];
        setWallIndex(null); setOpeningId(null);
        if (!add && it) drag.current = { kind: "item", last: unproj(viewOf(), sx, sy, fz(it)), z: fz(it) };
        return;
      }
      const object = [...(plot.objects ?? [])].reverse().find((o) => {
        if (!view3d && o.floor !== fl) return false;
        const z = (floors[o.floor]?.z ?? 0) + (view3d ? o.h : 0);
        return objectContains(o, ...unproj(viewOf(), sx, sy, z));
      });
      if (object) {
        const already = objectIds.includes(object.id);
        if (add) { const ids = toggleId(objectIds, object.id); setObjectIds(ids); focusObject(ids.includes(object.id) ? object.id : ids[0] ?? null); }
        else if (!already) { clearSelection(); setObjectId(object.id); }
        setWallIndex(null); setOpeningId(null);
        const z = (floors[object.floor]?.z ?? 0) + (view3d ? object.h : 0);
        if (!add) drag.current = { kind: "item", last: unproj(viewOf(), sx, sy, z), z };
        return;
      }
      const wh = wallHit(sx, sy);
      if (wh && !add) {
        clearSelection(); setWallIndex(wh.index);
        setOpeningId(plot.openings?.find((o) => o.stroke === wh.index && o.segment === wh.segment && Math.abs(o.center - wh.t) < .1)?.id ?? null);
        drag.current = { kind: "layout", target: "wall", id: wh.index, segment: wh.segment, last: fp };
        return;
      }
      setWallIndex(null); setOpeningId(null);
      drag.current = { kind: "box", sx, sy, add };
      setBox([sx, sy, sx, sy]);
    } else if (tool === "draw" || tool === "rect") {
      drag.current = { kind: "stroke", start: fp };
      setPlot({ ...plot, strokes: [...plot.strokes, { pts: [fp, fp], color: ink, w: 0.08, height: wallHeight, ...(fl ? { floor: fl } : {}) }] });
    }
  };
  const move = (e: React.PointerEvent) => {
    const [sx, sy] = pos(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [sx, sy]);
    const d = drag.current;
    if (!d) return;
    const editing = ["item", "rot", "layout", "camera", "meter", "stroke"].includes(d.kind);
    if (editing && !plotEditSession.isUnlocked()) {
      if (Math.hypot(sx - dragStart.current[0], sy - dragStart.current[1]) < 5) return;
      if (!ensureUnlocked()) { drag.current = null; return; }
    }
    const p = plotRef.current;
    if (d.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts as [[number, number], [number, number]];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let dAng = ((Math.atan2(b[1] - a[1], b[0] - a[0]) - d.a0) * 180) / Math.PI;
      dAng = ((dAng + 540) % 360) - 180;
      const wrap = (r: number) => Math.round(((r + 540) % 360) - 180);
      if (d.cameraRot0 !== undefined) {
        const rot = wrap(d.cameraRot0 + dAng);
        setPlot({ ...p, cameras: (p.cameras ?? []).map((c) => c.id === cameraId ? { ...c, rot } : c) });
        return;
      }
      if (d.objRot0 !== undefined) {
        // two-finger twist rotates the selected set object
        setPlot({ ...p, objects: (p.objects ?? []).map((o) => o.id === objectId ? { ...o, rot: wrap(d.objRot0! + dAng) } : o) });
        return;
      }
      if (d.itemRot0) {
        const r0 = d.itemRot0;
        setPlot({ ...p, items: Object.fromEntries(Object.entries(p.items).map(([k, v]) => [k, r0[k] !== undefined ? { ...v, rot: wrap(r0[k]! + dAng) } : v])) });
        return;
      }
      // free view: pinch zooms, two-finger drag pans, twist turns the view
      const ny = wrap(d.yaw0 + dAng);
      const nz = clampN(d.z0 * (dist / d.d0), 0.2, 12);
      const fp = unproj(viewOf(d.z0, d.pan0, d.yaw0), d.mid0[0], d.mid0[1]);
      const q = proj(viewOf(nz, d.pan0, ny), fp[0], fp[1]);
      setYaw(ny); setZoom(nz); setPan([d.pan0[0] + mid[0] - q[0], d.pan0[1] + mid[1] - q[1]]);
    } else if (d.kind === "tilt3") {
      const pts = [...pointers.current.values()];
      if (pts.length < 3) return;
      const my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      setPitch(Math.round(clampN(d.pitch0 - (my - d.my0) * 0.3, 15, 89)));
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
    } else if (d.kind === "camera") {
      const fp = unproj(viewOf(), sx, sy, d.z);
      const dx = fp[0] - d.last[0], dy = fp[1] - d.last[1]; d.last = fp;
      setPlot({ ...p, cameras: (p.cameras ?? []).map((c) => c.id === d.id ? { ...c, x: +(c.x + dx).toFixed(2), y: +(c.y + dy).toFixed(2) } : c) });
    } else if (d.kind === "meter") {
      const fp = unproj(viewOf(), sx, sy, d.z);
      const dx = fp[0] - d.last[0], dy = fp[1] - d.last[1]; d.last = fp;
      setPlot({ ...p, meters: (p.meters ?? []).map((m) => m.id === d.id ? { ...m, x: +(m.x + dx).toFixed(2), y: +(m.y + dy).toFixed(2) } : m) });
    } else if (d.kind === "layout") {
      const fp = clampFloor(unproj(viewOf(),sx,sy,floorZ)), dx = fp[0]-d.last[0], dy = fp[1]-d.last[1]; d.last=fp;
      if (d.target === "wall") setPlot({...p,strokes:p.strokes.map((st,i) => {
        if (i !== d.id) return st;
        const seg = d.segment;
        // drag only the grabbed segment (its two endpoints); whole stroke if unknown
        if (seg == null || seg + 1 >= st.pts.length) return {...st,pts:st.pts.map(([x,y]):[number,number] => [x+dx,y+dy])};
        return {...st,pts:st.pts.map(([x,y],pi):[number,number] => pi === seg || pi === seg + 1 ? [x+dx,y+dy] : [x,y])};
      })});
      else setPlot({...p,objects:(p.objects ?? []).map((o) => o.id === d.id ? {...o,x:o.x+dx,y:o.y+dy}:o)});
    } else if (d.kind === "item") {
      const fp = unproj(viewOf(), sx, sy, d.z);
      const dx = fp[0] - d.last[0], dy = fp[1] - d.last[1];
      d.last = fp;
      const sel = selected.filter((u) => p.items[u]);
      setPlot({ ...p,
        items: Object.fromEntries(Object.entries(p.items).map(([k, v]) => [k, sel.includes(k) ? { ...v, x: +(v.x + dx).toFixed(2), y: +(v.y + dy).toFixed(2) } : v])),
        objects: (p.objects ?? []).map((o) => objectIds.includes(o.id) ? { ...o, x: +(o.x + dx).toFixed(2), y: +(o.y + dy).toFixed(2) } : o),
        cameras: (p.cameras ?? []).map((c) => cameraIds.includes(c.id) ? { ...c, x: +(c.x + dx).toFixed(2), y: +(c.y + dy).toFixed(2) } : c),
      });
    } else {
      const fp = clampFloor(unproj(viewOf(), sx, sy, floorZ));
      const strokes = [...p.strokes];
      const last = strokes[strokes.length - 1]!;
      const [x0, y0] = d.start;
      strokes[strokes.length - 1] = tool === "rect"
        ? { ...last, pts: [[x0, y0], [fp[0], y0], fp, [x0, fp[1]], [x0, y0]] }
        : { ...last, pts: [d.start, fp] };
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
      const inBox = ([x, y]: [number, number]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1);
      const objects = (plot.objects ?? []).filter((o) => (view3d || o.floor === fl) && inBox(proj(V, o.x, o.y, (floors[o.floor]?.z ?? 0) + (view3d ? o.h : 0)))).map((o) => o.id);
      const cameras = (plot.cameras ?? []).filter((c) => (view3d || c.floor === fl) && inBox(proj(V, c.x, c.y, (floors[c.floor]?.z ?? 0) + c.h))).map((c) => c.id);
      const merge = (previous: string[], found: string[]) => tiny ? (d.add ? previous : []) : d.add ? [...new Set([...previous, ...found])] : found;
      const nextObjects = merge(objectIds, objects), nextCameras = merge(cameraIds, cameras);
      setSelected(merge(selected, inside)); setObjectIds(nextObjects); setCameraIds(nextCameras);
      focusObject(nextObjects[0] ?? null); focusCamera(nextCameras[0] ?? null);
      setBox(null);
    }
    drag.current = pointers.current.size ? drag.current : null;
    if (d?.kind === "pinch" || d?.kind === "tilt3") drag.current = null;
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
    setWallIndex(null); setObjectId(null); setOpeningId(null); setCameraId(null);
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
  /** Approximate body length (m) so "touching" spacing puts tubes end to end. */
  const bodyLen = (uid: string) => {
    const f = fixtures.find((x) => x.uid === uid); const m = f ? getDef(f.defId).model.toLowerCase() : "";
    if (/hyperion/.test(m)) return 2.07; if (/titan/.test(m)) return 1.035; if (/helios/.test(m)) return 0.52; if (/pixelbrick|nyx|ax3|ax5|pixel ?bulb/.test(m)) return 0.12; if (/ax1/.test(m)) return 1.0;
    return 0.3;
  };
  const arrange = (axis: "x" | "y", gap: number) => {
    const list = selItems.map((u) => [u, plot.items[u]!] as const).filter(([, v]) => v).sort((a, b) => a[1][axis] - b[1][axis]);
    if (list.length < 2) return;
    const other = axis === "x" ? "y" : "x";
    const lineAt = list[0]![1][other];
    let pos = list[0]![1][axis];
    const items = { ...plot.items };
    list.forEach(([u, v], i) => {
      if (i > 0) pos += bodyLen(list[i - 1]![0]) / 2 + gap + bodyLen(u) / 2;
      items[u] = { ...v, [axis]: pos, [other]: lineAt };
    });
    setPlot({ ...plot, items });
  };
  const nudge = (d: number) => selItems.forEach((u) => { const f = fixtures.find((x) => x.uid === u); if (f) update(u, { intensity: clampN(+(f.intensity + d).toFixed(3), 0, 1), on: true }); });
  const allOn = selItems.every((u) => fixtures.find((x) => x.uid === u)?.on !== false);
  const removeSelection = () => {
    if (!ensureUnlocked()) return;
    const count = selItems.length + objectIds.length + cameraIds.length;
    if (count) {
      if (!confirm(`Remove ${count} selected item(s) from the plot? Lights will stay patched.`)) return;
      const items = { ...plot.items }; selItems.forEach((u) => delete items[u]);
      setPlot({ ...plot, items, objects: (plot.objects ?? []).filter((o) => !objectIds.includes(o.id)), cameras: (plot.cameras ?? []).filter((c) => !cameraIds.includes(c.id)) });
      clearSelection(); setCamViewOpen(false);
    } else if (openingId) {
      if (!confirm("Remove selected door/window?")) return;
      setPlot({ ...plot, openings: (plot.openings ?? []).filter((o) => o.id !== openingId) }); setOpeningId(null);
    } else if (wallIndex !== null) removeWall(wallIndex);
  };

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
    if (!ensureUnlocked()) return;
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
    setPlot({ ...plot, items, strokes, openings, objects: (plot.objects ?? []).filter((o) => o.floor !== fl).map((o) => o.floor > fl ? {...o,floor:o.floor-1}:o), cameras: (plot.cameras ?? []).filter((c) => c.floor !== fl).map((c) => c.floor > fl ? { ...c, floor: c.floor - 1 } : c), floors: floors.filter((_, j) => j !== fl) });
    setActive(fl - 1);
  };

  // floating quick controls above the first selected light
  const V = viewOf();
  const quick = firstItem && visible(firstItem) ? headOf(V, firstItem) : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" onPointerDownCapture={() => { gesture.current = { active: true, recorded: false }; }} onPointerUp={() => { gesture.current.active = false; }} onPointerCancel={() => { gesture.current.active = false; }}>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5">
        <h2 className="mr-2 font-display text-lg font-semibold">Live plot</h2>
        <div className="flex overflow-hidden rounded-lg">
          <button onClick={() => setView3d(false)} className={`px-3 py-2 text-xs font-bold ${!view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>2D</button>
          <button onClick={() => { setView3d(true); if (yaw === 0) setYaw(-30); }} className={`flex items-center gap-1 px-3 py-2 text-xs font-bold ${view3d ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><Box className="h-3.5 w-3.5" />3D</button>
        </div>
        <Button variant="secondary" aria-label={tool === "pan" ? "Pan" : "Select / move"} title="Toggle Select / Pan" onClick={() => setTool(tool === "move" ? "pan" : "move")}>{tool === "pan" ? <Hand /> : <MousePointer2 />}{tool === "pan" ? "Pan" : "Select"}</Button>
        <Button variant={multiSelect ? "default" : "secondary"} size="icon" aria-label="Multiselect" aria-pressed={multiSelect} title="Multiselect" onClick={() => { setMultiSelect(!multiSelect); setTool("move"); }}><ListChecks /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant={["draw", "rect", "door", "window"].includes(tool) ? "default" : "secondary"}><Pencil />Build<ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setTool("draw")}><Pencil />Wall</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTool("rect")}><SquareIcon />Box</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTool("door")}><DoorOpen />Door</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTool("window")}><PanelsTopLeft />Window</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant={tool === "fixture" ? "default" : "secondary"}><LampDesk />Add fixture<ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">
          {unplaced.length === 0 && <DropdownMenuItem disabled>No unplaced fixtures</DropdownMenuItem>}
          {unplaced.map((f) => <DropdownMenuItem key={f.uid} onSelect={() => { setPlacementUid(f.uid); setTool("fixture"); }}>{f.name}</DropdownMenuItem>)}
          {unplaced.length > 1 && <DropdownMenuItem onSelect={placeAll}>Place all</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant={tool === "object" ? "default" : "secondary"}><Armchair />Props<ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="start">
          {SET_OBJECTS.map((o) => <DropdownMenuItem key={o.kind} onSelect={() => { setObjectKind(o.kind); setTool("object"); }}>{o.label}</DropdownMenuItem>)}
        </DropdownMenuContent></DropdownMenu>
        <Button variant={tool === "camera" ? "default" : "secondary"} aria-label="Add camera" title="Place camera" onClick={() => { setTool("camera"); clearSelection(); }}><Video className="h-4 w-4" /><span className="hidden md:inline">Camera</span></Button>
        <Button variant={tool === "meter" ? "default" : "secondary"} aria-label="Add light meter" title="Place light meter" onClick={() => { setTool("meter"); clearSelection(); }}><Gauge className="h-4 w-4" /><span className="hidden md:inline">Meter</span></Button>
        <Button variant={layoutUnlocked ? "default" : "secondary"} aria-label={layoutUnlocked ? "Layout unlocked" : "Unlock layout editing"} title={layoutUnlocked ? "Unlocked for this app session" : "Unlock layout editing"} onClick={ensureUnlocked}>{layoutUnlocked ? <Unlock /> : <LockKeyhole />}</Button>
        <Button variant="secondary" size="icon" title="Undo" aria-label="Undo" disabled={!history.current.canUndo} onClick={undo}><Undo2 /></Button>
        <Button variant="secondary" size="icon" title="Redo" aria-label="Redo" disabled={!history.current.canRedo} onClick={redo}><Redo2 /></Button>
        <Button variant="destructive" size="sm" aria-label="Remove selected from plot" title="Remove selected item" disabled={!selItems.length && wallIndex === null && !objectIds.length && !openingId && !cameraIds.length} onClick={removeSelection}><Trash2 className="h-4 w-4" />Remove</Button>
        {(tool === "draw" || tool === "rect") && (
          <input type="color" value={ink} onChange={(e) => setInk(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Drawing colour" />
        )}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs font-semibold">
          <ImagePlus className="h-4 w-4" /><span className="hidden md:inline">Floor plan / photo</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
        {bgOf(fl) && <button onClick={removeImage} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Remove image</button>}
        {plot.strokes.some((s) => (s.floor ?? 0) === fl) && <button onClick={() => { if (ensureUnlocked() && confirm("Clear the drawing on this floor?"))  { const strokes = plot.strokes.filter((s) => (s.floor ?? 0) !== fl); setPlot({ ...plot, strokes, openings: remapOpenings(strokes) }); } }} className="rounded-lg bg-surface-elevated px-3 py-2 text-xs">Clear drawing</button>}
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
            <label className="flex items-center gap-2">Turn <input type="range" min={-180} max={180} value={yaw} onChange={(e) => setYaw(+e.target.value)} className="w-24" /><NumberField aria-label="Plot turn degrees" value={yaw} min={-180} max={180} onChange={(v) => { if (v !== undefined) setYaw(v); }} className="w-12 rounded border border-input bg-surface-elevated px-1" /></label>
            {view3d && <label className="flex items-center gap-2">Tilt <input type="range" min={15} max={89} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="w-20" /><NumberField aria-label="Plot tilt degrees" value={pitch} min={15} max={89} onChange={(v) => { if (v !== undefined) setPitch(v); }} className="w-12 rounded border border-input bg-surface-elevated px-1" /></label>}
            <div className="flex items-center gap-1">
              <button onClick={() => zoomAt(zoom / 1.25, dims.w / 2, dims.h / 2)} className="rounded-md bg-surface-elevated p-1.5" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
              <button onClick={() => zoomAt(zoom * 1.25, dims.w / 2, dims.h / 2)} className="rounded-md bg-surface-elevated p-1.5" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setZoom(1); setPan([0, 0]); setYaw(view3d ? -30 : 0); }} className="rounded-md bg-surface-elevated p-1.5" aria-label="Reset view"><Maximize className="h-3.5 w-3.5" /></button>
            </div>
            <button onClick={() => setBeamsOn((b) => !b)} title="Only hides the light pools on this plot — the real lights keep running"
              className={`rounded-md px-2 py-1.5 font-semibold ${beamsOn ? "bg-surface-elevated" : "bg-amber-glow text-primary-foreground"}`}>{beamsOn ? "Light preview on" : "Light preview off"}</button>
            <span className="hidden xl:inline">2 fingers: move · pinch · twist · 3 fingers: tilt</span>
          </div>
          <div className="absolute right-3 top-3 rounded-md bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted-foreground">∞ × ∞ m</div>
        </div>

        <aside className="max-h-[45vh] lg:max-h-none w-full shrink-0 space-y-4 overflow-auto border-t border-border bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
          {(selItems.length + objectIds.length + cameraIds.length > 0) && <div className="flex items-center justify-between gap-2 border-b border-border pb-2 text-xs"><span role="status" aria-label="Plot selection">{selItems.length} lights · {objectIds.length} objects · {cameraIds.length} cameras</span><Button variant="ghost" size="icon" aria-label="Clear plot selection" title="Clear selection" onClick={clearSelection}><X /></Button></div>}
          {(plot.cameras?.length ?? 0) > 0 && (() => {
            const cams = plot.cameras ?? [];
            const cam = cams.find((c) => c.id === cameraId) ?? cams[0];
            if (!cam) return null;
            const editCam = (p: Partial<PlotCamera>) => setPlot({ ...plot, cameras: cams.map((c) => (c.id === cam.id ? { ...c, ...p } : c)) });
            const camLights = fixtures.filter((f) => plot.items[f.uid] && floorOf(plot.items[f.uid]!) === cam.floor).map((f) => {
              const it = plot.items[f.uid]!; const o = opticsOf(f, it);
              return { x: it.x, y: it.y, z: fz(it) + it.h, rot: it.rot, tilt: it.tilt ?? DEFAULT_TILT, beam: o.beam, watts: o.watts, level: levelOf(f), rgb: colorOf(f) };
            });
            const pick = (label: string, value: number, opts: number[], fmt: (n: number) => string, on: (n: number) => void) => (
              <label className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">{label}</span>
                <select value={value} onChange={(e) => on(+e.target.value)} className="rounded-md bg-surface-elevated px-2 py-1 text-xs">
                  {[...new Set([...opts, value])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{fmt(n)}</option>)}
                </select>
              </label>
            );
            return (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 shrink-0 text-primary" />
                  <select aria-label="Select camera" value={cam.id} onChange={(e) => { const c = cams.find((c) => c.id === e.target.value); if (c) selectCamera(c); }} className="min-w-0 flex-1 rounded border border-input bg-surface-elevated p-2 text-xs">
                    {cams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button size="icon" variant="ghost" aria-label="Remove camera" title="Remove camera" onClick={() => removeCamera(cam.id)}><Trash2 /></Button>
                </div>
                <Button size="sm" className="w-full" variant={camViewOpen ? "default" : "secondary"} onClick={() => setCamViewOpen(!camViewOpen)}><Video />{camViewOpen ? "Hide camera view" : "Camera view"}</Button>
                {camViewOpen && <CameraView cam={cam} size={plot.size} strokes={plot.strokes} openings={plot.openings ?? []} objects={plot.objects ?? []} floorZ={floors[cam.floor]?.z ?? 0} lights={camLights} />}
                <input aria-label="Camera name" value={cam.name} onChange={(e) => editCam({ name: e.target.value })} className="w-full rounded border border-input bg-surface-elevated p-2 text-xs" />
                {pick("Lens", cam.lens, LENSES, (n) => `${n} mm`, (lens) => editCam({ lens }))}
                <Slider label="Focal length" value={cam.lens} min={8} max={300} step={1} unit=" mm" onChange={(lens) => editCam({ lens })} />
                {pick("Iris", cam.fstop, FSTOPS, (n) => `f/${n}`, (fstop) => editCam({ fstop }))}
                {pick("ISO", cam.iso, ISOS, (n) => `ISO ${n}`, (iso) => editCam({ iso }))}
                {pick("Fps", cam.fps ?? 24, FPS_OPTIONS, (n) => `${n} fps`, (fps) => editCam({ fps }))}
                {pick("Shutter angle", cam.shutterAngle ?? 180, SHUTTER_ANGLES, (n) => `${n}°`, (shutterAngle) => editCam({ shutterAngle }))}
                <label className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">Sensor</span>
                  <select value={cam.sensor} onChange={(e) => editCam({ sensor: e.target.value as PlotCamera["sensor"] })} className="rounded-md bg-surface-elevated px-2 py-1 text-xs">
                    {SENSORS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </label>
                <p className="text-[10px] text-muted-foreground">Horizontal view {horizontalFov(cam).toFixed(1)}°</p>
                <Slider label="Camera X" value={cam.x} unbounded min={cam.x - 50} max={cam.x + 50} step={0.1} unit=" m" onChange={(x) => editCam({ x })} />
                <Slider label="Camera Y" value={cam.y} unbounded min={cam.y - 50} max={cam.y + 50} step={0.1} unit=" m" onChange={(y) => editCam({ y })} />
                <Slider label="Camera height" value={cam.h} min={0.1} max={50} step={0.1} unit=" m" onChange={(h) => editCam({ h })} />
                <Slider label="Camera pan" value={cam.rot} min={-180} max={180} unit="°" onChange={(rot) => editCam({ rot })} />
                <Slider label="Camera tilt down" value={cam.tilt} min={-60} max={90} unit="°" onChange={(tilt) => editCam({ tilt })} />
                {floors.length > 1 && <label className="flex items-center justify-between text-xs">Camera floor<select aria-label="Camera floor" value={cam.floor} onChange={(e) => { editCam({ floor: +e.target.value }); setActive(+e.target.value); }} className="rounded border border-input bg-surface-elevated p-2">{floors.map((f, i) => <option key={i} value={i}>{f.name}</option>)}</select></label>}
              </div>
            );
          })()}

          {meterId && (() => {
            const met = (plot.meters ?? []).find((m) => m.id === meterId);
            if (!met) return null;
            const pt = { x: met.x, y: met.y, z: met.z, floor: met.floor ?? 0 };
            const { lux, fc } = meterReading(pt);
            const cams = plot.cameras ?? [];
            return (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Gauge className="h-4 w-4 text-amber-glow" />Light meter</h3>
                  <Button variant="ghost" size="icon" aria-label="Remove light meter" title="Remove light meter" onClick={() => removeMeter(met.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <p className="font-mono text-sm">{Math.round(lux)} lx <span className="text-muted-foreground">· {fc.toFixed(1)} fc</span></p>
                <Slider label="Meter height" value={met.z} min={0.1} max={3} step={0.05} unit=" m" onChange={(z) => setPlot({ ...plot, meters: (plot.meters ?? []).map((m) => m.id === met.id ? { ...m, z } : m) })} />
                {cams.length > 0 && (
                  <div className="space-y-1 rounded-md border border-border p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exposure per camera</p>
                    {cams.map((cam) => {
                      const stop = roundToThirdStop(tStopFor(lux, cam.iso, shutterSeconds(cam.fps, cam.shutterAngle)));
                      const diff = stopsDifference(stop.value, cam.fstop);
                      const diffColour = diff > 0.05 ? "text-amber-glow" : diff < -0.05 ? "text-primary" : "text-success";
                      return (
                        <div key={cam.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-muted-foreground">{cam.name}</span>
                          <span className="font-mono">needs {stop.label}<span className={`ml-1 ${diffColour}`}>({diff >= 0 ? "+" : ""}{diff.toFixed(1)} stop @ f/{cam.fstop})</span></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {(plot.objects ?? []).some((o) => o.kind === "person" && o.floor === fl) && (meterLights[fl]?.length ?? 0) > 0 && (
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Person meters (auto)</p>
              {(plot.objects ?? []).filter((o) => o.kind === "person" && o.floor === fl).map((o) => {
                const { lux, fc } = meterReading({ x: o.x, y: o.y, z: o.h - 0.15, floor: o.floor });
                return <div key={o.id} className="flex items-center justify-between text-[11px]"><span>{o.name}</span><span className="font-mono">{Math.round(lux)} lx · {fc.toFixed(1)} fc</span></div>;
              })}
            </div>
          )}
          {tool === "fixture" && <label className="block space-y-2 text-xs">Add fixture<select aria-label="Fixture to place" value={placementUid} onChange={(e) => setPlacementUid(e.target.value)} className="w-full rounded border border-input bg-surface-elevated p-2"><option value="">{unplaced.length ? "Select fixture" : "No unplaced lights — patch first"}</option>{unplaced.map((f) => <option key={f.uid} value={f.uid}>{f.name}</option>)}</select></label>}
          {tool === "object" && <div className="grid grid-cols-2 gap-2">{SET_OBJECTS.map((o) => <Button key={o.kind} variant={objectKind === o.kind ? "default":"secondary"} onClick={() => setObjectKind(o.kind)}>{o.label}</Button>)}</div>}
          {(tool === "draw" || tool === "rect") && <Slider label="New wall height" value={wallHeight} min={.2} max={12} step={.1} unit=" m" onChange={setWallHeight} />}
          {wallIndex !== null && plot.strokes[wallIndex] && (() => {
            const st = plot.strokes[wallIndex]; if (!st) return null;
            const edit = (next: Plot["strokes"][number]) => setPlot({...plot,strokes:plot.strokes.map((s,i) => i === wallIndex ? next:s)});
            const origin = st.pts[0] ?? [0,0];
            return <div className="space-y-2"><h3 className="text-sm font-semibold">Wall {wallIndex+1}</h3><fieldset className="space-y-2 disabled:opacity-50">
              <Slider label="Wall height" value={st.height ?? WALL_H} min={.2} max={12} step={.1} unit=" m" onChange={(height) => edit({...st,height})} />
              <Slider label="Wall X" value={origin[0] ?? 0} unbounded min={(origin[0] ?? 0) - 50} max={(origin[0] ?? 0) + 50} step={.1} unit=" m" onChange={(x) => edit({...st,pts:st.pts.map(([a,b]):[number,number] => [a+x-(origin[0] ?? 0),b])})} />
              <Slider label="Wall Y" value={origin[1] ?? 0} unbounded min={(origin[1] ?? 0) - 50} max={(origin[1] ?? 0) + 50} step={.1} unit=" m" onChange={(y) => edit({...st,pts:st.pts.map(([a,b]):[number,number] => [a,b+y-(origin[1] ?? 0)])})} />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wall lengths</p>
              {st.pts.slice(1).map((b,i) => {
                const a = st.pts[i]!; const len = Math.hypot(b[0]-a[0], b[1]-a[1]);
                const closed = st.pts.length > 2 && Math.hypot(st.pts[0]![0]-st.pts[st.pts.length-1]![0], st.pts[0]![1]-st.pts[st.pts.length-1]![1]) < 1e-3;
                const setLen = (next: number) => {
                  if (!(next > 0.05) || len < 1e-6) return;
                  const dx = (b[0]-a[0])/len*(next-len), dy = (b[1]-a[1])/len*(next-len);
                  const last = st.pts.length - 1;
                  const pts = st.pts.map((p,j):[number,number] => (j > i && !(closed && j === last)) ? [p[0]+dx,p[1]+dy] : p);
                  if (closed) pts[last] = [pts[0]![0], pts[0]![1]];
                  edit({...st,pts});
                };
                return <label key={i} className="flex items-center justify-between gap-2 text-xs"><span>Side {i+1}</span><span className="flex items-center gap-1"><NumberField aria-label={`Wall side ${i+1} length`} min={.05} value={+len.toFixed(2)} onChange={(v) => v && setLen(v)} className="w-20 rounded border border-input bg-surface-elevated p-1 text-right font-mono" />m</span></label>;
              })}
            </fieldset><Button variant="ghost" size="sm" onClick={() => removeWall(wallIndex)}><Trash2 />Delete wall</Button></div>;
          })()}
          {objectId && (() => {
            const o = plot.objects?.find((o) => o.id === objectId); if (!o) return null;
            const edit = (patch: Partial<SetObject>) => setPlot({...plot,objects:(plot.objects ?? []).map((x) => x.id === o.id ? {...x,...patch}:x)});
            return <div className="space-y-2"><h3 className="text-sm font-semibold">{o.name}</h3><fieldset className="space-y-2 disabled:opacity-50"><input aria-label="Object name" value={o.name} onChange={(e) => edit({name:e.target.value})} className="w-full rounded border border-input bg-surface-elevated p-2" />{([['Object X','x',SW],['Object Y','y',SH],['Object width','w',20],['Object depth','d',20],['Object height','h',20],['Object rotation','rot',180]] as const).map(([label,key,max]) => <Slider key={key} label={label} value={o[key]} unbounded={key === "x" || key === "y"} min={key === "x" || key === "y" ? o[key] - 50 : key === "rot" ? -180:0} max={key === "x" || key === "y" ? o[key] + 50 : max} step={.1} unit={key === "rot" ? "°":" m"} onChange={(v) => edit({[key]:v})} />)}</fieldset><Button variant="ghost" size="sm" onClick={() => removeObject(o.id)}><Trash2 />Remove object</Button></div>;
          })()}
          {first && firstItem ? (
            <div className="space-y-3">
              <SettingsTransfer source={copiedSource} canCopy={!!first} onCopy={onCopy} onPaste={() => { record(); onPaste(); }} />
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selItems.length > 1 ? `${selItems.length} lights` : first.name}</p>
                <button onClick={() => selItems.forEach((u) => update(u, { on: !allOn }))} className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold ${allOn ? "bg-success text-primary-foreground" : "bg-surface-elevated"}`}><Power className="h-3.5 w-3.5" />{allOn ? "ON" : "OFF"}</button>
              </div>
              <Slider label="Intensity" value={first.intensity * 100} min={0} max={100} unit="%" onChange={(v) => selItems.forEach((u) => update(u, { intensity: v / 100, on: true }))} />
              <fieldset className="space-y-3 disabled:opacity-50"><Slider label="Direction (pan)" value={firstItem.rot} min={-180} max={180} unit="°" onChange={(v) => setItems({ rot: v })} />
              <Slider label="Tilt down" value={firstItem.tilt ?? DEFAULT_TILT} min={0} max={90} unit="°" onChange={(v) => setItems({ tilt: v })} />
              <Slider label="Height" value={firstItem.h} min={0.3} max={50} step={0.1} unit=" m" onChange={(v) => setItems({ h: v })} />
              {selItems.length > 1 && <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Align & space</p>
                <label className="flex items-center justify-between gap-2 text-xs"><span>Gap between lights</span><span className="flex items-center gap-1"><NumberField aria-label="Gap between lights" min={0} value={spaceGap} onChange={(v) => setSpaceGap(v ?? 0)} className="w-20 rounded border border-input bg-surface-elevated p-1 text-right font-mono" />m</span></label>
                <div className="flex gap-1">{[0, 0.1, 0.5, 1].map((g) => <Button key={g} size="sm" variant={spaceGap === g ? "default" : "secondary"} className="flex-1" onClick={() => setSpaceGap(g)}>{g === 0 ? "Touch" : `${g} m`}</Button>)}</div>
                <div className="grid grid-cols-2 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => arrange("x", spaceGap)}>Row (left→right)</Button>
                  <Button size="sm" variant="secondary" onClick={() => arrange("y", spaceGap)}>Column (top→bottom)</Button>
                  <Button size="sm" variant="ghost" onClick={() => setItems({ y: firstItem.y })}>Align Y only</Button>
                  <Button size="sm" variant="ghost" onClick={() => setItems({ x: firstItem.x })}>Align X only</Button>
                </div>
              </div>}
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
                    <label className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">Lux @3m</span>
                      <span className="flex items-center gap-1 font-mono">
                        <NumberField aria-label="Lux at 3 metres override" min={0} allowEmpty value={(first as any).lux3m} placeholder={String(Math.round(lux3mOf(getDef(first.defId).model, o.watts, o.beam)))} onChange={(v) => update(first.uid, { lux3m: v } as any)} className="w-20 rounded border border-input bg-surface-elevated px-1 text-right" />
                        lx
                      </span>
                    </label>
                  </>
                );
              })()}
              </fieldset><div className="grid grid-cols-8 gap-1">{["#ffffff","#ff0000","#ff8000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff"].map((c) => <button key={c} aria-label={c} onClick={() => selItems.forEach((u) => update(u, c === "#ffffff" ? { crossfade: 0 } : { hue: hexToHs(c).h, saturation: hexToHs(c).s, crossfade: 1, cctOnly: false }))} className="h-6 rounded border border-input" style={{ background: c }} />)}</div>
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
                 <Button variant="secondary" size="icon" onClick={() => { if (!ensureUnlocked() || !confirm("Remove selected lights from the plot?")) return; const items = { ...plot.items }; selItems.forEach((u) => delete items[u]); setPlot({ ...plot, items }); }} aria-label="Remove from plot"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <div />
          )}


          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold">Doors / windows</p>
            {(plot.openings ?? []).filter((o) => (plot.strokes[o.stroke]?.floor ?? 0) === fl).map((o, i) => <div key={o.id} className="space-y-2">
              <div className="flex items-center gap-2"><Button variant={openingId === o.id ? "default" : "secondary"} size="sm" onClick={() => setOpeningId(o.id)}>{o.kind === "door" ? <DoorOpen /> : <PanelsTopLeft />}{o.kind} {i + 1}</Button><Button variant="ghost" size="icon" aria-label={`Remove ${o.kind} ${i + 1}`} onClick={() => { if (ensureUnlocked() && confirm(`Delete this ${o.kind}?`)) setPlot({ ...plot, openings: plot.openings?.filter((x) => x.id !== o.id) ?? [] }); }}><Trash2 /></Button></div>
              {openingId === o.id && <fieldset className="space-y-2 disabled:opacity-50">
                <Slider label="Opening width" value={o.width} min={0.2} max={Math.hypot((plot.strokes[o.stroke]?.pts[o.segment + 1]?.[0] ?? 0) - (plot.strokes[o.stroke]?.pts[o.segment]?.[0] ?? 0), (plot.strokes[o.stroke]?.pts[o.segment + 1]?.[1] ?? 0) - (plot.strokes[o.stroke]?.pts[o.segment]?.[1] ?? 0))} step={0.1} unit=" m" onChange={(width) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, width } : x) ?? [] })} />
                <Slider label="Opening position" value={o.center * 100} min={0} max={100} unit="%" onChange={(v) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, center: v / 100 } : x) ?? [] })} />
                <Slider label="Sill height" value={o.bottom} min={0} max={(plot.strokes[o.stroke]?.height ?? WALL_H) - 0.1} step={0.1} unit=" m" onChange={(bottom) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, bottom, height: Math.min(x.height, (plot.strokes[o.stroke]?.height ?? WALL_H) - bottom) } : x) ?? [] })} />
                <Slider label="Opening height" value={o.height} min={0.1} max={(plot.strokes[o.stroke]?.height ?? WALL_H) - o.bottom} step={0.1} unit=" m" onChange={(height) => setPlot({ ...plot, openings: plot.openings?.map((x) => x.id === o.id ? { ...x, height } : x) ?? [] })} />
              </fieldset>}
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
            <label className="text-xs text-muted-foreground">Stage width <span className="ml-2 font-mono text-foreground">∞</span></label>
            <label className="text-xs text-muted-foreground">Stage depth <span className="ml-2 font-mono text-foreground">∞</span></label>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, unbounded = false, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; unbounded?: boolean; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{label}</span><span className="flex items-center gap-1 font-mono"><NumberField aria-label={`${label} value`} {...(unbounded ? {} : { min, max })} value={+value.toFixed(2)} onChange={(v) => { if (v !== undefined) onChange(v); }} className="w-16 rounded border border-input bg-surface-elevated px-1 text-right" />{unit}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}
