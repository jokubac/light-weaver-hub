import { ColorWheel, CctMacros } from "./AdvancedControls";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cctFromKelvin, kelvin, kelvinToRgb, hsvToRgb, type PatchedFixture } from "@/lib/dmx";
import { hexToHs } from "@/lib/gels";

type ColourState = Pick<PatchedFixture, "cct" | "crossfade" | "hue" | "saturation">;
export function ColourControls({ value, update }: { value: ColourState; update: (p: Partial<PatchedFixture>) => void }) {
  return <div className="space-y-3" data-testid="colour-controls">
    <div className="flex gap-1" role="group" aria-label="Colour mode">
      <Button size="sm" variant={value.crossfade === 0 ? "default" : "secondary"} aria-pressed={value.crossfade === 0} onClick={() => update({ crossfade: 0, cctOnly: true })}>CCT</Button>
      <Button size="sm" variant={value.crossfade > 0 ? "default" : "secondary"} aria-pressed={value.crossfade > 0} onClick={() => update({ crossfade: 1, cctOnly: false })}>Color / HSI</Button>
    </div>
    <label className="block space-y-1 text-xs"><span className="flex items-center justify-between"><span>CCT</span><span className="flex items-center gap-1"><input aria-label="CCT Kelvin" type="number" min={2000} max={10000} step="any" value={kelvin(value.cct)} onChange={(e) => { if (e.target.value) update({ cct: cctFromKelvin(Math.min(10000, Math.max(2000, +e.target.value))), crossfade: 0 }); }} className="w-20 rounded border border-input bg-surface-elevated px-2 py-1 text-right font-mono" />K</span></span><input aria-label="CCT" type="range" min={0} max={1} step={0.001} value={value.cct} onChange={(e) => update({ cct: +e.target.value, crossfade: 0 })} className="w-full accent-primary" /></label>
    <CctMacros value={value.cct} update={(p) => update({ ...p, crossfade: 0 })} />
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>Crossfade CCT ↔ HSI</span><span>{Math.round(value.crossfade * 100)}%</span></span><input aria-label="Crossfade CCT ↔ HSI" type="range" min={0} max={1} step={0.001} value={value.crossfade} onDoubleClick={() => update({ crossfade: 0 })} onChange={(e) => update({ crossfade: +e.target.value, cctOnly: false })} className="w-full accent-primary" /></label>
    <HueControls hue={value.hue} sat={value.saturation} crossfade={value.crossfade} update={update} />
  </div>;
}

function HueControls({ hue, sat, crossfade, update }: { hue: number; sat: number; crossfade: number; update: (p: Partial<PatchedFixture>) => void }) {
  return <div className="space-y-3">
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>Hue</span><span>{Math.round(hue)}°</span></span><input aria-label="Hue" type="range" min={0} max={360} step={0.1} value={hue} onChange={(e) => update({ hue: +e.target.value, saturation: sat || 1, crossfade: 1, cctOnly: false })} className="w-full accent-primary" /></label>
    <ColorWheel hue={hue} sat={sat} crossfade={crossfade} update={update} />
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>Saturation</span><span>{Math.round(sat * 100)}%</span></span><input aria-label="Saturation" type="range" min={0} max={1} step={0.001} value={sat} onChange={(e) => update({ saturation: +e.target.value, crossfade: 1, cctOnly: false })} className="w-full accent-primary" /></label>
  </div>;
}

export function HexColourControls({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [temperature, setTemperature] = useState(5600);
  const [mode, setMode] = useState<"cct" | "color">("color");
  const emitTemperature = (k: number) => {
    const next = Math.max(2000, Math.min(10000, k));
    setTemperature(next); setMode("cct");
    onChange("#" + kelvinToRgb(next).map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""));
  };
  const { h, s } = hexToHs(value || "#ffffff");
  return <div className="space-y-3" data-testid="palette-colour-controls">
    <div className="flex gap-1" role="group" aria-label="Palette colour mode">
      <Button size="sm" variant={mode === "cct" ? "default" : "secondary"} aria-pressed={mode === "cct"} onClick={() => emitTemperature(temperature)}>CCT</Button>
      <Button size="sm" variant={mode === "color" ? "default" : "secondary"} aria-pressed={mode === "color"} onClick={() => setMode("color")}>Color / HSI</Button>
    </div>
    <label className="block space-y-1 text-xs"><span className="flex items-center justify-between">CCT<input aria-label="Palette CCT Kelvin" type="number" min={2000} max={10000} value={temperature} onChange={(e) => { if (e.target.value) emitTemperature(+e.target.value); }} className="w-20 rounded border border-input bg-surface-elevated px-2 py-1 text-right font-mono" /></span><input aria-label="Palette CCT" type="range" min={2000} max={10000} step={1} value={temperature} onChange={(e) => emitTemperature(+e.target.value)} className="w-full accent-primary" /></label>
    <HueControls hue={h} sat={s} crossfade={mode === "color" ? 1 : 0} update={(p) => {
    setMode("color");
    const rgb = hsvToRgb(p.hue ?? h, p.saturation ?? s, 1);
    onChange("#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""));
  }} /></div>;
}