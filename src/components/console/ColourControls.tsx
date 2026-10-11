import { ColorWheel, CctMacros } from "./AdvancedControls";
import { Button } from "@/components/ui/button";
import { cctFromKelvin, kelvin, hsvToRgb, type PatchedFixture } from "@/lib/dmx";
import { hexToHs } from "@/lib/gels";

type ColourState = Pick<PatchedFixture, "cct" | "crossfade" | "hue" | "saturation">;
export function ColourControls({ value, update }: { value: ColourState; update: (p: Partial<PatchedFixture>) => void }) {
  return <div className="space-y-3" data-testid="colour-controls">
    <label className="block space-y-1 text-xs"><span className="flex items-center justify-between"><span>CCT</span><span className="flex items-center gap-1"><input aria-label="CCT Kelvin" type="number" min={2000} max={10000} step="any" value={kelvin(value.cct)} onChange={(e) => { if (e.target.value) update({ cct: cctFromKelvin(Math.min(10000, Math.max(2000, +e.target.value))), crossfade: 0 }); }} className="w-20 rounded border border-input bg-surface-elevated px-2 py-1 text-right font-mono" />K</span></span><input aria-label="CCT" type="range" min={0} max={1} step={0.001} value={value.cct} onChange={(e) => update({ cct: +e.target.value, crossfade: 0 })} className="w-full accent-primary" /></label>
    <CctMacros value={value.cct} update={(p) => update({ ...p, crossfade: 0 })} />
    <label className="block space-y-1 text-xs"><span className="flex justify-between"><span>Crossfade CCT ↔ HSI</span><span>{Math.round(value.crossfade * 100)}%</span></span><input aria-label="Crossfade CCT ↔ HSI" type="range" min={0} max={1} step={0.001} value={value.crossfade} onDoubleClick={() => update({ crossfade: 0 })} onChange={(e) => update({ crossfade: +e.target.value, cctOnly: false })} className="w-full accent-primary" /></label>
    <HueControls hue={value.hue} sat={value.saturation} crossfade={value.crossfade} update={update} />
    <Button variant="secondary" size="sm" onClick={() => update({ crossfade: 0 })}>CCT</Button>
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
  const { h, s } = hexToHs(value || "#ffffff");
  return <HueControls hue={h} sat={s} crossfade={1} update={(p) => {
    const rgb = hsvToRgb(p.hue ?? h, p.saturation ?? s, 1);
    onChange("#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""));
  }} />;
}