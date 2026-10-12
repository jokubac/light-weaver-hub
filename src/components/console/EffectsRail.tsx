import { useState } from "react";
import { Play, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFxLibrary } from "@/lib/fxlib";
import type { PatchedFixture } from "@/lib/dmx";
import type { PixelLayer } from "@/lib/pixels";

export function EffectsRail({ fixture, layer, onFixture, onPixel }: {
  fixture: PatchedFixture | undefined; layer: PixelLayer | undefined;
  onFixture: (fx: PatchedFixture["fx"]) => void; onPixel: (layer: PixelLayer) => void;
}) {
  const library = useFxLibrary();
  const [kind, setKind] = useState<"fx" | "pixel">("fx");
  const [name, setName] = useState("");
  const available = kind === "fx" ? fixture && fixture.fx.kind !== "none" : layer;
  return <section aria-label="Saved effects" className="space-y-2 border-t border-border pt-3">
    <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">Effects</h3>
    <div className="flex gap-1" role="tablist" aria-label="Effect type">
      <Button size="sm" role="tab" aria-selected={kind === "fx"} variant={kind === "fx" ? "default" : "secondary"} onClick={() => setKind("fx")}>Fixture</Button>
      <Button size="sm" role="tab" aria-selected={kind === "pixel"} variant={kind === "pixel" ? "default" : "secondary"} onClick={() => setKind("pixel")}>Pixel</Button>
    </div>
    <form className="flex gap-1" onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim() || !available) return;
      if (kind === "fx" && fixture) library.saveFx(name.trim(), fixture.fx);
      else if (kind === "pixel" && layer) library.savePixel(name.trim(), layer);
      setName("");
    }}>
      <input aria-label="Effect name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Effect name" className="min-w-0 flex-1 rounded border border-input bg-surface-elevated px-2 py-2 text-xs" />
      <Button type="submit" size="icon" disabled={!available || !name.trim()} title="Save effect" aria-label="Save effect"><Save className="h-4 w-4" /></Button>
    </form>
    {library.lib[kind].map((item) => <div key={item.id} className="flex items-center gap-1 rounded bg-surface-elevated">
      <Button variant="ghost" className="min-w-0 flex-1 justify-start px-2 text-xs" disabled={kind === "fx" ? !fixture : !layer} onClick={() => {
        if ("fx" in item) onFixture(structuredClone(item.fx));
        else onPixel(structuredClone(item.layer));
      }}><Play className="h-3 w-3 shrink-0" /><span className="truncate">{item.name}</span></Button>
      <Button variant="ghost" size="icon" aria-label={`Delete effect ${item.name}`} title="Delete effect" onClick={() => { if (confirm(`Delete "${item.name}"?`)) library.remove(kind, item.id); }}><Trash2 className="h-3 w-3" /></Button>
    </div>)}
  </section>;
}