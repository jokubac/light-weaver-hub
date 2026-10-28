import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { fanValues, spreadSwatch, type FanMode, type SpreadAttr } from "@/lib/fan";
import { DEFAULT_CCT_RANGE } from "@/lib/dmx";

import { t as tr } from "@/lib/i18n";
export type { SpreadAttr } from "@/lib/fan";

const LIMITS: Record<SpreadAttr, [number, number, number]> = { intensity: [0, 100, 1], cct: [2000, 10000, 100], hue: [0, 360, 1] };

/**
 * SPREAD: distributes intensity (%), colour temperature (K) or hue (°) across the selected lights
 * in on-screen order. Changes apply live while the sliders move.
 * CCT uses the range of the lights themselves (cctRange), so it matches the Kelvin control.
 */
export function FanPopover({ count, className, cctRange = DEFAULT_CCT_RANGE, onApply }: {
  count: number; className: string; cctRange?: [number, number]; onApply: (attr: SpreadAttr, values: number[]) => void;
}) {
  const [attr, setAttr] = useState<SpreadAttr>("intensity");
  const [mode, setMode] = useState<FanMode>("linear");
  const [from, setFrom] = useState({ intensity: 20, cct: 3200, hue: 0 });
  const [to, setTo] = useState({ intensity: 100, cct: 5600, hue: 240 });
  // Keep the popover open while a slider drag ends outside it (Radix dismisses on pointer-up out of the panel).
  const dragging = useRef(false);
  useEffect(() => {
    const stop = () => setTimeout(() => { dragging.current = false; }, 0);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);

  const cctClamp = (k: number) => Math.min(cctRange[1], Math.max(cctRange[0], k));
  // Selection changed to lamps with different limits — pull the saved values back inside.
  useEffect(() => {
    setFrom((s) => ({ ...s, cct: cctClamp(s.cct) }));
    setTo((s) => ({ ...s, cct: cctClamp(s.cct) }));
  }, [cctRange[0], cctRange[1]]);

  const [lo, hi, step] = attr === "cct" ? [cctRange[0], cctRange[1], 100] as [number, number, number] : LIMITS[attr];
  const unit = attr === "intensity" ? "%" : attr === "hue" ? "°" : "K";
  const val = (a: SpreadAttr, v: number) => (a === "cct" ? cctClamp(v) : v);

  const apply = (a = attr, f = val(a, from[a]), t = val(a, to[a]), m = mode) => { if (count >= 2) onApply(a, fanValues(count, f, t, m)); };

  const slider = (label: string, v: number, set: (n: number) => void) => (
    <label className="block space-y-1">
      <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground"><span>{label}</span><span className="font-mono text-foreground">{v}{unit}</span></div>
      <input type="range" min={lo} max={hi} step={step} value={v}
        onPointerDown={() => { dragging.current = true; }}
        onChange={(e) => set(+e.target.value)} className="w-full" />
    </label>
  );
  const seg = (on: boolean) => `flex-1 rounded px-2 py-1.5 text-xs font-bold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  const preview = fanValues(Math.min(Math.max(count, 2), 12), val(attr, from[attr]), val(attr, to[attr]), mode);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={tr("Spread")} title={tr("Spread — graduate intensity or colour temperature across the selected lights")} className={`${className} gap-1`}>
          <ChartNoAxesColumnIncreasing className="h-4 w-4" />{tr("Spread")}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3"
        onPointerDownOutside={(e) => { if (dragging.current) e.preventDefault(); }}
        onInteractOutside={(e) => { if (dragging.current) e.preventDefault(); }}
        onFocusOutside={(e) => { if (dragging.current) e.preventDefault(); }}>
        <div className="text-xs font-bold">{tr("Spread across")} {count} {tr("lights")}</div>
        {count < 2 && <p className="rounded bg-warning/15 px-2 py-1.5 text-xs text-warning">{tr("Select 2 or more lights first.")}</p>}
        <div className="flex gap-1">
          <button className={seg(attr === "intensity")} onClick={() => { setAttr("intensity"); apply("intensity"); }}>{tr("Intensity")}</button>
          <button className={seg(attr === "cct")} onClick={() => { setAttr("cct"); apply("cct"); }}>{tr("CCT")}</button>
          <button className={seg(attr === "hue")} onClick={() => { setAttr("hue"); apply("hue"); }}>{tr("Hue")}</button>
        </div>
        <div className="flex gap-1">
          <button className={seg(mode === "linear")} onClick={() => { setMode("linear"); apply(attr, from[attr], to[attr], "linear"); }}>{tr("Left → right")}</button>
          <button className={seg(mode === "center")} onClick={() => { setMode("center"); apply(attr, from[attr], to[attr], "center"); }}>{tr("Centre → edges")}</button>
        </div>
        {slider(mode === "center" ? tr("Centre") : tr("First light"), val(attr, from[attr]), (n) => { setFrom((s) => ({ ...s, [attr]: n })); apply(attr, n, to[attr]); })}
        {slider(mode === "center" ? tr("Edges") : tr("Last light"), val(attr, to[attr]), (n) => { setTo((s) => ({ ...s, [attr]: n })); apply(attr, from[attr], n); })}
        <div aria-hidden className="flex h-10 items-stretch gap-0.5 rounded bg-background p-1">
          {preview.map((v, i) => attr === "intensity" ? (
            <div key={i} className="flex flex-1 flex-col justify-end overflow-hidden rounded-sm bg-primary/15">
              <div className="w-full rounded-sm bg-primary" style={{ height: `${Math.max(4, Math.min(100, v))}%` }} />
            </div>
          ) : (
            <div key={i} className="flex-1 rounded-sm" style={{ background: spreadSwatch(attr, v) }} />
          ))}
        </div>
        <button disabled={count < 2} onClick={() => { const f = val(attr, from[attr]), t = val(attr, to[attr]); setFrom((s) => ({ ...s, [attr]: t })); setTo((s) => ({ ...s, [attr]: f })); apply(attr, t, f); }}
          className="w-full rounded-md bg-surface-elevated py-1.5 text-xs font-bold active:scale-95 disabled:opacity-40">{tr("⇄ Reverse")}</button>
        <p className="text-[10px] text-muted-foreground">{tr("Order follows the lights as shown on screen. Changes apply instantly.")}</p>
      </PopoverContent>
    </Popover>
  );
}
