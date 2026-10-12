import { useState } from "react";
import { Plus, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HexColourControls } from "./ColourControls";
import { ColorSource } from "./ColorSource";

const PALETTES = [
  { name: "Warm", colours: ["#ff4000", "#ffb000", "#fff1cf"] },
  { name: "Cool", colours: ["#0040ff", "#00cfff", "#d9faff"] },
  { name: "Neon", colours: ["#ff0055", "#00ffb3", "#8800ff"] },
  { name: "Police", colours: ["#ff0000", "#0055ff"] },
];

export function PaletteEditor({ colours, onChange, native, onReset }: {
  colours: string[]; onChange: (colours: string[]) => void; native?: boolean; onReset?: () => void;
}) {
  const [active, setActive] = useState(0);
  const index = Math.max(0, Math.min(active, colours.length - 1));
  const updateColour = (hex: string) => onChange(colours.length ? colours.map((c, i) => i === index ? hex : c) : [hex]);
  return <div className="space-y-3" data-testid="effect-palette">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{native ? "Original colours" : "Colour palette"}</h3>
      {onReset && <Button size="sm" variant="ghost" onClick={onReset} aria-label="Reset effect colours" title="Original effect colours"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {colours.map((c, i) => <div key={i} className="relative">
        <Button variant="ghost" size="icon" className={`h-9 w-9 border-2 ${index === i ? "border-primary" : "border-input"}`} onClick={() => setActive(i)} aria-label={`Edit colour ${i + 1}`} title={`Colour ${i + 1}`}>
          <span className="h-6 w-6 rounded-sm" style={{ background: c }} />
        </Button>
        {colours.length > 1 && <Button size="icon" variant="secondary" className="absolute -right-1 -top-1 h-4 w-4 rounded-full" title="Remove colour" aria-label={`Remove colour ${i + 1}`} onClick={() => { onChange(colours.filter((_, j) => j !== i)); setActive(Math.max(0, index - (i <= index ? 1 : 0))); }}><X className="h-2.5 w-2.5" /></Button>}
      </div>)}
      {colours.length < 8 && <Button size="icon" variant="outline" className="h-9 w-9 border-dashed" title="Add colour" aria-label="Add palette colour" onClick={() => { onChange([...colours, "#ffffff"]); setActive(colours.length); }}><Plus /></Button>}
    </div>
    <div className="flex flex-wrap gap-1">{PALETTES.map((p) => <Button key={p.name} size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => { onChange([...p.colours]); setActive(0); }}>{p.colours.map((c) => <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)}{p.name}</Button>)}</div>
    {colours.length > 0 && <HexColourControls value={colours[index] ?? "#ffffff"} onChange={updateColour} />}
    <ColorSource noCct compact onPick={updateColour} />
  </div>;
}