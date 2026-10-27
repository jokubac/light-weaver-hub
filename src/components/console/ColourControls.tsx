import { NumberField } from "./NumberField";
import { ColorWheel, CctMacros, GmMacros } from "./AdvancedControls";
import { useState } from "react";
import { cctFromKelvin, kelvin, kelvinToRgb, hsvToRgb, type PatchedFixture } from "@/lib/dmx";
import { hexToHs } from "@/lib/gels";

import { t as tr } from "@/lib/i18n";
type ColourState = Pick<PatchedFixture, "cct" | "crossfade" | "hue" | "saturation">;
export function ColourControls({ value, update, gm, onGm }: { value: ColourState; update: (p: Partial<PatchedFixture>) => void; gm?: number; onGm?: (v: number) => void }) {
  return <div className="space-y-3" data-testid="colour-controls">
    <label className="block space-y-1 text-xs"><span className="flex items-center justify-between"><span>{tr("CCT")}</span><span className="flex items-center gap-1"><NumberField aria-label={tr("CCT Kelvin")} min={2000} max={10000} value={Math.round(kelvin(value.cct))} onChange={(v) => { if (v) update({ cct: cctFromKelvin(v), crossfade: 0 }); }} className="w-20 rounded border border-input bg-surface-elevated px-2 py-1 text-right font-mono" />{tr("K")}</span></span><input aria-label={tr("CCT")} type="range" min={0} max={1} step={0.001} value={value.cct} onChange={(e) => update({ cct: +e.target.value, crossfade: 0 })} className="w-full accent-primary" /></label>
    <CctMacros value={value.cct} update={(p) => update({ ...p, crossfade: 0 })} />
    {onGm != null && gm != null && <div className="space-y-1">
      <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>{tr("Green / Magenta")}</span><Numeric value={gm} label={tr("Green Magenta value")} min={-1} max={1} suffix="" onChange={(v) => onGm(Math.max(-1, Math.min(1, v)))} /></span><input aria-label={tr("Green / Magenta")} type="range" min={-1} max={1} step={0.01} value={gm} onDoubleClick={() => onGm(0)} onChange={(e) => onGm(+e.target.value)} className="w-full accent-primary" /></label>
      <GmMacros value={gm} update={(p) => onGm(p.gm ?? 0)} />
    </div>}
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>{tr("Crossfade CCT ↔ HSI")}</span><Numeric value={value.crossfade * 100} label={tr("Crossfade percent")} max={100} suffix="%" onChange={(v) => update({ crossfade: v / 100, cctOnly: false })} /></span><input aria-label={tr("Crossfade CCT ↔ HSI")} type="range" min={0} max={1} step={0.001} value={value.crossfade} onDoubleClick={() => update({ crossfade: 0 })} onChange={(e) => update({ crossfade: +e.target.value, cctOnly: false })} className="w-full accent-primary" /></label>
    <HueControls hue={value.hue} sat={value.saturation} crossfade={value.crossfade} update={update} />
  </div>;
}

function HueControls({ hue, sat, crossfade, update }: { hue: number; sat: number; crossfade: number; update: (p: Partial<PatchedFixture>) => void }) {
  return <div className="space-y-3">
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>{tr("Hue")}</span><Numeric value={hue} label={tr("Hue degrees")} max={360} suffix="°" onChange={(v) => update({ hue: v, saturation: sat || 1, crossfade: 1, cctOnly: false })} /></span><input aria-label={tr("Hue")} type="range" min={0} max={360} step={0.1} value={hue} onChange={(e) => update({ hue: +e.target.value, saturation: sat || 1, crossfade: 1, cctOnly: false })} className="w-full accent-primary" /></label>
    <ColorWheel hue={hue} sat={sat} crossfade={crossfade} update={update} />
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>{tr("Saturation")}</span><Numeric value={sat * 100} label={tr("Saturation percent")} max={100} suffix="%" onChange={(v) => update({ saturation: v / 100, crossfade: 1, cctOnly: false })} /></span><input aria-label={tr("Saturation")} type="range" min={0} max={1} step={0.001} value={sat} onChange={(e) => update({ saturation: +e.target.value, crossfade: 1, cctOnly: false })} className="w-full accent-primary" /></label>
  </div>;
}

export function HexColourControls({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [temperature, setTemperature] = useState(5600);
  const emitTemperature = (k: number) => {
    const next = Math.max(2000, Math.min(10000, k));
    setTemperature(next);
    onChange("#" + kelvinToRgb(next).map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""));
  };
  const { h, s } = hexToHs(value || "#ffffff");
  return <div className="space-y-3" data-testid="palette-colour-controls">
    <label className="block space-y-1 text-xs"><span className="flex items-center justify-between">{tr("CCT")}<NumberField aria-label={tr("Palette CCT Kelvin")} min={2000} max={10000} value={temperature} onChange={(v) => { if (v) emitTemperature(v); }} className="w-20 rounded border border-input bg-surface-elevated px-2 py-1 text-right font-mono" /></span><input aria-label={tr("Palette CCT")} type="range" min={2000} max={10000} step={1} value={temperature} onChange={(e) => emitTemperature(+e.target.value)} className="w-full accent-primary" /></label>
    <HueControls hue={h} sat={s} crossfade={1} update={(p) => {
    const rgb = hsvToRgb(p.hue ?? h, p.saturation ?? s, 1);
    onChange("#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""));
  }} /></div>;
}
function Numeric({ value, label, min = 0, max, suffix, onChange }: { value: number; label: string; min?: number; max: number; suffix: string; onChange: (n: number) => void }) {
  return <span className="flex items-center gap-1 font-mono"><NumberField aria-label={label} min={min} max={max} value={+value.toFixed(2)} onChange={(n) => { if (n !== undefined) onChange(n); }} className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right" />{suffix}</span>;
}
