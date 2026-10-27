import { MAX_UNIVERSE } from "@/lib/dmx";
import { useState } from "react";
import { BatteryMedium, Lightbulb, Radar } from "lucide-react";
import { NumberField } from "./NumberField";
import { RDM_PID, rdmData, rememberRdm, scanRdm, setRdm, type RdmDevice } from "@/lib/rdm";
import { loadConnection } from "@/lib/store";

import { t as tr } from "@/lib/i18n";
/** RDM on one universe: find lights (e.g. Astera via AsteraBox), change address/mode/name, identify, read battery. */
export function RdmManager({ onAdd }: { onAdd: (dev: RdmDevice, universe: number) => void }) {
  const [universe, setUniverse] = useState(1);
  const [devices, setDevices] = useState<RdmDevice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ident, setIdent] = useState<Set<string>>(new Set());

  const conn = () => { const c = loadConnection(); if (!c.node?.ip) throw new Error("Connect to the AsteraBox / node first (CONNECT)."); return { bridge: c.bridge, ip: c.node.ip }; };
  const scan = async () => {
    setBusy("scan"); setError(null);
    try { const c = conn(); const d = await scanRdm(c.bridge, c.ip, universe); setDevices(d); rememberRdm(universe, d); if (!d.length) setError("No RDM lights found on this universe."); }
    catch (e) { setError(e instanceof Error ? e.message : "Scan failed."); }
    finally { setBusy(null); }
  };
  const change = async (d: RdmDevice, pid: number, data: number[]) => {
    setBusy(d.uid); setError(null);
    try { const c = conn(); const nd = await setRdm(c.bridge, c.ip, universe, d.uid, pid, data); if (nd) setDevices((l) => { const n = l?.map((x) => (x.uid === d.uid ? nd : x)) ?? null; if (n) rememberRdm(universe, n); return n; }); }
    catch (e) { setError(e instanceof Error ? e.message : "Change failed."); }
    finally { setBusy(null); }
  };
  const toggleIdent = (d: RdmDevice) => { const on = !ident.has(d.uid); setIdent((s) => { const n = new Set(s); if (on) n.add(d.uid); else n.delete(d.uid); return n; }); void change(d, RDM_PID.identify, rdmData.identify(on)); };

  return (
    <div className="space-y-1.5 rounded-md bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <Radar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold">{tr("RDM")}</span>
        <span className="text-[10px] text-muted-foreground">{tr("Universe")}</span>
        <NumberField integer min={1} max={MAX_UNIVERSE} value={universe} onChange={(v) => v && setUniverse(v)} className="ml-auto w-14 rounded border border-input bg-surface-elevated px-1 text-[11px]" aria-label={tr("RDM universe")} />
        <button onClick={() => void scan()} disabled={!!busy} className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40">{busy === "scan" ? tr("Scanning…") : devices ? tr("Refresh") : tr("Scan")}</button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {devices?.map((d) => (
        <div key={d.uid} className={`space-y-1 rounded bg-surface-elevated p-1.5 text-[11px] ${busy === d.uid ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate font-semibold">{d.manufacturer} {d.model}</span>
            <span className="flex items-center gap-0.5 text-muted-foreground" title={d.battery?.label ?? "This light does not report its battery over RDM"}>
              <BatteryMedium className="h-3.5 w-3.5" />{d.battery ? `${d.battery.value}${d.battery.unit === "%" ? "%" : ` ${d.battery.unit}`}` : tr("—")}
            </span>
            <button onClick={() => toggleIdent(d)} aria-pressed={ident.has(d.uid)} aria-label={`Identify ${d.label || d.model}`} title={tr("Identify (flash the light)")} className="rounded bg-surface px-1.5 py-1"><Lightbulb className="h-3.5 w-3.5" /></button>
            <button onClick={() => onAdd(d, universe)} className="rounded bg-primary px-2 py-1 font-semibold text-primary-foreground">{tr("Add")}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input defaultValue={d.label ?? ""} key={`${d.uid}-${d.label}`} placeholder={tr("Name")} aria-label={`Name for ${d.model}`} maxLength={32}
              onBlur={(e) => { if (e.target.value !== (d.label ?? "")) void change(d, RDM_PID.label, rdmData.label(e.target.value)); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="min-w-0 flex-1 rounded border border-input bg-surface px-1 py-0.5" />
            <span className="text-muted-foreground">{tr("Addr")}</span>
            <NumberField integer min={1} max={512} value={d.address} onChange={(v) => v && v !== d.address && void change(d, RDM_PID.address, rdmData.address(v))} className="w-14 rounded border border-input bg-surface px-1" aria-label={`DMX address for ${d.model}`} />
            <span className="text-muted-foreground">{d.footprint}{tr("ch")}</span>
          </div>
          {!!d.personalities?.length && (
            <select value={d.personality} aria-label={`Mode for ${d.model}`} onChange={(e) => void change(d, RDM_PID.personality, rdmData.personality(+e.target.value))} className="w-full rounded border border-input bg-surface px-1 py-0.5">
              {d.personalities.map((p) => <option key={p.n} value={p.n}>{p.n}: {p.name || "Mode"}{p.footprint ? ` (${p.footprint}ch)` : tr("")}</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
