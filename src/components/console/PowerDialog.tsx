import { NumberField } from "./NumberField";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { BATTERY_PRESETS, batteryStatus, fixtureWatts, fmtHours, type PowerKind, type PowerSource } from "@/lib/power";

const inputCls = "mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export function PowerDialog({ f, open, onOpenChange, onChange, level }: {
  f: PatchedFixture; open: boolean; onOpenChange: (o: boolean) => void; level: number;
  onChange: (p: PowerSource | null) => void;
}) {
  const fixtureDef = getDef(f.defId);
  const autoW = fixtureDef.watts ?? fixtureWatts(`${fixtureDef.brand} ${fixtureDef.model}`);
  const [d, setD] = useState<PowerSource>(f.power ?? { kind: "instagrid", kwh: 2.1, charge: 1, watts: autoW, usedWh: 0 });
  const st = batteryStatus({ ...d, usedWh: 0 }, { ...f, intensity: 1, on: true }, 1);
  const kinds: { id: PowerKind; label: string }[] = [{ id: "vmount", label: "V-mount" }, { id: "instagrid", label: "Instagrid" }, { id: "other", label: "Other" }, { id: "mains", label: "Mains" }];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Power — {f.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="grid grid-cols-4 gap-1.5">
            {kinds.map((k) => <button key={k.id} onClick={() => setD({ ...d, kind: k.id })} className={`rounded-md py-2 text-xs ${d.kind === k.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-foreground"}`}>{k.label}</button>)}
          </div>
          {d.kind !== "mains" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {BATTERY_PRESETS.filter((b) => d.kind === "other" || b.kind === d.kind).map((b) => (
                  <button key={b.label} onClick={() => setD({ ...d, kwh: b.kwh })} className={`rounded-md px-2 py-1.5 text-[11px] normal-case ${d.kwh === b.kwh ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated text-foreground"}`}>{b.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label>Capacity kWh<NumberField min={0} value={d.kwh} onChange={(v) => setD({ ...d, kwh: v ?? 0 })} className={inputCls} /></label>
                <label>Charged %<NumberField min={0} max={100} value={Math.round(d.charge * 100)} onChange={(v) => setD({ ...d, charge: (v ?? 0) / 100 })} className={inputCls} /></label>
                <label>Light W<NumberField min={0} value={d.watts || null} onChange={(v) => setD({ ...d, watts: v ?? 0 })} className={inputCls} /></label>
              </div>
              <p className="normal-case tracking-normal">{autoW > 0 ? `${fixtureDef.model}: ${autoW} W max.` : "Power unknown"} {autoW > 0 && d.watts !== autoW && <button onClick={() => setD({ ...d, watts: autoW })} className="text-primary underline">Use {autoW} W</button>}</p>
              <p className="normal-case tracking-normal text-foreground">At 100% output: about <b>{fmtHours(st.hours)}</b>. Lower intensity stretches it — the estimate updates live while you work.</p>
              {f.power && <p className="normal-case tracking-normal">Now: {Math.round(batteryStatus(f.power, f, level).pct * 100)}% left · {fmtHours(batteryStatus(f.power, f, level).hours)} at current level</p>}
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {f.power && <button onClick={() => { onChange(null); onOpenChange(false); }} className="rounded-lg bg-surface-elevated px-4 py-2.5 text-sm font-semibold">Remove</button>}
          <button onClick={() => { onChange(d.kind === "mains" ? null : { ...d, usedWh: 0 }); onOpenChange(false); }} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save (resets from charge %)</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
