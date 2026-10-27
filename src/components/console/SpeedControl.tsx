import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampSpeed, MAX_SPEED, MIN_SPEED, positionToSpeed, speedToPosition } from "@/lib/speed";

import { t as tr } from "@/lib/i18n";
export function SpeedControl({ label, value, unit, onChange }: { label: string; value: number; unit: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [fine, setFine] = useState(true);
  const [factor, setFactor] = useState(2);
  const commit = () => {
    if (draft !== null) {
      const parsed = Number(draft.replace(",", "."));
      if (draft.trim() && Number.isFinite(parsed)) onChange(clampSpeed(parsed));
    }
    setDraft(null);
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <label className="font-semibold uppercase tracking-wider text-muted-foreground" htmlFor={`speed-${label}`}>{label}</label>
      <div className="flex items-center gap-1 font-mono">
        <input id={`speed-${label}`} aria-label={`${label} value`} inputMode="decimal" value={draft ?? String(+value.toFixed(5))}
          onFocus={(e) => { setDraft(String(value)); e.target.select(); }} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); } }}
          className="w-20 text-right rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
        <span>{unit}</span>
      </div>
    </div>
    <input aria-label={`${label} slider`} type="range" min={0} max={1} step={0.0001} value={speedToPosition(value)} onChange={(e) => onChange(positionToSpeed(+e.target.value))} className="w-full accent-primary" />
    <div className="flex items-center gap-1">
      <Button variant="secondary" size="icon" title={fine ? "Decrease speed 1%" : `Divide speed by ${factor}`} aria-label={`Decrease ${label}`} onClick={() => onChange(clampSpeed(value / (fine ? 1.01 : factor)))}><Minus /></Button>
      <Button variant="secondary" size="icon" title={fine ? "Increase speed 1%" : `Multiply speed by ${factor}`} aria-label={`Increase ${label}`} onClick={() => onChange(clampSpeed(value * (fine ? 1.01 : factor)))}><Plus /></Button>
      <div className="ml-1 flex gap-1" role="group" aria-label={`${label} adjustment`}>
        <Button variant={fine ? "default" : "secondary"} size="sm" aria-pressed={fine} onClick={() => setFine(true)}>1%</Button>
        {[1.25, 1.5, 2].map((n) => <Button key={n} variant={!fine && factor === n ? "default" : "secondary"} size="sm" aria-pressed={!fine && factor === n} onClick={() => { setFine(false); setFactor(n); }}>×{n}</Button>)}
      </div>
      <Button variant="ghost" size="sm" className="ml-auto font-mono" onClick={() => onChange(1)}>1 {unit}</Button>
    </div>
    <div className="flex flex-wrap justify-between gap-1 font-mono text-[10px] text-muted-foreground"><span>{MIN_SPEED}–{MAX_SPEED} {unit} · {+(value * 100).toFixed(2)}%</span>{unit === "Hz" && <span>{+(1 / value).toFixed(3)}{tr("s / cycle")}</span>}</div>
  </div>;
}