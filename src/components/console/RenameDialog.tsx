import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { renameSequence, type RenameOpts } from "@/lib/patch-order";
import { t as tr } from "@/lib/i18n";

type Light = { name: string; model?: string; universe?: number; address?: number };

export function RenameDialog({ lights, onApply, onClose }: { lights: Light[]; onApply: (names: string[]) => void; onClose: () => void }) {
  const [o, setO] = useState<RenameOpts>({ base: "Light", numbering: "after", start: 1, step: 1, pad: 1, sep: " " });
  const set = (p: Partial<RenameOpts>) => setO((v) => ({ ...v, ...p }));
  const names = useMemo(() => renameSequence(o, lights), [o, lights]);
  const field = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  const insert = (tok: string) => set({ base: o.base + tok });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold">{tr("Rename")} {lights.length} {tr("lights")}</h3>
        <label className="block text-xs">{tr("Name")}
          <input autoFocus className={field} value={o.base} onChange={(e) => set({ base: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-1 text-xs">
          {["{n}", "{model}", "{u}", "{a}"].map((t) => (
            <button key={t} onClick={() => insert(t)} className="rounded bg-surface-elevated px-2 py-1 font-mono">{t}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label>{tr("Sequence number")}
            <select className={field} value={o.numbering} onChange={(e) => set({ numbering: e.target.value as RenameOpts["numbering"] })}>
              <option value="after">{tr("After name")}</option>
              <option value="before">{tr("Before name")}</option>
              <option value="none">{tr("No number")}</option>
            </select>
          </label>
          <label>{tr("Separator")}
            <select className={field} value={o.sep} onChange={(e) => set({ sep: e.target.value })}>
              <option value=" ">{tr("Space")}</option><option value="">{tr("None")}</option><option value="-">-</option><option value="_">_</option><option value=".">.</option>
            </select>
          </label>
          <label>{tr("Start")}<input type="number" className={field} value={o.start} onChange={(e) => set({ start: Number(e.target.value) || 0 })} /></label>
          <label>{tr("Step")}<input type="number" className={field} value={o.step} onChange={(e) => set({ step: Number(e.target.value) || 1 })} /></label>
          <label className="col-span-2">{tr("Digits")}
            <select className={field} value={o.pad} onChange={(e) => set({ pad: Number(e.target.value) })}>
              <option value={1}>1, 2, 3</option><option value={2}>01, 02, 03</option><option value={3}>001, 002, 003</option>
            </select>
          </label>
        </div>
        <div className="max-h-40 overflow-auto rounded-md bg-background p-2 text-xs">
          {lights.slice(0, 50).map((l, i) => (
            <div key={i} className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{l.name}</span><span className="truncate font-semibold">{names[i]}</span></div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
          <Button onClick={() => { onApply(names); onClose(); }}>{tr("Rename")}</Button>
        </div>
      </div>
    </div>
  );
}
