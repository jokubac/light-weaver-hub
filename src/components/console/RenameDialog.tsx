import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { renameSequence, type RenameOpts } from "@/lib/patch-order";
import { t as tr } from "@/lib/i18n";

type Light = { name: string; model?: string; universe?: number; address?: number };

const SEPS: [string, string][] = [[" ", "Space"], ["-", "-"], ["_", "_"], [".", "."], ["", "None"]];

export function RenameDialog({ lights, onApply, onClose }: { lights: Light[]; onApply: (names: string[]) => void; onClose: () => void }) {
  const [o, setO] = useState<RenameOpts>({ base: "Light", numbering: "after", start: 1, pad: 1, sep: " " });
  const set = (p: Partial<RenameOpts>) => setO((v) => ({ ...v, ...p }));
  const names = useMemo(() => renameSequence(o, lights), [o, lights]);
  const input = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  const chip = (on: boolean) =>
    `rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground"}`;
  const sample = lights[0] ?? {};
  const showNumbering = !o.base.includes("{n}");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold">{tr("Rename")} {lights.length} {tr("lights")}</h3>

        <label className="block text-xs">
          {tr("Name")}
          <input autoFocus className={`${input} mt-1`} value={o.base} onChange={(e) => set({ base: e.target.value })} />
        </label>

        <div className="flex flex-wrap gap-1 text-xs">
          {["{n}", "{model}", "{u}", "{a}"].map((t) => (
            <button key={t} onClick={() => set({ base: o.base + t })} className="rounded bg-surface-elevated px-2 py-1 font-mono">
              {t}
            </button>
          ))}
        </div>

        {showNumbering && (
          <div className="flex flex-wrap gap-1">
            {(["after", "before", "none"] as const).map((n) => (
              <button key={n} className={chip(o.numbering === n)} onClick={() => set({ numbering: n })}>
                {renameSequence({ ...o, numbering: n }, [sample])[0] || "—"}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 text-xs">
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3].map((p) => (
              <button key={p} className={chip(o.pad === p)} onClick={() => set({ pad: p })}>
                {String(p === 1 ? 1 : p === 2 ? "01" : "001")}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1">
            {tr("Start")}
            <input type="number" className="w-14 rounded-md border border-border bg-background px-2 py-1" value={o.start} onChange={(e) => set({ start: Number(e.target.value) || 0 })} />
          </label>
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          {SEPS.map(([v, label]) => (
            <button key={label} className={chip(o.sep === v)} onClick={() => set({ sep: v })}>
              {label === "Space" || label === "None" ? tr(label) : label}
            </button>
          ))}
        </div>

        <div className="max-h-32 overflow-auto rounded-md bg-background p-2 text-xs">
          {lights.slice(0, 40).map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{l.name}</span>
              <span className="truncate font-semibold">{names[i]}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tr("Cancel")}
          </Button>
          <Button
            onClick={() => {
              onApply(names);
              onClose();
            }}
          >
            {tr("Rename")}
          </Button>
        </div>
      </div>
    </div>
  );
}
