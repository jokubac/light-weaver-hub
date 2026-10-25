import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { fanValues, type FanMode } from "@/lib/fan";

type Attr = "intensity" | "cct";

/** Fan selected lights: spreads intensity (%) or colour temperature (K) across the selection order. */
export function FanPopover({ count, className, onApply }: { count: number; className: string; onApply: (attr: Attr, values: number[]) => void }) {
  const [attr, setAttr] = useState<Attr>("intensity");
  const [mode, setMode] = useState<FanMode>("linear");
  const [from, setFrom] = useState({ intensity: 20, cct: 3200 });
  const [to, setTo] = useState({ intensity: 100, cct: 5600 });
  const unit = attr === "intensity" ? "%" : "K";
  const lim = attr === "intensity" ? [0, 100] : [1700, 12000];
  const field = (v: number, set: (n: number) => void, label: string) => (
    <label className="flex flex-1 flex-col gap-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}
      <input type="number" min={lim[0]} max={lim[1]} value={v} onChange={(e) => set(+e.target.value)}
        className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-sm text-foreground" />
    </label>
  );
  const seg = (on: boolean) => `flex-1 rounded px-2 py-1 text-xs font-bold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label="Fan" title="Fan — spread values across the selected lights" className={`${className} gap-1`}><ChartNoAxesColumnIncreasing className="h-4 w-4" />Fan</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="text-xs font-bold">Fan {count} lights <span className="font-normal text-muted-foreground">(in selection order)</span></div>
        {count < 2 && <p className="rounded bg-warning/15 px-2 py-1.5 text-xs text-warning">Select 2 or more lights first, then tap Apply.</p>}
        <div className="flex gap-1">
          <button className={seg(attr === "intensity")} onClick={() => setAttr("intensity")}>Intensity</button>
          <button className={seg(attr === "cct")} onClick={() => setAttr("cct")}>CCT</button>
        </div>
        <div className="flex gap-2">
          {field(from[attr], (n) => setFrom((s) => ({ ...s, [attr]: n })), `${mode === "center" ? "Centre" : "First"} (${unit})`)}
          {field(to[attr], (n) => setTo((s) => ({ ...s, [attr]: n })), `${mode === "center" ? "Edges" : "Last"} (${unit})`)}
        </div>
        <div className="flex gap-1">
          <button className={seg(mode === "linear")} onClick={() => setMode("linear")}>First → last</button>
          <button className={seg(mode === "center")} onClick={() => setMode("center")}>Centre → edges</button>
        </div>
        <button disabled={count < 2} onClick={() => { const c = (n: number) => Math.max(lim[0]!, Math.min(lim[1]!, n)); onApply(attr, fanValues(count, c(from[attr]), c(to[attr]), mode)); }}
          className="w-full rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground active:scale-95">Apply fan</button>
      </PopoverContent>
    </Popover>
  );
}
