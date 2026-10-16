import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MACRO_ACTIONS, type Macro, type MacroAction } from "@/lib/macros";
import type { PatchedFixture } from "@/lib/dmx";
import { MoreHorizontal, PenLine, Plus, Trash2, MousePointer2 } from "lucide-react";

/** Free layout (cell units, fractional) of squares — empty, fixture or user macro — plus drawn walls. */
export interface GridItem { id: string; kind: "empty" | "fixture" | "macro"; uid?: string | undefined; macro?: { action: MacroAction; amount: number; label: string } | undefined; x: number; y: number }
export interface GridLayout { items: GridItem[]; walls: { x1: number; y1: number; x2: number; y2: number }[]; size?: number }
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

export type Arrange = "hcenter" | "vcenter" | "hspace" | "vspace" | "row" | "column" | "grid" | "circle" | "triangle" | "rotate";

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
    case "grid": { const c = Math.ceil(Math.sqrt(n)); return fit(byY.map((p, i) => ({ ...p, x: minX + (i % c) * step, y: minY + Math.floor(i / c) * step }))); }
    case "triangle": {
      let rows = 1; while ((rows * (rows + 1)) / 2 < n) rows++;
      let i = 0; const out: { id: string; x: number; y: number }[] = [];
      for (let r = 0; r < rows && i < n; r++) { const k = Math.min(r + 1, n - i); for (let j = 0; j < k; j++, i++) out.push({ ...byY[i]!, x: minX + ((rows - k) * step) / 2 + j * step, y: minY + r * step }); }
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

const ICON: Record<Arrange, React.ReactNode> = {
  hcenter: <><rect x="2" y="9" width="5" height="6" /><rect x="9.5" y="9" width="5" height="6" /><rect x="17" y="9" width="5" height="6" /><line x1="1" y1="12" x2="23" y2="12" /></>,
  vcenter: <><rect x="9" y="2" width="6" height="5" /><rect x="9" y="9.5" width="6" height="5" /><rect x="9" y="17" width="6" height="5" /><line x1="12" y1="1" x2="12" y2="23" /></>,
  hspace: <><rect x="2" y="8" width="4" height="8" /><rect x="10" y="8" width="4" height="8" /><rect x="18" y="8" width="4" height="8" /></>,
  vspace: <><rect x="8" y="2" width="8" height="4" /><rect x="8" y="10" width="8" height="4" /><rect x="8" y="18" width="8" height="4" /></>,
  row: <><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="17" y="9" width="6" height="6" /></>,
  column: <><rect x="9" y="1" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="9" y="17" width="6" height="6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  triangle: <><rect x="9.5" y="3" width="5" height="5" /><rect x="5" y="10" width="5" height="5" /><rect x="14" y="10" width="5" height="5" /><rect x="1" y="17" width="5" height="5" /><rect x="9.5" y="17" width="5" height="5" /><rect x="18" y="17" width="5" height="5" /></>,
  circle: <>{[0, 1, 2, 3, 4, 5].map((i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return <rect key={i} x={10 + 8 * Math.cos(a)} y={10 + 8 * Math.sin(a)} width="4" height="4" />; })}</>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><polyline points="20 3 20 7 16 7" /></>,
};
const ARRANGE: [Arrange, string][] = [["hcenter", "Middle ↔"], ["vcenter", "Centre ↕"], ["hspace", "Space ↔"], ["vspace", "Space ↕"], ["row", "Line"], ["column", "Column"], ["grid", "Grid"], ["triangle", "Triangle"], ["circle", "Circle"], ["rotate", "Rotate ↻"]];
const LIVE: Arrange[] = ["hspace", "vspace", "row", "column", "grid", "triangle", "circle", "hcenter", "vcenter"];

export function GridBoard({ grid, setGrid, fixtures, selected, onToggle, onSelect, onRun, colorOf }: {
  grid: GridLayout; setGrid: (g: GridLayout) => void; fixtures: PatchedFixture[]; selected: string[];
  onToggle: (uid: string) => void; onSelect: (uids: string[]) => void; onRun: (m: Macro) => void; colorOf: (f: PatchedFixture) => string;
}) {
  const [mode, setMode] = useState<"select" | "walls">("select");
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number; x: number; y: number; sx: number; sy: number; moved: boolean; group: { id: string; x: number; y: number }[] } | null>(null);
  const [wall, setWall] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number; add: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [action, setAction] = useState<MacroAction>("cct_up");
  const [amount, setAmount] = useState(100);
  const [label, setLabel] = useState("");
  const [gap, setGap] = useState(0.2);
  const [last, setLast] = useState<Arrange | null>(null);
  const sz = grid.size ?? SIZE;
  const selItems = grid.items.filter((i) => i.kind === "fixture" && selected.includes(i.uid!));
  const apply = (how: Arrange, g: number, size: number) => { const r = arrange(selItems, how, g, size); setGrid({ ...grid, size, items: grid.items.map((i) => { const m = r.find((x) => x.id === i.id); return m ? { ...i, x: m.x, y: m.y } : i; }) }); };
  const doArrange = (how: Arrange) => { apply(how, gap, sz); setLast(LIVE.includes(how) ? how : null); };
  const onGap = (g: number) => { setGap(g); if (last && selItems.length > 1) apply(last, g, sz); };
  const onSize = (v: number) => { if (last && selItems.length > 1) apply(last, gap, v); else setGrid({ ...grid, size: v }); };
  const area = useRef<HTMLDivElement>(null);

  const placed = new Set(grid.items.filter((i) => i.kind === "fixture").map((i) => i.uid));
  const freeSpot = (items: GridItem[]) => { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!items.some((i) => Math.abs(i.x - x) < sz && Math.abs(i.y - y) < sz)) return { x, y }; return { x: 0, y: 0 }; };
  const pt = (e: React.PointerEvent) => { const r = area.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / CELL, y: (e.clientY - r.top) / CELL }; };
  const patch = (id: string, p: Partial<GridItem>) => setGrid({ ...grid, items: grid.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const edit = grid.items.find((i) => i.id === editing);
  const meta = MACRO_ACTIONS.find((a) => a.id === action);
  const macroLabel = (m: { action: MacroAction; amount: number; label: string }) => {
    if (m.label) return m.label;
    const a = MACRO_ACTIONS.find((x) => x.id === m.action);
    return a?.unit ? `${a.label} ${m.amount}${a.unit}` : (a?.label ?? m.action);
  };
  const addSquare = () => { const id = nid(); setGrid({ ...grid, items: [...grid.items, { id, kind: "empty", ...freeSpot(grid.items) }] }); setEditing(id); };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <aside aria-label="Grid library" className="max-h-[40vh] w-full shrink-0 space-y-4 overflow-auto border-b border-border bg-surface p-3 lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-elevated p-1">
          <button onClick={() => setMode("select")} aria-pressed={mode === "select"} className={`flex items-center justify-center gap-1 rounded-md py-2 text-xs font-bold ${mode === "select" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><MousePointer2 className="h-3.5 w-3.5" />Select</button>
          <button onClick={() => setMode("walls")} aria-pressed={mode === "walls"} className={`flex items-center justify-center gap-1 rounded-md py-2 text-xs font-bold ${mode === "walls" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><PenLine className="h-3.5 w-3.5" />Walls</button>
        </div>
        <p className="text-[11px] text-muted-foreground">{mode === "select" ? "Drag squares anywhere — dragging a selected light moves all selected lights. Tap to select or run. Drag on empty space to box-select lights. ⋯ edits a square." : "Drag to draw a wall at any angle — it snaps straight or 45° when close. Tap a wall to delete it."}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" onClick={addSquare}><Plus />Square</Button>
          <Button variant="secondary" size="sm" disabled={fixtures.every((f) => placed.has(f.uid))}
            onClick={() => { let items = grid.items; for (const f of fixtures) if (!placed.has(f.uid)) items = [...items, { id: nid(), kind: "fixture", uid: f.uid, ...freeSpot(items) }]; setGrid({ ...grid, items }); }}>All lights</Button>
        </div>

        {selItems.length > 1 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Arrange {selItems.length} selected</h3>
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
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Fixture size
          <input type="range" min={0.4} max={2} step={0.02} value={sz} onChange={(e) => onSize(+e.target.value)} className="flex-1" />
          <span className="w-8 text-right font-mono">{Math.round(sz * 100)}%</span>
        </label>
        {edit && (
          <section className="space-y-2 rounded-lg border border-primary/50 p-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase">Edit square</h3>
              <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground">Done</button>
            </div>
            <label className="block text-[11px] text-muted-foreground">Fixture
              <select aria-label="Assign fixture" value={edit.kind === "fixture" ? edit.uid : ""} onChange={(e) => e.target.value ? patch(edit.id, { kind: "fixture", uid: e.target.value, macro: undefined }) : patch(edit.id, { kind: "empty", uid: undefined })}
                className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs text-foreground">
                <option value="">—</option>
                {fixtures.map((f, i) => <option key={f.uid} value={f.uid} disabled={placed.has(f.uid) && edit.uid !== f.uid}>#{i + 1} {f.name}</option>)}
              </select>
            </label>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">Macro
              <select aria-label="Macro function" value={action} onChange={(e) => { const a = e.target.value as MacroAction; setAction(a); setAmount(MACRO_ACTIONS.find((x) => x.id === a)?.def ?? 0); }}
                className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs text-foreground">
                {MACRO_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {meta?.unit && (
                <label className="flex items-center gap-2 text-xs text-foreground">Amount
                  <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-20 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono" />{meta.unit}
                </label>
              )}
              <input aria-label="Button name" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs text-foreground" />
              <Button size="sm" className="w-full" onClick={() => { patch(edit.id, { kind: "macro", uid: undefined, macro: { action, amount, label: label.trim() } }); setLabel(""); }}>Set macro</Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => { setGrid({ ...grid, items: grid.items.filter((i) => i.id !== edit.id) }); setEditing(null); }}><Trash2 />Remove square</Button>
          </section>
        )}
        {grid.walls.length > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setGrid({ ...grid, walls: [] })}><Trash2 />Clear walls</Button>}
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-background p-3">
        <div ref={area} className="relative select-none" style={{ width: COLS * CELL, height: ROWS * CELL, touchAction: "none",
          backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: `${CELL}px ${CELL}px` }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget && !(e.target as Element).closest("svg")) return;
            const p = pt(e); area.current!.setPointerCapture(e.pointerId);
            if (mode === "walls") setWall({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
            else setBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, add: e.shiftKey || e.ctrlKey || e.metaKey });
          }}
          onPointerMove={(e) => {
            const p = pt(e);
            if (wall) setWall({ ...wall, ...snapWall(wall.x1, wall.y1, p.x, p.y) });
            else if (box) setBox({ ...box, x2: p.x, y2: p.y });
            else if (drag) { const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 0.08; const g0 = drag.group; let dx = p.x - drag.sx, dy = p.y - drag.sy; for (const m of g0) { dx = Math.max(-m.x, Math.min(COLS - sz - m.x, dx)); dy = Math.max(-m.y, Math.min(ROWS - sz - m.y, dy)); } setDrag({ ...drag, moved, x: dx, y: dy }); }
          }}
          onPointerUp={() => {
            if (wall) { if (Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) > 0.2) setGrid({ ...grid, walls: [...grid.walls, wall] }); setWall(null); }
            if (box) {
              const [l, r, t, b] = [Math.min(box.x1, box.x2), Math.max(box.x1, box.x2), Math.min(box.y1, box.y2), Math.max(box.y1, box.y2)];
              if (r - l > 0.1 || b - t > 0.1) {
                const hit = grid.items.filter((i) => i.kind === "fixture" && i.x < r && i.x + sz > l && i.y < b && i.y + sz > t).map((i) => i.uid!);
                onSelect(box.add ? [...new Set([...selected, ...hit])] : hit);
              }
              setBox(null);
            }
            if (drag) {
              const it = grid.items.find((i) => i.id === drag.id);
              if (drag.moved) setGrid({ ...grid, items: grid.items.map((i) => { const m = drag.group.find((g) => g.id === i.id); return m ? { ...i, x: m.x + drag.x, y: m.y + drag.y } : i; }) });
              else if (it?.kind === "fixture") onToggle(it.uid!);
              else if (it?.kind === "macro") onRun({ id: it.id, key: null, action: it.macro!.action, amount: it.macro!.amount });
              else if (it) setEditing(it.id);
              setDrag(null);
            }
          }}>
          <svg className="absolute inset-0" width={COLS * CELL} height={ROWS * CELL}>
            {[...grid.walls, ...(wall ? [wall] : [])].map((w, i) => (
              <line key={i} x1={w.x1 * CELL} y1={w.y1 * CELL} x2={w.x2 * CELL} y2={w.y2 * CELL} strokeWidth={8} strokeLinecap="round"
                className={`stroke-foreground/70 ${mode === "walls" && i < grid.walls.length ? "cursor-pointer hover:stroke-destructive" : "pointer-events-none"}`}
                onPointerDown={(e) => { if (mode !== "walls" || i >= grid.walls.length) return; e.stopPropagation(); setGrid({ ...grid, walls: grid.walls.filter((_, k) => k !== i) }); }} />
            ))}
          </svg>
          {grid.items.map((it) => {
            const gm = drag?.moved ? drag.group.find((g) => g.id === it.id) : undefined;
            const pos = gm && drag ? { x: gm.x + drag.x, y: gm.y + drag.y } : it;
            const f = it.kind === "fixture" ? fixtures.find((x) => x.uid === it.uid) : undefined;
            const n = f ? fixtures.indexOf(f) + 1 : 0;
            const isSel = !!f && selected.includes(f.uid);
            return (
              <div key={it.id} role="button" tabIndex={0} aria-label={f ? `Select fixture ${n}, ${f.name}` : it.macro ? `Run ${macroLabel(it.macro)}` : "Empty square"} aria-pressed={f ? isSel : undefined}
                className={`absolute flex flex-col overflow-hidden rounded-lg border p-1 text-[10px] ${mode === "walls" ? "pointer-events-none opacity-60" : "cursor-grab"} ${isSel ? "border-primary ring-2 ring-primary" : editing === it.id ? "border-primary/70 border-dashed" : it.kind === "empty" ? "border-dashed border-border" : "border-border"} ${f ? "bg-card" : "bg-surface-elevated"} ${gm ? "z-30 shadow-lg" : "z-10"}`}
                style={{ left: pos.x * CELL, top: pos.y * CELL, width: sz * CELL, height: sz * CELL }}
                onPointerDown={(e) => { if (mode !== "select") return; e.stopPropagation(); area.current!.setPointerCapture(e.pointerId); const p = pt(e); const inSel = it.kind === "fixture" && selected.includes(it.uid!); const group = (inSel ? grid.items.filter((i) => i.id === it.id || (i.kind === "fixture" && selected.includes(i.uid!))) : [it]).map((i) => ({ id: i.id, x: i.x, y: i.y })); setDrag({ id: it.id, ox: p.x - it.x, oy: p.y - it.y, x: 0, y: 0, sx: p.x, sy: p.y, moved: false, group }); }}>
                <button aria-label="Edit square" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setEditing(it.id); if (it.macro) { setAction(it.macro.action); setAmount(it.macro.amount); setLabel(it.macro.label); } }}
                  className="absolute right-0.5 top-0.5 z-10 rounded bg-surface/80 p-0.5 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-3 w-3" /></button>
                {f ? (<>
                  <span className="font-mono font-semibold text-foreground/80">#{n}</span>
                  <div className="my-0.5 min-h-0 flex-1 rounded" style={{ background: colorOf(f) }} />
                  <div className="flex justify-between gap-1"><span className="truncate">{f.name}</span><span className="font-mono">{Math.round(f.intensity * 100)}%</span></div>
                </>) : it.macro ? (
                  <div className="flex flex-1 items-center justify-center text-center text-[11px] font-bold leading-tight">{macroLabel(it.macro)}</div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground"><Plus className="h-4 w-4" /></div>
                )}
              </div>
            );
          })}
          {box && <div className="pointer-events-none absolute z-40 border border-primary bg-primary/10" style={{ left: Math.min(box.x1, box.x2) * CELL, top: Math.min(box.y1, box.y2) * CELL, width: Math.abs(box.x2 - box.x1) * CELL, height: Math.abs(box.y2 - box.y1) * CELL }} />}
        </div>
      </div>
    </div>
  );
}
