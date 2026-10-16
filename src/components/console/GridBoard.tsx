import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MACRO_ACTIONS, type Macro, type MacroAction } from "@/lib/macros";
import type { PatchedFixture } from "@/lib/dmx";
import { LocateFixed, PenLine, Plus, Trash2, MousePointer2, Type, ImagePlus, Table2, Pencil, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Free layout (cell units, fractional) of squares — empty, fixture, user macro or text label — plus drawn walls and an optional background picture. */
export interface GridItem { id: string; kind: "empty" | "fixture" | "macro" | "text" | "image" | "table"; w?: number | undefined; h?: number | undefined; color?: string | undefined; src?: string | undefined; invert?: boolean | undefined; opacity?: number | undefined; cols?: number | undefined; rows?: number | undefined; uid?: string | undefined; macro?: { action: MacroAction; amount: number; label: string } | undefined; text?: string | undefined; x: number; y: number; s?: number | undefined }
export interface GridLayout { items: GridItem[]; walls: { x1: number; y1: number; x2: number; y2: number }[]; size?: number; bg?: string | undefined; bgT?: { x: number; y: number; scale: number; invert: boolean } | undefined }
export const emptyGrid = (): GridLayout => ({ items: [], walls: [] });

const CELL = 76, COLS = 24, ROWS = 16, SIZE = 0.92;
const nid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

/** Wall end snaps to straight or 45° lines when within 6°, otherwise stays free at any angle. */
export function snapWall(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (!len) return { x2, y2 };
  const a = Math.atan2(dy, dx), step = Math.PI / 4, s = Math.round(a / step) * step;
  if (Math.abs(a - s) > (6 * Math.PI) / 180) return { x2, y2 };
  return { x2: x1 + Math.cos(s) * len, y2: y1 + Math.sin(s) * len };
}

export type Arrange = "hcenter" | "vcenter" | "hspace" | "vspace" | "row" | "column" | "grid" | "triangle" | "pentagon" | "circle" | "rotate";

/** Arranges squares (top-left positions, cell units). `gap` is free space between squares; squares never end up stacked on each other. */
export function arrange(pts: { id: string; x: number; y: number }[], how: Arrange, gap = 0.2, size = SIZE): { id: string; x: number; y: number }[] {
  if (pts.length < 2) return pts;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, step = size + gap;
  const byX = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), byY = [...pts].sort((a, b) => a.y - b.y || a.x - b.x);
  const n = pts.length;
  const fit = (r: { id: string; x: number; y: number }[]) => {
    const dx = Math.max(0, -Math.min(...r.map((p) => p.x))) - Math.max(0, Math.max(...r.map((p) => p.x)) - (COLS - size));
    const dy = Math.max(0, -Math.min(...r.map((p) => p.y))) - Math.max(0, Math.max(...r.map((p) => p.y)) - (ROWS - size));
    return r.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
  };
  // keeps at least one square + gap between neighbours along an axis
  const spread = (sorted: { id: string; x: number; y: number }[], k: "x" | "y") => {
    let last = -Infinity;
    return sorted.map((p) => { const v = Math.max(p[k], last + step); last = v; return { ...p, [k]: v }; });
  };
  const angle = (p: { x: number; y: number }) => Math.atan2(p.y - cy, p.x - cx);
  switch (how) {
    case "hcenter": return fit(spread(byX.map((p) => ({ ...p, y: cy })), "x"));
    case "vcenter": return fit(spread(byY.map((p) => ({ ...p, x: cx })), "y"));
    case "hspace": { const s = Math.max((maxX - minX) / (n - 1), step); return fit(byX.map((p, i) => ({ ...p, x: minX + s * i }))); }
    case "vspace": { const s = Math.max((maxY - minY) / (n - 1), step); return fit(byY.map((p, i) => ({ ...p, y: minY + s * i }))); }
    case "row": return fit(byX.map((p, i) => ({ ...p, x: minX + i * step, y: minY })));
    case "column": return fit(byY.map((p, i) => ({ ...p, x: minX, y: minY + i * step })));
    case "grid":
    case "triangle":
    case "pentagon": {
      // shapes place squares only around the outside (perimeter), evenly spaced
      const unit: Record<string, [number, number][]> = {
        grid: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
        triangle: [[0, -0.5774], [0.5, 0.2887], [-0.5, 0.2887]],
        pentagon: Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [Math.cos(a), Math.sin(a)] as [number, number]; }),
      };
      const P = unit[how]!;
      const per1 = P.reduce((s, v, i) => { const w = P[(i + 1) % P.length]!; return s + Math.hypot(w[0] - v[0], w[1] - v[1]); }, 0);
      const r = Math.max(step / 2, (n * step) / per1);
      const lens: number[] = []; let per = 0;
      for (let i = 0; i < P.length; i++) { const v = P[i]!, w = P[(i + 1) % P.length]!; const l = Math.hypot(w[0] - v[0], w[1] - v[1]) * r; lens.push(l); per += l; }
      const order = [...pts].sort((a, b) => angle(a) - angle(b));
      const out: { id: string; x: number; y: number }[] = [];
      let edge = 0, acc = 0;
      for (let i = 0; i < n; i++) {
        const target = (i * per) / n;
        while (edge < P.length - 1 && acc + lens[edge]! < target) { acc += lens[edge]!; edge++; }
        const t = lens[edge]! > 0 ? (target - acc) / lens[edge]! : 0;
        const v = P[edge]!, w = P[(edge + 1) % P.length]!;
        out.push({ ...order[i]!, x: cx + (v[0] + (w[0] - v[0]) * t) * r - size / 2, y: cy + (v[1] + (w[1] - v[1]) * t) * r - size / 2 });
      }
      return fit(out);
    }
    case "circle": {
      const r = Math.max(step / (2 * Math.sin(Math.PI / n)), step);
      const ox = cx + size / 2, oy = cy + size / 2;
      const order = [...pts].sort((a, b) => angle(a) - angle(b));
      return fit(order.map((p, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return { ...p, x: ox + r * Math.cos(a) - size / 2, y: oy + r * Math.sin(a) - size / 2 }; }));
    }
    case "rotate": {
      // screen y points down, so increasing angle is clockwise: each light takes the next light's spot
      const order = [...pts].sort((a, b) => angle(a) - angle(b));
      return order.map((p, i) => { const t = order[(i + 1) % n]!; return { ...p, x: t.x, y: t.y }; });
    }
  }
}

/** Fixture size slider with a selection: resizes only the selected squares (a lone square grows about its own centre, a group about the group centre, layout kept). No selection → items untouched, global size changes instead. */
export function applySize(items: GridItem[], selIds: string[], v: number, def: number, cols = COLS, rows = ROWS): GridItem[] {
  const sel = items.filter((i) => selIds.includes(i.id));
  if (!sel.length) return items;
  const grp = sel.length > 1 ? sel : [];
  const ox = grp.reduce((a, i) => a + i.x + (i.s ?? def) / 2, 0) / grp.length;
  const oy = grp.reduce((a, i) => a + i.y + (i.s ?? def) / 2, 0) / grp.length;
  const ids = new Set(sel.map((i) => i.id));
  return items.map((i) => {
    if (!ids.has(i.id)) return i;
    const o = i.s ?? def, c = { x: i.x + o / 2, y: i.y + o / 2 };
    const n = grp.length ? { x: ox + (c.x - ox) * (v / o), y: oy + (c.y - oy) * (v / o) } : c;
    return { ...i, s: v, w: undefined, h: undefined, x: Math.max(0, Math.min(cols - v, n.x - v / 2)), y: Math.max(0, Math.min(rows - v, n.y - v / 2)) };
  });
}

const ICON: Record<Arrange, React.ReactNode> = {
  hcenter: <><rect x="2" y="9" width="5" height="6" /><rect x="9.5" y="9" width="5" height="6" /><rect x="17" y="9" width="5" height="6" /><line x1="1" y1="12" x2="23" y2="12" /></>,
  vcenter: <><rect x="9" y="2" width="6" height="5" /><rect x="9" y="9.5" width="6" height="5" /><rect x="9" y="17" width="6" height="5" /><line x1="12" y1="1" x2="12" y2="23" /></>,
  hspace: <><rect x="2" y="8" width="4" height="8" /><rect x="10" y="8" width="4" height="8" /><rect x="18" y="8" width="4" height="8" /></>,
  vspace: <><rect x="8" y="2" width="8" height="4" /><rect x="8" y="10" width="8" height="4" /><rect x="8" y="18" width="8" height="4" /></>,
  row: <><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="17" y="9" width="6" height="6" /></>,
  column: <><rect x="9" y="1" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="9" y="17" width="6" height="6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  triangle: <><rect x="9.5" y="2" width="5" height="5" /><rect x="2" y="16" width="5" height="5" /><rect x="17" y="16" width="5" height="5" /></>,
  pentagon: <>{[0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return <rect key={i} x={11 + 8 * Math.cos(a) - 2} y={11 + 8 * Math.sin(a) - 2} width="4" height="4" />; })}</>,
  circle: <>{[0, 1, 2, 3, 4, 5].map((i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return <rect key={i} x={10 + 8 * Math.cos(a)} y={10 + 8 * Math.sin(a)} width="4" height="4" />; })}</>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><polyline points="20 3 20 7 16 7" /></>,
};
const ARRANGE: [Arrange, string][] = [["hcenter", "Middle ↔"], ["vcenter", "Centre ↕"], ["hspace", "Space ↔"], ["vspace", "Space ↕"], ["row", "Line"], ["column", "Column"], ["grid", "Grid"], ["triangle", "Triangle"], ["pentagon", "Pentagon"], ["circle", "Circle"], ["rotate", "Rotate ↻"]];
const LIVE: Arrange[] = ["hspace", "vspace", "row", "column", "grid", "triangle", "pentagon", "circle", "hcenter", "vcenter"];


const ISW = (i: GridItem, d: number) => i.w ?? i.s ?? d;
const ISH = (i: GridItem, d: number) => i.h ?? i.s ?? d;
type Box = { id: string; x: number; y: number; w: number; h: number };
export type Corner = "tl" | "tr" | "bl" | "br";

/** Corner-handle resize of one or many boxes: the opposite bounding-box corner stays fixed and positions + sizes scale independently on X and Y (a circle of squares can become an oval). */
export function resizeBoxes(boxes: Box[], corner: Corner, px: number, py: number, min = 0.3): Box[] {
  if (!boxes.length) return boxes;
  const l = Math.min(...boxes.map((b) => b.x)), t = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w)), b0 = Math.max(...boxes.map((b) => b.y + b.h));
  const ax = corner === "tl" || corner === "bl" ? r : l, ay = corner === "tl" || corner === "tr" ? b0 : t;
  const cx = ax === l ? r : l, cy = ay === t ? b0 : t;
  const minW = Math.min(...boxes.map((b) => b.w)), minH = Math.min(...boxes.map((b) => b.h));
  const kx = Math.max(min / minW, (px - ax) / (cx - ax)), ky = Math.max(min / minH, (py - ay) / (cy - ay));
  return boxes.map((bx) => {
    const w = bx.w * kx, h = bx.h * ky;
    const x = ax === l ? ax + (bx.x - ax) * kx : ax - (ax - bx.x - bx.w) * kx - w;
    const y = ay === t ? ay + (bx.y - ay) * ky : ay - (ay - bx.y - bx.h) * ky - h;
    return { id: bx.id, x, y, w, h };
  });
}

const COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#f5f5f4", "#57534e"];

export function GridBoard({ grid, setGrid, fixtures, selected, onToggle, onSelect, onRun, colorOf, controls, pixelsOf }: {
  grid: GridLayout; setGrid: (g: GridLayout) => void; fixtures: PatchedFixture[]; selected: string[];
  onToggle: (uid: string) => void; onSelect: (uids: string[]) => void; onRun: (m: Macro) => void; colorOf: (f: PatchedFixture) => string; controls: React.ReactNode;
  /** Live pixel colours + layout for pixel fixtures; `long` marks elongated (tube/bar) lights, which default to a wide box. */
  pixelsOf?: (f: PatchedFixture) => { cells?: string[] | undefined; cols: number; rows: number; long: boolean };
}) {
  const [live, setLive] = useState(true);
  const [mode, setMode] = useState<"select" | "walls" | "text">("select");
  const [esel, setEsel] = useState<string[]>([]);
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; sx: number; sy: number; moved: boolean; group: { id: string; x: number; y: number; w: number; h: number }[] } | null>(null);
  const [rs, setRs] = useState<{ corner: Corner; orig: Box[]; out: Box[] } | null>(null);
  const [wall, setWall] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number; add: boolean } | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [action, setAction] = useState<MacroAction>("cct_up");
  const [amount, setAmount] = useState(100);
  const [label, setLabel] = useState("");
  const [gap, setGap] = useState(0.2);
  const [last, setLast] = useState<Arrange | null>(null);
  const sz = grid.size ?? SIZE;
  const longIds = new Set(pixelsOf ? fixtures.filter((f) => pixelsOf(f).long).map((f) => f.uid) : []);
  const isLong = (i: GridItem) => i.kind === "fixture" && i.w == null && i.s == null && longIds.has(i.uid!);
  const W = (i: GridItem) => (isLong(i) ? sz * 2.6 : ISW(i, sz)), H = (i: GridItem) => (isLong(i) ? sz * 0.7 : ISH(i, sz));
  const selItems = live ? grid.items.filter((i) => i.kind === "fixture" && selected.includes(i.uid!)) : grid.items.filter((i) => esel.includes(i.id));
  const apply = (how: Arrange, g: number, size: number) => { const r = arrange(selItems, how, g, size); setGrid({ ...grid, size, items: grid.items.map((i) => { const m = r.find((x) => x.id === i.id); return m ? { ...i, x: m.x, y: m.y, w: undefined, h: undefined, s: undefined } : i; }) }); };
  const doArrange = (how: Arrange) => { apply(how, gap, sz); setLast(LIVE.includes(how) ? how : null); };
  const rescale = (g: number, size: number) => {
    const grp = selItems.length > 1 ? selItems : [];
    const k = (size + g) / (sz + gap);
    const ox = grp.length ? grp.reduce((a, i) => a + i.x + sz / 2, 0) / grp.length : 0;
    const oy = grp.length ? grp.reduce((a, i) => a + i.y + sz / 2, 0) / grp.length : 0;
    const ids = new Set(grp.map((i) => i.id));
    setGrid({ ...grid, size, items: grid.items.map((i) => {
      if (i.w != null || i.kind === "image" || i.kind === "table") return i;
      const c = { x: i.x + sz / 2, y: i.y + sz / 2 };
      const n = ids.has(i.id) ? { x: ox + (c.x - ox) * k, y: oy + (c.y - oy) * k } : c;
      return { ...i, x: n.x - size / 2, y: n.y - size / 2 };
    }) });
  };
  const onGap = (g: number) => { if (selItems.length > 1) rescale(g, sz); setGap(g); };
  const onSize = (v: number) => { if (selItems.length) setGrid({ ...grid, items: applySize(grid.items, selItems.map((i) => i.id), v, sz, 1e6, 1e6).map((i, k) => (selItems.some((x) => x.id === i.id) ? i : grid.items[k]!)) }); else rescale(gap, v); };
  const area = useRef<HTMLDivElement>(null);

  const placed = new Set(grid.items.filter((i) => i.kind === "fixture").map((i) => i.uid));
  const freeSpot = (items: GridItem[]) => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!items.some((i) => i.kind !== "image" && i.kind !== "table" && Math.abs(i.x - x) < W(i) && Math.abs(i.y - y) < H(i))) return { x, y }; return { x: 0, y: 0 }; };
  const pt = (e: { clientX: number; clientY: number }) => { const r = vp.current!.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / (CELL * view.z), y: (e.clientY - r.top - view.y) / (CELL * view.z) }; };
  // Endless canvas: wheel pans, ctrl/pinch-wheel zooms about the cursor; middle/right drag pans; two fingers pinch-zoom and pan.
  const HOME = { x: 12, y: 12, z: 1 };
  const [view, setView] = useState(HOME);
  const vp = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const zoomAt = (px: number, py: number, next: number) => { const v = viewRef.current; const z = Math.max(0.2, Math.min(4, next)), k = z / v.z; setView({ z, x: px - (px - v.x) * k, y: py - (py - v.y) * k }); };
  useEffect(() => {
    const el = vp.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, viewRef.current.z * Math.exp(-e.deltaY * m * 0.004));
      else setView((v) => ({ ...v, x: v.x - e.deltaX * m, y: v.y - e.deltaY * m }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null);
  const panDrag = useRef<{ sx: number; sy: number; x0: number; y0: number } | null>(null);
  const patch = (id: string, p: Partial<GridItem>) => setGrid({ ...grid, items: grid.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const removeIds = (ids: string[]) => { setGrid({ ...grid, items: grid.items.filter((i) => !ids.includes(i.id)) }); setEsel((s) => s.filter((x) => !ids.includes(x))); };
  const pick = grid.items.find((i) => i.id === picker);
  const one = esel.length === 1 ? grid.items.find((i) => i.id === esel[0]) : undefined;
  const meta = MACRO_ACTIONS.find((a) => a.id === action);
  const macroLabel = (m: { action: MacroAction; amount: number; label: string }) => {
    if (m.label) return m.label;
    const a = MACRO_ACTIONS.find((x) => x.id === m.action);
    return a?.unit ? `${a.label} ${m.amount}${a.unit}` : (a?.label ?? m.action);
  };
  const openPicker = (it: GridItem) => { setPicker(it.id); if (it.macro) { setAction(it.macro.action); setAmount(it.macro.amount); setLabel(it.macro.label); } else setLabel(""); };
  const addSquare = () => { const id = nid(); setGrid({ ...grid, items: [...grid.items, { id, kind: "empty", ...freeSpot(grid.items) }] }); setEsel([id]); };
  const addText = (x: number, y: number) => { const id = nid(); setGrid({ ...grid, items: [...grid.items, { id, kind: "text", text: "", x, y }] }); setEsel([id]); setMode("select"); };
  const addTable = () => { const id = nid(); setGrid({ ...grid, items: [...grid.items, { id, kind: "table", text: "Macros", cols: 4, rows: 3, x: 1, y: 1, w: 4 * 1.1, h: 3 * 1.1 + 0.4 }] }); setEsel([id]); };
  /** Packs macro squares (selected ones, or all) into the table's cells in reading order. */
  const fillTable = (t: GridItem) => {
    const cols = t.cols ?? 4, rows = t.rows ?? 3;
    const pool = grid.items.filter((i) => i.kind === "macro" && (esel.length > 1 ? esel.includes(i.id) : true)).sort((a, b) => a.y - b.y || a.x - b.x).slice(0, cols * rows);
    const cw = W(t) / cols, ch = (H(t) - 0.4) / rows, pad = Math.min(cw, ch) * 0.06;
    setGrid({ ...grid, items: grid.items.map((i) => { const k = pool.findIndex((p) => p.id === i.id); if (k < 0) return i; const c = k % cols, r = Math.floor(k / cols); return { ...i, x: t.x + c * cw + pad, y: t.y + 0.4 + r * ch + pad, w: cw - 2 * pad, h: ch - 2 * pad, s: undefined }; }) });
  };
  const toJpeg = async (file: File): Promise<{ src: string; ratio: number }> => {
    let c: HTMLCanvasElement;
    if (file.type === "application/pdf") {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: Math.min(4, 1600 / page.getViewport({ scale: 1 }).width) });
      c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp } as never).promise;
    } else {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    }
    return { src: c.toDataURL("image/jpeg", 0.82), ratio: c.height / c.width };
  };
  // Any number of pictures / PDF first pages, each a movable, resizable item.
  const importImages = async (files: File[]) => {
    const add: GridItem[] = [];
    for (const [k, f] of files.entries()) {
      try { const { src, ratio } = await toJpeg(f); const w = Math.min(8, 6 / Math.max(1, ratio)); add.push({ id: nid(), kind: "image", src, x: 0.5 + k * 0.5, y: 0.5 + k * 0.5, w, h: w * ratio, opacity: 1 }); }
      catch { alert(`Could not read ${f.name} — try a JPG, PNG or PDF.`); }
    }
    if (add.length) { setGrid({ ...grid, items: [...add, ...grid.items] }); setEsel(add.map((a) => a.id)); }
  };
  const images = grid.items.filter((i) => i.kind === "image");
  const tables = grid.items.filter((i) => i.kind === "table");
  // Dragging a table carries every square whose centre sits inside it.
  const groupFor = (it: GridItem, sel: string[]) => {
    let base = sel.includes(it.id) ? grid.items.filter((i) => sel.includes(i.id)) : [it];
    for (const t of base.filter((b) => b.kind === "table")) for (const i of grid.items) { const cx = i.x + W(i) / 2, cy = i.y + H(i) / 2; if (i.kind !== "image" && i.kind !== "table" && cx > t.x && cx < t.x + W(t) && cy > t.y && cy < t.y + H(t) && !base.includes(i)) base = [...base, i]; }
    return base.map((i) => ({ id: i.id, x: i.x, y: i.y, w: W(i), h: H(i) }));
  };
  const pal = (c?: string) => (c ? { background: c } : undefined);
  const chip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"}`;
  const bbox = !live && esel.length ? (() => { const its = (rs ? rs.out : grid.items.filter((i) => esel.includes(i.id)).map((i) => { const gm = drag?.moved ? drag.group.find((g) => g.id === i.id) : undefined; return { id: i.id, x: gm ? gm.x + drag!.x : i.x, y: gm ? gm.y + drag!.y : i.y, w: W(i), h: H(i) }; })); if (!its.length) return null; const l = Math.min(...its.map((b) => b.x)), t = Math.min(...its.map((b) => b.y)); return { l, t, r: Math.max(...its.map((b) => b.x + b.w)), b: Math.max(...its.map((b) => b.y + b.h)) }; })() : null;

  const editPanel = (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">{mode === "walls" ? "Drag to draw a wall at any angle — it snaps straight or 45° when close. Tap a wall to delete it." : mode === "text" ? "Tap the grid to drop a text label." : "Drag boxes freely. Drag a corner to resize or stretch (works on a multi-selection too). Double-tap a box to pick a macro or fixture and its colour. Drag on empty space to box-select."}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" onClick={addSquare}><Plus />Box</Button>
        <Button variant="secondary" size="sm" onClick={addTable}><Table2 />Table</Button>
        <Button variant="secondary" size="sm" className="col-span-2" disabled={fixtures.every((f) => placed.has(f.uid))}
          onClick={() => { let items = grid.items; for (const f of fixtures) if (!placed.has(f.uid)) items = [...items, { id: nid(), kind: "fixture", uid: f.uid, ...freeSpot(items) }]; setGrid({ ...grid, items }); }}>All lights</Button>
      </div>
      {one && one.kind !== "image" && (
        <section className="space-y-2 rounded-lg border border-primary/50 p-2">
          <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase">{one.kind === "table" ? "Table" : one.kind === "text" ? "Text" : "Box"}</h3>
            {one.kind !== "table" && one.kind !== "text" && <button onClick={() => openPicker(one)} className="text-xs font-semibold text-primary">Macro / fixture…</button>}</div>
          {(one.kind === "text" || one.kind === "table") && <input value={one.text ?? ""} onChange={(e) => patch(one.id, { text: e.target.value })} placeholder={one.kind === "table" ? "Table name" : "Type…"} className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-sm text-foreground" />}
          {one.kind === "table" && (<>
            <div className="flex gap-2 text-[11px] text-muted-foreground">
              <label className="flex items-center gap-1">Cols<input type="number" min={1} max={12} value={one.cols ?? 4} onChange={(e) => patch(one.id, { cols: Math.max(1, Math.min(12, +e.target.value || 1)) })} className="w-12 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono text-foreground" /></label>
              <label className="flex items-center gap-1">Rows<input type="number" min={1} max={12} value={one.rows ?? 3} onChange={(e) => patch(one.id, { rows: Math.max(1, Math.min(12, +e.target.value || 1)) })} className="w-12 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono text-foreground" /></label>
            </div>
            <Button size="sm" className="w-full" onClick={() => fillTable(one)}>Put macros in table</Button>
          </>)}
          <ColourRow value={one.color} onPick={(c) => patch(one.id, { color: c || undefined })} />
        </section>
      )}
      {esel.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">{esel.length} selected</h3>
          <ColourRow value={undefined} onPick={(c) => setGrid({ ...grid, items: grid.items.map((i) => (esel.includes(i.id) ? { ...i, color: c || undefined } : i)) })} />
          {tables.length > 0 && <div className="flex flex-wrap gap-1">{tables.map((t) => <Button key={t.id} variant="secondary" size="sm" onClick={() => fillTable(t)}>Into {t.text || "table"}</Button>)}</div>}
          <div className="grid grid-cols-3 gap-1">
            {ARRANGE.map(([k, l]) => <button key={k} onClick={() => doArrange(k)} aria-pressed={last === k} className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-semibold active:scale-95 ${last === k ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>{ICON[k]}</svg>{l}</button>)}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Spacing
            <input type="range" min={0} max={2} step={0.05} value={gap} onChange={(e) => onGap(+e.target.value)} className="flex-1" />
            <span className="w-8 text-right font-mono">{Math.round(gap * 100)}%</span>
          </label>
        </section>
      )}
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Box size
        <input type="range" min={0.4} max={2} step={0.02} value={selItems[0] ? W(selItems[0]) : sz} onChange={(e) => onSize(+e.target.value)} className="flex-1" />
        <span className="w-8 text-right font-mono">{Math.round((selItems[0] ? W(selItems[0]) : sz) * 100)}%</span>
      </label>
      {esel.length > 0 && <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => removeIds(esel)}><Trash2 />Delete {esel.length > 1 ? `${esel.length} items` : "item"}</Button>}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">Pictures ({images.length + (grid.bg ? 1 : 0)})</h3>
        {images.map((im, k) => (
          <div key={im.id} className={`flex items-center gap-2 rounded-md border p-1.5 ${esel.includes(im.id) ? "border-primary" : "border-border"}`}>
            <button onClick={() => setEsel([im.id])} className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-elevated"><img src={im.src} alt={`Picture ${k + 1}`} className="h-full w-full object-cover" style={{ filter: im.invert ? "invert(1)" : undefined }} /></button>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap gap-1">
                <button onClick={() => { const c = { x: im.x + W(im) / 2, y: im.y + H(im) / 2 }; const w = W(im) / 1.2, h = H(im) / 1.2; patch(im.id, { w, h, x: c.x - w / 2, y: c.y - h / 2 }); }} className="rounded bg-surface-elevated px-2 text-xs font-bold">−</button>
                <button onClick={() => { const c = { x: im.x + W(im) / 2, y: im.y + H(im) / 2 }; const w = W(im) * 1.2, h = H(im) * 1.2; patch(im.id, { w, h, x: c.x - w / 2, y: c.y - h / 2 }); }} className="rounded bg-surface-elevated px-2 text-xs font-bold">+</button>
                <button onClick={() => patch(im.id, { invert: !im.invert })} aria-pressed={!!im.invert} className={`rounded px-2 text-[10px] font-bold ${im.invert ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>Invert</button>
                <button onClick={() => removeIds([im.id])} aria-label="Remove picture" className="rounded px-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <input type="range" aria-label="Opacity" min={0.1} max={1} step={0.05} value={im.opacity ?? 1} onChange={(e) => patch(im.id, { opacity: +e.target.value })} className="w-full" />
            </div>
          </div>
        ))}
        {grid.bg && <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => setGrid({ ...grid, bg: undefined })}><Trash2 />Remove old background</Button>}
      </section>
      {grid.walls.length > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setGrid({ ...grid, walls: [] })}><Trash2 />Clear walls</Button>}
    </div>
  );

  const sortedActions = [...MACRO_ACTIONS].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-3 py-2">
          <div className="mr-2 flex rounded-full bg-surface-elevated p-0.5">
            <button onClick={() => { setLive(true); setEsel([]); setMode("select"); }} aria-pressed={live} className={chip(live)}><Play className="h-3.5 w-3.5" />Live</button>
            <button onClick={() => setLive(false)} aria-pressed={!live} className={chip(!live)}><Pencil className="h-3.5 w-3.5" />Edit</button>
          </div>
          <button onClick={() => setView(HOME)} className={chip(false)} aria-label="Recenter grid"><LocateFixed className="h-3.5 w-3.5" />Recenter</button>
          <span className="font-mono text-[10px] text-muted-foreground">{Math.round(view.z * 100)}%</span>
          {!live && (<>
            <button onClick={() => setMode("select")} aria-pressed={mode === "select"} className={chip(mode === "select")}><MousePointer2 className="h-3.5 w-3.5" />Select</button>
            <button onClick={() => setMode("walls")} aria-pressed={mode === "walls"} className={chip(mode === "walls")}><PenLine className="h-3.5 w-3.5" />Walls</button>
            <button onClick={() => setMode("text")} aria-pressed={mode === "text"} className={chip(mode === "text")}><Type className="h-3.5 w-3.5" />Text</button>
            <label className={`${chip(false)} cursor-pointer`}><ImagePlus className="h-3.5 w-3.5" />Import pictures or PDF
              <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) void importImages(fs); e.target.value = ""; }} />
            </label>
          </>)}
        </div>
        <div ref={vp} data-grid-bg="" className="relative min-h-0 flex-1 select-none overflow-hidden bg-background" style={{ touchAction: "none" }}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") { touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.current.size === 2) { const [p1, p2] = [...touches.current.values()]; pinch.current = { d: Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y), cx: (p1!.x + p2!.x) / 2, cy: (p1!.y + p2!.y) / 2 }; setBox(null); setDrag(null); setWall(null); setRs(null); return; } }
            if (e.button === 1 || e.button === 2) { vp.current!.setPointerCapture(e.pointerId); panDrag.current = { sx: e.clientX, sy: e.clientY, x0: view.x, y0: view.y }; return; }
            const tg = e.target as Element;
            if (tg !== e.currentTarget && tg !== area.current && tg.getAttribute("data-grid-bg") == null && !tg.closest("svg")) return;
            const area_ = vp;
            const p = pt(e); area_.current!.setPointerCapture(e.pointerId);
            if (!live && mode === "walls") setWall({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
            else if (!live && mode === "text") addText(p.x, p.y);
            else setBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, add: e.shiftKey || e.ctrlKey || e.metaKey });
          }}
          onPointerMove={(e) => {
            if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch.current && touches.current.size === 2) { const [p1, p2] = [...touches.current.values()]; const d = Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y), cx = (p1!.x + p2!.x) / 2, cy = (p1!.y + p2!.y) / 2; const r = vp.current!.getBoundingClientRect(); const pc = pinch.current; setView((v) => ({ ...v, x: v.x + cx - pc.cx, y: v.y + cy - pc.cy })); viewRef.current = { ...viewRef.current, x: viewRef.current.x + cx - pc.cx, y: viewRef.current.y + cy - pc.cy }; zoomAt(cx - r.left, cy - r.top, viewRef.current.z * (d / pc.d)); pinch.current = { d, cx, cy }; return; }
            if (panDrag.current) { const q = panDrag.current; setView((v) => ({ ...v, x: q.x0 + e.clientX - q.sx, y: q.y0 + e.clientY - q.sy })); return; }
            const p = pt(e);
            if (rs) setRs({ ...rs, out: resizeBoxes(rs.orig, rs.corner, p.x, p.y) });
            else if (wall) setWall({ ...wall, ...snapWall(wall.x1, wall.y1, p.x, p.y) });
            else if (box) setBox({ ...box, x2: p.x, y2: p.y });
            else if (drag) { const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 0.08; let dx = p.x - drag.sx, dy = p.y - drag.sy; setDrag({ ...drag, moved, x: dx, y: dy }); }
          }}
          onPointerCancel={(e) => { touches.current.delete(e.pointerId); pinch.current = null; panDrag.current = null; }}
          onPointerUp={(e) => {
            touches.current.delete(e.pointerId);
            if (pinch.current) { if (touches.current.size < 2) pinch.current = null; return; }
            if (panDrag.current) { panDrag.current = null; return; }
            if (rs) { setGrid({ ...grid, items: grid.items.map((i) => { const m = rs.out.find((o) => o.id === i.id); return m ? { ...i, x: m.x, y: m.y, w: m.w, h: m.h, s: undefined } : i; }) }); setRs(null); return; }
            if (wall) { if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) > 0.2) setGrid({ ...grid, walls: [...grid.walls, wall] }); setWall(null); }
            if (box) {
              const [l, r, t, b] = [Math.min(box.x1, box.x2), Math.max(box.x1, box.x2), Math.min(box.y1, box.y2), Math.max(box.y1, box.y2)];
              const big = r - l > 0.1 || b - t > 0.1;
              if (live) {
                if (big) { const hit = grid.items.filter((i) => i.kind === "fixture" && i.x < r && i.x + W(i) > l && i.y < b && i.y + H(i) > t).map((i) => i.uid!); onSelect(box.add ? [...new Set([...selected, ...hit])] : hit); }
                else if (!box.add) onSelect([]);
              } else {
                const hit = big ? grid.items.filter((i) => i.x < r && i.x + W(i) > l && i.y < b && i.y + H(i) > t && !(i.kind === "image" && (i.x < l || i.x + W(i) > r))).map((i) => i.id) : [];
                setEsel(box.add ? [...new Set([...esel, ...hit])] : hit);
              }
              setBox(null);
            }
            if (drag) {
              const it = grid.items.find((i) => i.id === drag.id);
              if (drag.moved) setGrid({ ...grid, items: grid.items.map((i) => { const m = drag.group.find((g) => g.id === i.id); return m ? { ...i, x: m.x + drag.x, y: m.y + drag.y } : i; }) });
              else if (live) {
                if (it?.kind === "fixture") onToggle(it.uid!);
                else if (it?.kind === "macro") onRun({ id: it.id, key: null, action: it.macro!.action, amount: it.macro!.amount });
              } else if (it) {
                const now = Date.now();
                if (lastTap.current?.id === it.id && now - lastTap.current.t < 400) { lastTap.current = null; if (it.kind !== "image" && it.kind !== "text" && it.kind !== "table") openPicker(it); }
                else lastTap.current = { id: it.id, t: now };
              }
              setDrag(null);
            }
          }}>
        <div ref={area} className="absolute left-0 top-0 z-[2]" style={{ width: COLS * CELL, height: ROWS * CELL, transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: "0 0" }}>
          {grid.bg && <img src={grid.bg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ transform: `translate(${grid.bgT?.x ?? 0}%, ${grid.bgT?.y ?? 0}%) scale(${grid.bgT?.scale ?? 1})`, transformOrigin: "center", filter: grid.bgT?.invert ? "invert(1)" : undefined }} />}
          <svg className="absolute left-0 top-0 z-[5] overflow-visible" width={1} height={1} style={{ pointerEvents: "none" }}>
            {[...grid.walls, ...(wall ? [wall] : [])].map((w, i) => (
              <line key={i} x1={w.x1 * CELL} y1={w.y1 * CELL} x2={w.x2 * CELL} y2={w.y2 * CELL} strokeWidth={8} strokeLinecap="round" style={{ pointerEvents: !live && mode === "walls" && i < grid.walls.length ? "auto" : "none" }}
                className={`stroke-foreground/70 ${!live && mode === "walls" ? "cursor-pointer hover:stroke-destructive" : ""}`}
                onPointerDown={(e) => { if (live || mode !== "walls" || i >= grid.walls.length) return; e.stopPropagation(); setGrid({ ...grid, walls: grid.walls.filter((_, k) => k !== i) }); }} />
            ))}
          </svg>
          {grid.items.map((it) => {
            const gm = drag?.moved ? drag.group.find((g) => g.id === it.id) : undefined;
            const rr = rs?.out.find((o) => o.id === it.id);
            const pos = rr ?? (gm && drag ? { x: gm.x + drag.x, y: gm.y + drag.y, w: W(it), h: H(it) } : { x: it.x, y: it.y, w: W(it), h: H(it) });
            const f = it.kind === "fixture" ? fixtures.find((x) => x.uid === it.uid) : undefined;
            const n = f ? fixtures.indexOf(f) + 1 : 0;
            const isSel = live ? !!f && selected.includes(f.uid) : esel.includes(it.id);
            const back = it.kind === "image" || it.kind === "table";
            if (live && it.kind === "empty") return null;
            return (
              <div key={it.id} role="button" tabIndex={0} aria-label={f ? `Select fixture ${n}, ${f.name}` : it.macro ? `Run ${macroLabel(it.macro)}` : it.kind === "text" ? "Text label" : it.kind === "image" ? "Picture" : it.kind === "table" ? "Table" : "Empty box"} aria-pressed={f ? isSel : undefined}
                className={`absolute flex flex-col overflow-hidden ${it.kind === "image" ? "" : "rounded-lg border p-1"} text-[10px] ${(!live && mode === "walls") || (live && back) ? "pointer-events-none" : live ? "cursor-pointer active:scale-[0.97]" : "cursor-grab"} ${!live && mode === "walls" ? "opacity-60" : ""} ${isSel ? "border-primary ring-2 ring-primary" : it.kind === "empty" ? "border-dashed border-border" : it.kind === "text" ? "border-transparent" : it.kind === "table" ? "border-2 border-border" : "border-border"} ${it.kind === "text" || it.kind === "table" ? "bg-transparent" : f ? "bg-card" : "bg-surface-elevated"} ${gm || rr ? "z-30 shadow-lg" : back ? "z-0" : "z-10"}`}
                style={{ left: pos.x * CELL, top: pos.y * CELL, width: pos.w * CELL, height: pos.h * CELL, ...(it.kind === "table" ? (it.color ? { borderColor: it.color } : {}) : f ? (it.color ? { borderColor: it.color, borderWidth: 2 } : {}) : pal(it.color)) }}
                onPointerDown={(e) => { if (!live && mode !== "select") return; e.stopPropagation(); area.current!.setPointerCapture(e.pointerId); const p = pt(e); if (live) { setDrag({ id: it.id, x: 0, y: 0, sx: p.x, sy: p.y, moved: false, group: [] }); return; } const sel = esel.includes(it.id) ? esel : e.shiftKey ? [...esel, it.id] : [it.id]; setEsel(sel); setDrag({ id: it.id, x: 0, y: 0, sx: p.x, sy: p.y, moved: false, group: groupFor(it, sel) });}}>
                {it.kind === "image" ? (
                  <img src={it.src} alt="" draggable={false} className="pointer-events-none h-full w-full object-fill" style={{ opacity: it.opacity ?? 1, filter: it.invert ? "invert(1)" : undefined }} />
                ) : it.kind === "table" ? (<>
                  <div className="h-[30px] shrink-0 truncate px-1 text-xs font-bold uppercase text-muted-foreground">{it.text}</div>
                  {!live && <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `repeat(${it.cols ?? 4}, 1fr)`, gridTemplateRows: `repeat(${it.rows ?? 3}, 1fr)` }}>
                    {Array.from({ length: (it.cols ?? 4) * (it.rows ?? 3) }, (_, k) => <div key={k} className="border border-dashed border-border/60" />)}
                  </div>}
                </>) : f ? (<>
                  <span className="font-mono font-semibold text-foreground/80">#{n}</span>
                  {(() => { const px = pixelsOf?.(f); if (!px?.cells || px.cells.length < 2) return <div className="my-0.5 min-h-0 flex-1 rounded" style={{ background: colorOf(f) }} />;
                    const wide = pos.w >= pos.h, [c, r] = wide === px.cols >= px.rows ? [px.cols, px.rows] : [px.rows, px.cols];
                    return <div className="my-0.5 grid min-h-0 flex-1 gap-px overflow-hidden rounded" style={{ gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)` }}>
                      {px.cells.map((col, k) => <div key={k} style={{ background: col }} />)}</div>; })()}
                  <div className="flex justify-between gap-1"><span className="truncate">{f.name}</span><span className="font-mono">{Math.round(f.intensity * 100)}%</span></div>
                </>) : it.macro ? (
                  <div className="flex flex-1 items-center justify-center text-center text-[11px] font-bold leading-tight text-foreground">{macroLabel(it.macro)}</div>
                ) : it.kind === "text" ? (
                  <div className="flex flex-1 items-center justify-center overflow-hidden text-center text-xs font-bold leading-tight text-foreground">{it.text || "Text…"}</div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground"><Plus className="h-4 w-4" /></div>
                )}
              </div>
            );
          })}
          {bbox && mode === "select" && (
            <div className="pointer-events-none absolute z-40 border border-dashed border-primary" style={{ left: bbox.l * CELL - 3, top: bbox.t * CELL - 3, width: (bbox.r - bbox.l) * CELL + 6, height: (bbox.b - bbox.t) * CELL + 6 }}>
              {(["tl", "tr", "bl", "br"] as Corner[]).map((c) => (
                <div key={c} aria-label={`Resize ${c}`} className="pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-primary bg-background"
                  style={{ left: c[1] === "l" ? -8 : undefined, right: c[1] === "r" ? -8 : undefined, top: c[0] === "t" ? -8 : undefined, bottom: c[0] === "b" ? -8 : undefined, cursor: c === "tl" || c === "br" ? "nwse-resize" : "nesw-resize" }}
                  onPointerDown={(e) => { e.stopPropagation(); area.current!.setPointerCapture(e.pointerId); const orig = grid.items.filter((i) => esel.includes(i.id)).map((i) => ({ id: i.id, x: i.x, y: i.y, w: W(i), h: H(i) })); setRs({ corner: c, orig, out: orig }); }} />
              ))}
            </div>
          )}
          {box && <div className="pointer-events-none absolute z-40 border border-primary bg-primary/10" style={{ left: Math.min(box.x1, box.x2) * CELL, top: Math.min(box.y1, box.y2) * CELL, width: Math.abs(box.x2 - box.x1) * CELL, height: Math.abs(box.y2 - box.y1) * CELL }} />}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: `${CELL * view.z}px ${CELL * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }} />
        </div>
      </div>
      <aside aria-label={live ? "Fixture controls" : "Grid editor"} className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
        {live ? controls : editPanel}
      </aside>

      <Dialog open={!!pick} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
          <DialogHeader><DialogTitle>Assign box</DialogTitle></DialogHeader>
          {pick && (<div className="space-y-4">
            <ColourRow value={pick.color} onPick={(c) => patch(pick.id, { color: c || undefined })} />
            <section>
              <h3 className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">Fixtures</h3>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {fixtures.map((f, i) => { const on = pick.kind === "fixture" && pick.uid === f.uid; const taken = placed.has(f.uid) && !on; return (
                  <button key={f.uid} disabled={taken} onClick={() => { patch(pick.id, { kind: "fixture", uid: f.uid, macro: undefined }); setPicker(null); }}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${on ? "border-primary bg-primary/15" : "border-border bg-surface-elevated"} disabled:opacity-40`}><span className="font-mono font-bold">#{i + 1}</span> <span className="truncate">{f.name}</span></button>); })}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-muted-foreground">Macros</h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {sortedActions.map((a) => <button key={a.id} onClick={() => { setAction(a.id); setAmount(a.def ?? 0); }} className={`rounded-md border px-2 py-1.5 text-left text-xs font-semibold ${action === a.id ? "border-primary bg-primary/15" : "border-border bg-surface-elevated"}`}>{a.label}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {meta?.unit && <label className="flex items-center gap-2 text-xs">Amount<input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-20 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono" />{meta.unit}</label>}
                <input aria-label="Button name" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs text-foreground" />
                <Button size="sm" onClick={() => { patch(pick.id, { kind: "macro", uid: undefined, macro: { action, amount, label: label.trim() } }); setPicker(null); }}>Set macro</Button>
              </div>
            </section>
            {pick.kind !== "empty" && <Button variant="ghost" size="sm" onClick={() => { patch(pick.id, { kind: "empty", uid: undefined, macro: undefined }); setPicker(null); }}>Clear box</Button>}
          </div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColourRow({ value, onPick }: { value: string | undefined; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Colour</span>
      {COLORS.map((c) => <button key={c || "none"} aria-label={c ? `Colour ${c}` : "No colour"} onClick={() => onPick(c)} className={`h-6 w-6 rounded-full border-2 ${(value ?? "") === c ? "border-primary" : "border-border"} ${c ? "" : "bg-surface-elevated"}`} style={c ? { background: c } : undefined} />)}
      <input type="color" aria-label="Custom colour" value={value || "#3b82f6"} onChange={(e) => onPick(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent" />
    </div>
  );
}
