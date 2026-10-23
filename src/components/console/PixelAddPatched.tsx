import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PatchedFixture } from "@/lib/dmx";
import { getMode } from "@/lib/dmx";
import { PixelAddClose } from "@/components/console/pixel-add-context";

/** Pick already-patched lights (pixel or not) to place on the PIXEL map. */
export function PixelAddPatched({ fixtures, onAdd, exclude }: { fixtures: PatchedFixture[]; onAdd: (uids: string[]) => void; exclude?: string[] }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  const close = useContext(PixelAddClose);
  const free = fixtures.filter((f) => (exclude ? !exclude.includes(f.uid) : !f.pixelPos) && !f.split && f.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-2">
    <input aria-label="Search lights" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patched lights" className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
    <div className="flex gap-1">
      <Button size="sm" variant="secondary" onClick={() => setPick(free.map((f) => f.uid))}>Select all</Button>
      <Button size="sm" variant="ghost" onClick={() => setPick([])}>Clear</Button>
      <Button size="sm" className="ml-auto" disabled={!pick.length} onClick={() => { onAdd(pick); setPick([]); }}>Add {pick.length || ""} to map</Button>
    </div>
    <div className="max-h-[50vh] space-y-1 overflow-auto">
      {!free.length && <p className="py-6 text-center text-sm text-muted-foreground">All patched lights are already on the map. Patch more lights in PATCH.</p>}
      {free.map((f) => { const on = pick.includes(f.uid); const px = getMode(f).pixels;
        return <button key={f.uid} type="button" onClick={() => setPick((p) => on ? p.filter((u) => u !== f.uid) : [...p, f.uid])}
          className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${on ? "border-primary bg-primary/15" : "border-border bg-surface-elevated"}`}>
          <span className="flex-1 truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">{px ? `${px} px` : "1 px"} · U{f.universe}.{f.address}</span>
        </button>; })}
    </div>
  </div>;
}
