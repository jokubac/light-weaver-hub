import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { fanValues, type FanMode } from "@/lib/fan";

import { t as tr } from "@/lib/i18n";
export type SpreadAttr = "intensity" | "cct" | "hue";

const LIMITS: Record<SpreadAttr, [number, number, number]> = { intensity: [0, 100, 1], cct: [2000, 10000, 100], hue: [0, 360, 1] };

/**
 * SPREAD: distributes intensity (%), colour temperature (K) or hue (°) across the selected lights
 * in on-screen order. Changes apply live while the sliders move.
 */
export function FanPopover({ count, className, onApply }: { count: number; className: string; onApply: (attr: SpreadAttr, values: number[]) => void }) {
  const [attr, setAttr] = useState<SpreadAttr>("intensity");
  const [mode, setMode] = useState<FanMode>("linear");
  const [from, setFrom] = useState({ intensity: 20, cct: 3200, hue: 0 });
  const [to, setTo] = useState({ intensity: 100, cct: 5600, hue: 240 });
  const [lo, hi, step] = LIMITS[attr];
  const unit = attr === "intensity" ? "%" : attr === "hue" ? "°" : "K";

  const apply = (a = attr, f = from[a], t = to[a], m = mode) => { if (count >= 2) onApply(a, fanValues(count, f, t, m)); };

  const slider = (label: string, v: number, set: (n: number) => void) => (
    <label className="block space-y-1">
      <div className="flex justify-between text-[10px] font-semibold uppercase text-muted-foreground"><span>{label}</span><span className="font-mono text-foreground">{v}{unit}</span></div>
      <input type="range" min={lo} max={hi} step={step} value={v} onChange={(e) => set(+e.target.value)} className="w-full" />
    </label>
  );
  const seg = (on: boolean) => `flex-1 rounded px-2 py-1.5 text-xs font-bold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  const preview = fanValues(Math.min(Math.max(count, 2), 12), from[attr], to[attr], mode);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={tr("Spread")} title={tr("Spread — graduate intensity or colour temperature across the selected lights")} className={`${className} gap-1`}>
          <ChartNoAxesColumnIncreasing className="h-4 w-4" />{tr("Spread")}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="text-xs font-bold">{tr("Spread across")}{count}{tr("lights")}</div>
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
        {slider(mode === "center" ? "Centre" : "First light", from[attr], (n) => { setFrom((s) => ({ ...s, [attr]: n })); apply(attr, n, to[attr]); })}
        {slider(mode === "center" ? "Edges" : "Last light", to[attr], (n) => { setTo((s) => ({ ...s, [attr]: n })); apply(attr, from[attr], n); })}
        <div aria-hidden className="flex h-10 items-end gap-0.5 rounded bg-background p-1">
          {preview.map((v, i) => (
            <div key={i} className="flex-1 rounded-sm" style={attr === "intensity"
              ? { height: `${Math.max(4, v)}%`, background: "hsl(var(--primary))" }
              : attr === "hue" ? { height: "100%", background: `hsl(${v} 100% 50%)` }
              : { height: "100%", background: `hsl(${30 + ((v - 2000) / 8000) * 180} 80% ${70 - ((v - 2000) / 8000) * 10}%)` }} />
          ))}
        </div>
        <button disabled={count < 2} onClick={() => { const f = from[attr], t = to[attr]; setFrom((s) => ({ ...s, [attr]: t })); setTo((s) => ({ ...s, [attr]: f })); apply(attr, t, f); }}
          className="w-full rounded-md bg-surface-elevated py-1.5 text-xs font-bold active:scale-95 disabled:opacity-40">{tr("⇄ Reverse")}</button>
        <p className="text-[10px] text-muted-foreground">{tr("Order follows the lights as shown on screen. Changes apply instantly.")}</p>
      </PopoverContent>
    </Popover>
  );
}
