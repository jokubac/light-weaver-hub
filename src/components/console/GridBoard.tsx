import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MACRO_ACTIONS, type Macro, type MacroAction } from "@/lib/macros";
import type { PatchedFixture } from "@/lib/dmx";
import { Move, PenLine, Trash2, X, Plus } from "lucide-react";

/** Free layout of fixture squares, user-programmed macro buttons and drawn walls (cell units). */
export interface GridItem { id: string; kind: "fixture" | "macro"; uid?: string; macro?: { action: MacroAction; amount: number; label: string }; x: number; y: number }
export interface GridLayout { items: GridItem[]; walls: { x1: number; y1: number; x2: number; y2: number }[] }
export const emptyGrid = (): GridLayout => ({ items: [], walls: [] });

const CELL = 76, COLS = 24, ROWS = 16;
const nid = () => Math.random().toString(36).slice(2, 10);

export function GridBoard({ grid, setGrid, fixtures, selected, onToggle, onRun, colorOf }: {
  grid: GridLayout; setGrid: (g: GridLayout) => void; fixtures: PatchedFixture[]; selected: string[];
  onToggle: (uid: string) => void; onRun: (m: Macro) => void; colorOf: (f: PatchedFixture) => string;
}) {
  const [mode, setMode] = useState<"use" | "move" | "walls">("use");
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [wall, setWall] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [action, setAction] = useState<MacroAction>("cct_up");
  const [amount, setAmount] = useState(100);
  const [label, setLabel] = useState("");
  const area = useRef<HTMLDivElement>(null);

  const placed = new Set(grid.items.filter((i) => i.kind === "fixture").map((i) => i.uid));
  const free = () => { const used = new Set(grid.items.map((i) => `${i.x},${i.y}`)); for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!used.has(`${x},${y}`)) return { x, y }; return { x: 0, y: 0 }; };
  const add = (it: Omit<GridItem, "id" | "x" | "y">) => setGrid({ ...grid, items: [...grid.items, { ...it, id: nid(), ...free() }] });
  const remove = (id: string) => setGrid({ ...grid, items: grid.items.filter((i) => i.id !== id) });
  const pt = (e: React.PointerEvent, snap: "cell" | "corner") => {
    const r = area.current!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / CELL, fy = (e.clientY - r.top) / CELL;
    return snap === "cell" ? { x: Math.max(0, Math.min(COLS - 1, Math.floor(fx))), y: Math.max(0, Math.min(ROWS - 1, Math.floor(fy))) } : { x: Math.round(fx), y: Math.round(fy) };
  };
  const meta = MACRO_ACTIONS.find((a) => a.id === action);
  const macroLabel = (m: { action: MacroAction; amount: number; label: string }) => {
    if (m.label) return m.label;
    const a = MACRO_ACTIONS.find((x) => x.id === m.action);
    return a?.unit ? `${a.label} ${m.amount}${a.unit}` : (a?.label ?? m.action);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside aria-label="Grid library" className="max-h-[40vh] w-full shrink-0 space-y-4 overflow-auto border-b border-border bg-surface p-3 lg:max-h-none lg:w-64 lg:border-b-0 lg:border-r">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-elevated p-1">
          {([["use", "Use"], ["move", "Move"], ["walls", "Walls"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-md py-2 text-xs font-bold ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{mode === "use" ? "Tap lights to select, tap buttons to run them." : mode === "move" ? "Drag squares to place them. × removes." : "Drag between grid points to draw a wall. Tap a wall to delete it."}</p>
        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Lights</h3>
          <Button variant="secondary" size="sm" className="w-full" disabled={fixtures.every((f) => placed.has(f.uid))}
            onClick={() => { let g = grid; for (const f of fixtures) if (!placed.has(f.uid)) { const used = new Set(g.items.map((i) => `${i.x},${i.y}`)); let p = { x: 0, y: 0 }; outer: for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!used.has(`${x},${y}`)) { p = { x, y }; break outer; } g = { ...g, items: [...g.items, { id: nid(), kind: "fixture", uid: f.uid, ...p }] }; } setGrid(g); }}>Add all lights</Button>
          {fixtures.map((f, i) => (
            <button key={f.uid} disabled={placed.has(f.uid)} onClick={() => add({ kind: "fixture", uid: f.uid })}
              className="flex w-full items-center gap-2 rounded-md bg-surface-elevated px-2 py-1.5 text-left text-xs disabled:opacity-40">
              <span className="font-mono text-muted-foreground">#{i + 1}</span><span className="flex-1 truncate">{f.name}</span>{!placed.has(f.uid) && <Plus className="h-3.5 w-3.5" />}
            </button>
          ))}
        </section>
        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">Macro button</h3>
          <select aria-label="Macro function" value={action} onChange={(e) => { const a = e.target.value as MacroAction; setAction(a); setAmount(MACRO_ACTIONS.find((x) => x.id === a)?.def ?? 0); }}
            className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs">
            {MACRO_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          {meta?.unit && (
            <label className="flex items-center gap-2 text-xs">Amount
              <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-20 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono" />{meta.unit}
            </label>
          )}
          <input aria-label="Button name" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs" />
          <Button size="sm" className="w-full" onClick={() => { add({ kind: "macro", macro: { action, amount, label: label.trim() } }); setLabel(""); }}><Plus />Add button</Button>
        </section>
      </aside>

      <div className="min-h-0 flex-1 overflow-auto bg-background p-3">
        <div ref={area} className="relative select-none" style={{ width: COLS * CELL, height: ROWS * CELL, touchAction: mode === "use" ? "auto" : "none",
          backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)", backgroundSize: `${CELL}px ${CELL}px` }}
          onPointerDown={(e) => { if (mode !== "walls" || (e.target as HTMLElement).dataset["wall"]) return; const p = pt(e, "corner"); setWall({ x1: p.x, y1: p.y, x2: p.x, y2: p.y }); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (wall) { const p = pt(e, "corner"); setWall({ ...wall, x2: p.x, y2: p.y }); } else if (drag) { const p = pt(e, "cell"); setDrag({ ...drag, ...p }); } }}
          onPointerUp={() => {
            if (wall) { if (wall.x1 !== wall.x2 || wall.y1 !== wall.y2) setGrid({ ...grid, walls: [...grid.walls, wall] }); setWall(null); }
            if (drag) { const taken = grid.items.some((i) => i.id !== drag.id && i.x === drag.x && i.y === drag.y); if (!taken) setGrid({ ...grid, items: grid.items.map((i) => i.id === drag.id ? { ...i, x: drag.x, y: drag.y } : i) }); setDrag(null); }
          }}>
          <svg className="pointer-events-none absolute inset-0 z-20" width={COLS * CELL} height={ROWS * CELL}>
            {[...grid.walls, ...(wall ? [wall] : [])].map((w, i) => (
              <line key={i} data-wall="1" x1={w.x1 * CELL} y1={w.y1 * CELL} x2={w.x2 * CELL} y2={w.y2 * CELL} strokeWidth={8} strokeLinecap="round"
                className={`stroke-foreground/70 ${mode === "walls" && i < grid.walls.length ? "pointer-events-auto cursor-pointer hover:stroke-destructive" : ""}`}
                onPointerDown={(e) => { e.stopPropagation(); if (mode === "walls" && i < grid.walls.length) setGrid({ ...grid, walls: grid.walls.filter((_, k) => k !== i) }); }} />
            ))}
          </svg>
          {grid.items.map((it) => {
            const pos = drag?.id === it.id ? drag : it;
            const f = it.kind === "fixture" ? fixtures.find((x) => x.uid === it.uid) : undefined;
            if (it.kind === "fixture" && !f) return null;
            const n = f ? fixtures.indexOf(f) + 1 : 0;
            const isSel = !!f && selected.includes(f.uid);
            return (
              <div key={it.id} role="button" tabIndex={0} aria-label={f ? `Select fixture ${n}, ${f.name}` : `Run ${macroLabel(it.macro!)}`} aria-pressed={f ? isSel : undefined}
                className={`absolute z-10 flex flex-col overflow-hidden rounded-lg border p-1 text-[10px] transition-[box-shadow] ${mode === "move" ? "cursor-move" : "cursor-pointer active:scale-95"} ${isSel ? "border-primary ring-2 ring-primary" : "border-border"} ${f ? "bg-card" : "bg-surface-elevated"}`}
                style={{ left: pos.x * CELL + 3, top: pos.y * CELL + 3, width: CELL - 6, height: CELL - 6 }}
                onPointerDown={(e) => { if (mode === "move") { e.stopPropagation(); (area.current as HTMLElement).setPointerCapture(e.pointerId); setDrag({ id: it.id, x: it.x, y: it.y }); } }}
                onClick={() => { if (mode !== "use") return; if (f) onToggle(f.uid); else if (it.macro) onRun({ id: it.id, key: null, action: it.macro.action, amount: it.macro.amount }); }}>
                {mode === "move" && <button aria-label="Remove from grid" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(it.id); }} className="absolute right-0.5 top-0.5 z-10 rounded bg-destructive p-0.5 text-destructive-foreground"><X className="h-3 w-3" /></button>}
                {f ? (<>
                  <span className="font-mono font-semibold text-foreground/80">#{n}</span>
                  <div className="my-0.5 min-h-0 flex-1 rounded" style={{ background: colorOf(f) }} />
                  <div className="flex justify-between gap-1"><span className="truncate">{f.name}</span><span className="font-mono">{Math.round(f.intensity * 100)}%</span></div>
                </>) : (
                  <div className="flex flex-1 items-center justify-center text-center text-[11px] font-bold leading-tight">{macroLabel(it.macro!)}</div>
                )}
              </div>
            );
          })}
          {mode === "walls" && <PenLine className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground" />}
          {mode === "move" && <Move className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground" />}
        </div>
        {grid.walls.length > 0 && mode === "walls" && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setGrid({ ...grid, walls: [] })}><Trash2 />Clear walls</Button>}
      </div>
    </div>
  );
}
