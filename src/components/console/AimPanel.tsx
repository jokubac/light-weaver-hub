// Aim panel for the PLOT: points selected moving heads at a place on the plot and lets
// them wander around that aim. Positions come from the plot layout; the values written
// are ordinary Pan/Tilt (plus a movement spec), so everything else keeps working.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { aimGrid, aimTargets, AIM_SHAPES, PAN_RANGES, TILT_RANGES, panTiltFor, type AimMove, type AimShape, type AimTarget } from "@/lib/aim";
import { beamChannels } from "./BeamControls";
import type { BeamAttr, PatchedFixture } from "@/lib/dmx";
import type { GridItem, GridLayout } from "./GridBoard";
import { t as tr } from "@/lib/i18n";

const chip = (on: boolean) => `rounded px-2 py-1 text-[10px] font-semibold transition active:scale-95 ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
const num = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => (
  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">{label}
    <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="w-14 rounded border border-border bg-background px-1 py-0.5 text-foreground" />
  </label>
);

/** Lights that can actually be pointed: their mode carries a Pan or a Tilt channel. */
export const aimableHeads = (fs: PatchedFixture[]) =>
  fs.filter((f) => { const c = beamChannels(f); return c.has("Pan") || c.has("Tilt"); });

export function AimPanel({ grid, setGrid, fixtures, selected, onAim, onMove }: {
  grid: GridLayout; setGrid: (g: GridLayout) => void;
  fixtures: PatchedFixture[]; selected: string[];
  onAim: (aims: { uid: string; beam: Partial<Record<BeamAttr, number>> }[]) => void;
  onMove: (uids: string[], move: AimMove | null) => void;
}) {
  const heads = aimableHeads(fixtures.filter((f) => selected.includes(f.uid)));
  const [targetId, setTargetId] = useState<string>("");
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(heads.length || 1);
  const [spread, setSpread] = useState(1);
  const [lampH, setLampH] = useState(3);
  const [targetH, setTargetH] = useState(0);
  const [rot, setRot] = useState(90);
  const [panRange, setPanRange] = useState(540);
  const [tiltRange, setTiltRange] = useState(270);
  const [shape, setShape] = useState<AimShape | "off">("off");
  const [rate, setRate] = useState(0.2);
  const [size, setSize] = useState(0.4);

  if (heads.length === 0) return null;
  const metres = grid.metres ?? 1;
  const nameOf = (uid: string) => fixtures.find((f) => f.uid === uid)?.name ?? uid;
  const targets: AimTarget[] = aimTargets(grid.items as GridItem[], nameOf, metres, targetH);
  const target = targets.find((x) => x.id === targetId) ?? null;
  const uids = heads.map((f) => f.uid);
  const move: AimMove | null = shape === "off" ? null : { shape, rate, size };

  const aim = () => {
    if (!target) return;
    // one shared aim, or a spread grid of positions the lights share in reading order
    const spots = rows * cols > 1 ? aimGrid(target, rows, cols, spread, rot) : [target];
    onAim(heads.map((f, i) => {
      const it = grid.items.find((g) => g.kind === "fixture" && g.uid === f.uid);
      const from = { x: (it?.x ?? 0) * metres, y: (it?.y ?? 0) * metres, h: lampH, rot };
      const { pan, tilt } = panTiltFor(from, spots[i % spots.length]!, { panRange, tiltRange });
      return { uid: f.uid, beam: { Pan: pan, Tilt: tilt } };
    }));
  };

  return (
    <section className="mt-4 space-y-2 border-t border-border pt-4">
      <h3 className="text-xs font-bold uppercase text-muted-foreground">{tr("Aim")}</h3>
      <div className="flex flex-wrap gap-1">
        {targets.length === 0 && <p className="text-[11px] text-muted-foreground">{tr("Name a spot on the plot with the Text tool, then tap it here.")}</p>}
        {targets.map((x) => <button key={x.id} onClick={() => setTargetId(x.id)} aria-pressed={x.id === targetId} className={chip(x.id === targetId)}>{x.name}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {num(tr("Rows"), rows, 1, 12, 1, (v) => setRows(Math.max(1, v)))}
        {num(tr("Cols"), cols, 1, 24, 1, (v) => setCols(Math.max(1, v)))}
        {num(tr("Spread m"), spread, 0, 20, 0.25, setSpread)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {num(tr("Lamp m"), lampH, 0, 20, 0.5, setLampH)}
        {num(tr("Target m"), targetH, 0, 20, 0.5, setTargetH)}
        {num(tr("Facing °"), rot, -180, 180, 15, setRot)}
        {num(tr("Plot m"), metres, 0.1, 10, 0.1, (v) => setGrid({ ...grid, metres: Math.max(0.1, v) }))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] uppercase text-muted-foreground">{tr("Pan")}</span>
        {PAN_RANGES.map((r) => <button key={r} onClick={() => setPanRange(r)} aria-pressed={panRange === r} className={chip(panRange === r)}>{r}°</button>)}
        <span className="ml-2 text-[10px] uppercase text-muted-foreground">{tr("Tilt")}</span>
        {TILT_RANGES.map((r) => <button key={r} onClick={() => setTiltRange(r)} aria-pressed={tiltRange === r} className={chip(tiltRange === r)}>{r}°</button>)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" disabled={!target} onClick={aim}>{tr("Aim")}{heads.length > 1 ? ` ${heads.length}` : ""}</Button>
        <Button size="sm" variant="secondary" disabled={!target} onClick={() => { aim(); onMove(uids, move); }}>{tr("Aim & move")}</Button>
        <Button size="sm" variant="ghost" onClick={() => onAim(heads.map((f) => ({ uid: f.uid, beam: { Pan: 0.5, Tilt: 0.5 } })))}>{tr("Centre")}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] uppercase text-muted-foreground">{tr("Move")}</span>
        <button onClick={() => { setShape("off"); onMove(uids, null); }} aria-pressed={shape === "off"} className={chip(shape === "off")}>{tr("Off")}</button>
        {AIM_SHAPES.map((s) => (
          <button key={s.id} onClick={() => { setShape(s.id); onMove(uids, { shape: s.id, rate, size }); }} aria-pressed={shape === s.id} className={chip(shape === s.id)}>{tr(s.label)}</button>
        ))}
      </div>
      {shape !== "off" && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <label className="flex flex-1 items-center gap-1">{tr("Speed")}<input type="range" min={0.02} max={2} step={0.02} value={rate} onChange={(e) => { const v = +e.target.value; setRate(v); onMove(uids, { shape, rate: v, size }); }} className="min-w-0 flex-1" /></label>
          <label className="flex flex-1 items-center gap-1">{tr("Size")}<input type="range" min={0.05} max={1} step={0.05} value={size} onChange={(e) => { const v = +e.target.value; setSize(v); onMove(uids, { shape, rate, size: v }); }} className="min-w-0 flex-1" /></label>
        </div>
      )}
    </section>
  );
}
