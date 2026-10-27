import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { PatchedFixture } from "@/lib/dmx";
import type { LookState } from "@/lib/store";
import { batteryStatus, fmtHours } from "@/lib/power";
import { loadRdmSnapshots } from "@/lib/rdm";

import { t as tr } from "@/lib/i18n";
interface Props {
  open: boolean; onOpenChange: (o: boolean) => void;
  fixtures: PatchedFixture[]; level: number;
  parked: Record<string, LookState>; setParked: (p: Record<string, LookState>) => void;
}

const Bar = ({ k, warn }: { k: number; warn?: boolean }) => (
  <div className="h-2 w-full overflow-hidden rounded bg-surface"><div className={`h-full ${warn ? "bg-destructive" : k < 0.2 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%` }} /></div>
);

export function ShowMonitor(p: Props) {
  const rdm = useMemo(() => (p.open ? loadRdmSnapshots() : []), [p.open]);
  const packs = p.fixtures.filter((f) => f.power && f.power.kind !== "mains").map((f) => ({ f, s: batteryStatus(f.power!, f, p.level) })).sort((a, b) => a.s.pct - b.s.pct);
  const rdmBat = rdm.flatMap((s) => s.devices.filter((d) => d.battery).map((d) => ({ s, d })));
  const parkedList = p.fixtures.filter((f) => p.parked[f.uid]);
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tr("Monitor")}</DialogTitle></DialogHeader>
        <Tabs defaultValue="bat">
          <TabsList><TabsTrigger value="bat">{tr("Batteries")}</TabsTrigger><TabsTrigger value="park">{tr("Parked (")}{parkedList.length})</TabsTrigger></TabsList>

          <TabsContent value="bat" className="space-y-3">
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">{tr("Reported by the lights (RDM)")}</h3>
              {rdmBat.length ? rdmBat.map(({ s, d }) => {
                const pct = d.battery!.unit === "%" ? d.battery!.value / 100 : null;
                return (
                  <div key={s.universe + d.uid} className="grid grid-cols-[1fr_6rem_8rem] items-center gap-2 py-1 text-xs">
                    <span className="truncate">{d.label || d.model} <span className="text-muted-foreground">{tr("U")}{s.universe} · {d.address}</span></span>
                    <span className="font-mono">{d.battery!.value}{d.battery!.unit}</span>
                    {pct != null ? <Bar k={pct} warn={pct < 0.1} /> : <span />}
                  </div>
                );
              }) : <p className="text-xs text-muted-foreground">{tr("No readings yet. In PATCH → More sources → RDM, scan a universe; the battery levels then show here.")}</p>}
              {rdm.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{tr("Last scan:")}{new Date(Math.max(...rdm.map((s) => s.at))).toLocaleTimeString()}</p>}
            </section>
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">{tr("Estimated (V-mount / Instagrid set on the light)")}</h3>
              {packs.length ? packs.map(({ f, s }) => (
                <div key={f.uid} className="grid grid-cols-[1fr_6rem_8rem] items-center gap-2 py-1 text-xs">
                  <span className="truncate">{f.name}</span>
                  <span className="font-mono">{Math.round(s.pct * 100)}% · {fmtHours(s.hours)}</span>
                  <Bar k={s.pct} warn={s.pct < 0.1} />
                </div>
              )) : <p className="text-xs text-muted-foreground">{tr("No lights have a battery set.")}</p>}
            </section>
          </TabsContent>


          <TabsContent value="park" className="space-y-2">
            <p className="text-xs text-muted-foreground">{tr("Parked lights stay at a fixed level whatever cues, faders or effects do. Park from the FIXTURES bar.")}</p>
            {parkedList.map((f) => (
              <div key={f.uid} className="flex items-center justify-between rounded bg-surface-elevated px-2 py-1 text-xs">
                <span>{f.name} <span className="font-mono text-muted-foreground">{Math.round((p.parked[f.uid]!.intensity ?? 0) * 100)}%</span></span>
                <Button size="sm" variant="secondary" onClick={() => { const n = { ...p.parked }; delete n[f.uid]; p.setParked(n); }}>{tr("Unpark")}</Button>
              </div>
            ))}
            {parkedList.length > 0 && <Button variant="secondary" onClick={() => p.setParked({})}>{tr("Unpark all")}</Button>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
