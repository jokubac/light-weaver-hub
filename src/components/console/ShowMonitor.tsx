import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { PatchedFixture } from "@/lib/dmx";
import type { LookState } from "@/lib/store";
import { batteryStatus, fmtHours } from "@/lib/power";
import { fixtureWattage } from "@/lib/callsheet";
import { loadRdmSnapshots } from "@/lib/rdm";
import { autoBalance, phaseLoads, type Phase } from "@/lib/show-control";

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void;
  fixtures: PatchedFixture[]; level: number;
  phases: Record<string, Phase>; setPhases: (p: Record<string, Phase>) => void;
  parked: Record<string, LookState>; setParked: (p: Record<string, LookState>) => void;
}

const Bar = ({ k, warn }: { k: number; warn?: boolean }) => (
  <div className="h-2 w-full overflow-hidden rounded bg-surface"><div className={`h-full ${warn ? "bg-destructive" : k < 0.2 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%` }} /></div>
);

export function ShowMonitor(p: Props) {
  const [volts, setVolts] = useState(230);
  const [limit, setLimit] = useState(16);
  const rdm = useMemo(() => (p.open ? loadRdmSnapshots() : []), [p.open]);
  const packs = p.fixtures.filter((f) => f.power && f.power.kind !== "mains").map((f) => ({ f, s: batteryStatus(f.power!, f, p.level) })).sort((a, b) => a.s.pct - b.s.pct);
  const rdmBat = rdm.flatMap((s) => s.devices.filter((d) => d.battery).map((d) => ({ s, d })));
  const loads = phaseLoads(p.fixtures, p.phases, fixtureWattage, p.level, volts);
  const parkedList = p.fixtures.filter((f) => p.parked[f.uid]);
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Monitor</DialogTitle></DialogHeader>
        <Tabs defaultValue="bat">
          <TabsList><TabsTrigger value="bat">Batteries</TabsTrigger><TabsTrigger value="phase">Phases L1/L2/L3</TabsTrigger><TabsTrigger value="park">Parked ({parkedList.length})</TabsTrigger></TabsList>

          <TabsContent value="bat" className="space-y-3">
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Reported by the lights (RDM)</h3>
              {rdmBat.length ? rdmBat.map(({ s, d }) => {
                const pct = d.battery!.unit === "%" ? d.battery!.value / 100 : null;
                return (
                  <div key={s.universe + d.uid} className="grid grid-cols-[1fr_6rem_8rem] items-center gap-2 py-1 text-xs">
                    <span className="truncate">{d.label || d.model} <span className="text-muted-foreground">U{s.universe} · {d.address}</span></span>
                    <span className="font-mono">{d.battery!.value}{d.battery!.unit}</span>
                    {pct != null ? <Bar k={pct} warn={pct < 0.1} /> : <span />}
                  </div>
                );
              }) : <p className="text-xs text-muted-foreground">No readings yet. In PATCH → More sources → RDM, scan a universe; the battery levels then show here.</p>}
              {rdm.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Last scan: {new Date(Math.max(...rdm.map((s) => s.at))).toLocaleTimeString()}</p>}
            </section>
            <section>
              <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Estimated (V-mount / Instagrid set on the light)</h3>
              {packs.length ? packs.map(({ f, s }) => (
                <div key={f.uid} className="grid grid-cols-[1fr_6rem_8rem] items-center gap-2 py-1 text-xs">
                  <span className="truncate">{f.name}</span>
                  <span className="font-mono">{Math.round(s.pct * 100)}% · {fmtHours(s.hours)}</span>
                  <Bar k={s.pct} warn={s.pct < 0.1} />
                </div>
              )) : <p className="text-xs text-muted-foreground">No lights have a battery set.</p>}
            </section>
          </TabsContent>

          <TabsContent value="phase" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label>Voltage <input type="number" value={volts} onChange={(e) => setVolts(+e.target.value || 230)} className="w-16 rounded border border-input bg-surface px-1" /> V</label>
              <label>Breaker <input type="number" value={limit} onChange={(e) => setLimit(+e.target.value || 16)} className="w-14 rounded border border-input bg-surface px-1" /> A</label>
              <Button size="sm" variant="secondary" onClick={() => p.setPhases(autoBalance(p.fixtures, fixtureWattage))}>Auto balance</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((ph) => {
                const l = loads[ph]; const over = l.amps > limit;
                return (
                  <div key={ph} className={`rounded-lg p-2 ${over ? "bg-destructive/20 ring-1 ring-destructive" : "bg-surface-elevated"}`}>
                    <div className="text-sm font-black">L{ph}</div>
                    <div className="font-mono text-lg">{l.amps.toFixed(1)} A</div>
                    <div className="text-[10px] text-muted-foreground">{Math.round(l.watts)} W now · {Math.round(l.fullWatts)} W at full · {l.count} lights</div>
                    <Bar k={l.amps / limit} warn={over} />
                  </div>
                );
              })}
            </div>
            {loads[0].count > 0 && <p className="text-xs text-warning">{loads[0].count} lights have no phase ({Math.round(loads[0].watts)} W now).</p>}
            <div className="space-y-0.5">
              {p.fixtures.map((f) => (
                <div key={f.uid} className="grid grid-cols-[1fr_4rem_auto] items-center gap-2 text-xs">
                  <span className="truncate">{f.name}</span>
                  <span className="font-mono text-muted-foreground">{fixtureWattage(f) || "?"} W</span>
                  <div className="flex gap-0.5">
                    {([1, 2, 3] as const).map((ph) => (
                      <button key={ph} aria-pressed={p.phases[f.uid] === ph} onClick={() => p.setPhases({ ...p.phases, [f.uid]: ph })}
                        className={`w-8 rounded px-1 py-0.5 font-bold ${p.phases[f.uid] === ph ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>L{ph}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Lights with unknown wattage count as 0 W.</p>
          </TabsContent>

          <TabsContent value="park" className="space-y-2">
            <p className="text-xs text-muted-foreground">Parked lights stay at a fixed level whatever cues, faders or effects do. Park from the FIXTURES bar.</p>
            {parkedList.map((f) => (
              <div key={f.uid} className="flex items-center justify-between rounded bg-surface-elevated px-2 py-1 text-xs">
                <span>{f.name} <span className="font-mono text-muted-foreground">{Math.round((p.parked[f.uid]!.intensity ?? 0) * 100)}%</span></span>
                <Button size="sm" variant="secondary" onClick={() => { const n = { ...p.parked }; delete n[f.uid]; p.setParked(n); }}>Unpark</Button>
              </div>
            ))}
            {parkedList.length > 0 && <Button variant="secondary" onClick={() => p.setParked({})}>Unpark all</Button>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
