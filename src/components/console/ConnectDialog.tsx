import { MAX_UNIVERSE } from "@/lib/dmx";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Wifi, Cable, Radar, Loader2, Check, Plus, Download, Smartphone, Router, Bluetooth, X, RefreshCw } from "lucide-react";
import type { BridgeStatus } from "@/lib/output";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Connection } from "@/lib/store";
import { detectTransmitter } from "@/lib/transmitters";
import { isNativeApp } from "@/lib/native-udp";
import { Button } from "@/components/ui/button";
import { NumberField } from "./NumberField";
import { connectMoonLite, disconnectMoonLite, reconnectMoonLite, moonliteRoutes, moonLiteStatus, moonLiteVersion, subscribeMoonLite } from "@/lib/moonlite";
import type { DiscoveredNode } from "@/hooks/use-transmitter-discovery";
import { TransmitterRoutes } from "./TransmitterRoutes";


import { t as tr } from "@/lib/i18n";
interface Node { name: string; ip: string; universes?: number | undefined }

/**
 * Browsers cannot send Art-Net / sACN UDP directly, so scanning goes through a small
 * bridge app on the same network that exposes GET http://<bridge>/nodes and forwards DMX.
 * The installed app (Android/iOS) can instead send UDP straight from the tablet.
 */
export function ConnectDialog({ open, onOpenChange, conn, setConn, status, discovery, universes = [] }: { open: boolean; onOpenChange: (o: boolean) => void; conn: Connection; setConn: (c: Connection) => void; status: BridgeStatus; discovery: { nodes: DiscoveredNode[]; scanning: boolean; error: string | null; scan: () => Promise<void> }; universes?: number[] }) {
  const { scanning, nodes, scan } = discovery;
  const [pairing, setPairing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const latest = useRef(conn);
  latest.current = conn;
  useSyncExternalStore(subscribeMoonLite, moonLiteVersion, () => 0);
  const bleRoutes = moonliteRoutes(conn);

  const native = isNativeApp();
  const direct = conn.transport === "direct" && native;

  // Default to direct when running in the installed app, bridge otherwise.
  useEffect(() => {
    if (!conn.transport) setConn({ ...conn, transport: native ? "direct" : "bridge" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search Wi-Fi/network straight away whenever the window opens; IP entry is only a fallback.
  useEffect(() => {
    if (open && conn.transport !== "bluetooth" && !scanning) void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pair = async () => {
    setPairing(true); setMsg(null);
    try {
      const node = await connectMoonLite();
      const current = latest.current;
      // One MoonLite at a time — several concurrent BLE links make output lag.
      // Keep the Wi-Fi transport untouched so both can send together.
      const universe = moonliteRoutes(current)[0]?.universe ?? 1;
      setConn({ ...current, bluetoothRoutes: [{ id: node.ip, name: node.name, universe }] });
    }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not connect to MoonLite"); }
    finally { setPairing(false); }
  };

  const removeBle = (id: string) => {
    void disconnectMoonLite(id).catch((e) => setMsg(e instanceof Error ? e.message : tr("Bluetooth send failed")));
    const current = latest.current;
    setConn({ ...current, bluetoothRoutes: moonliteRoutes(current).filter((r) => r.id !== id) });
  };
  const reconnect = async (id: string) => {
    setPairing(true); setMsg(null);
    try { await reconnectMoonLite(id); }
    catch (e) { setMsg(e instanceof Error ? e.message : tr("Bluetooth send failed")); }
    finally { setPairing(false); }
  };

  const pick = (n: Node) => {
    // auto-detect the transmitter model from the name it reports in the Art-Net reply
    const hit = detectTransmitter(n.name, n.universes);
    setConn({ ...conn, node: { name: n.name, ip: n.ip }, transmitter: hit?.id ?? conn.transmitter });
  };

  const opt = (active: boolean) => `flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>{tr("Connect to transmitter")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => setConn({ ...conn, transport: "direct" })} disabled={!native} className={`${opt(!!direct)} h-auto whitespace-normal disabled:opacity-40`}>
              <Smartphone className="h-4 w-4" />{tr("Direct")}</Button>
            <Button onClick={() => setConn({ ...conn, transport: "bridge" })} className={`${opt(!direct && conn.transport !== "bluetooth")} h-auto whitespace-normal`}>
              <Router className="h-4 w-4" />{tr("Via bridge")}</Button>
          </div>
          <Button variant={conn.transport === "bluetooth" ? "default" : "secondary"} className="w-full" onClick={pair} disabled={pairing}><Bluetooth />{pairing ? tr("Connecting…") : bleRoutes.length ? tr("Replace MoonLite") : tr("Connect MoonLite via Bluetooth")}</Button>
          {bleRoutes.length > 0 && <div className="divide-y divide-border border-y border-border">
            {bleRoutes.map((route) => {
              const health = moonLiteStatus(route.id);
              return <div key={route.id} className="flex items-center gap-2 py-3">
                <Bluetooth className={`size-4 shrink-0 ${health === "ok" ? "text-success" : health === "error" ? "text-destructive" : "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" title={route.name}>{route.name}</div><div className={`text-[10px] ${health === "ok" ? "text-success" : "text-muted-foreground"}`}>{health === "ok" ? tr("Connected") : health === "error" ? tr("Bluetooth send failed") : tr("disconnected")}</div></div>
                <label className="flex shrink-0 items-center gap-1 text-xs font-semibold" title={tr("MoonLite universe")}>U<NumberField integer min={1} max={MAX_UNIVERSE} value={route.universe} onChange={(v) => { if (v !== undefined) { const current = latest.current; setConn({ ...current, bluetoothRoutes: moonliteRoutes(current).map((r) => r.id === route.id ? { ...r, universe: v } : r) }); } }} aria-label={`${tr("MoonLite universe")} · ${route.name}`} className="w-16 rounded border border-input bg-surface-elevated px-2 py-1 font-mono" /></label>
                <Button size="icon" variant="ghost" disabled={pairing} title={tr("Reconnect")} aria-label={`${tr("Reconnect")} · ${route.name}`} onClick={() => { void disconnectMoonLite(route.id).catch(() => {}).then(() => reconnect(route.id)); }}><RefreshCw className="size-4" /></Button>
                <Button size="icon" variant="ghost" title={tr("Remove")} aria-label={`${tr("Remove")} · ${route.name}`} onClick={() => removeBle(route.id)}><X className="size-4" /></Button>
              </div>;
            })}
          </div>}
          <div className="space-y-4">
          {!native && <p className="text-xs text-muted-foreground">{tr("Direct sending needs the installed NOX app — the browser can't send Art-Net/sACN UDP by itself.")}</p>}
          {!direct && (
            <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
              <div className="font-semibold">{tr("1. Run the bridge on a laptop on the transmitter's network")}</div>
              <a href="/crmx-bridge.mjs" download className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground"><Download className="h-3.5 w-3.5" />{tr("Download bridge")}</a>
              <p className="text-muted-foreground">{tr("Install Node.js (nodejs.org), then in Terminal:")}<code className="rounded bg-surface-elevated px-1 font-mono">{tr("node crmx-bridge.mjs")}</code>{tr(". Open this console on the same laptop and keep the bridge address as")}<span className="font-mono">{tr("localhost:8765")}</span>.</p>
              <div className="font-semibold">{tr("2. Scan and pick your CRMX transmitter")}</div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setConn({ ...conn, network: "wifi" })} className={opt(conn.network === "wifi")}><Wifi className="h-4 w-4" />{tr("Wireless")}</button>
            <button onClick={() => setConn({ ...conn, network: "ethernet" })} className={opt(conn.network === "ethernet")}><Cable className="h-4 w-4" />{tr("Ethernet")}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConn({ ...conn, protocol: "artnet" })} className={opt(conn.protocol === "artnet")}>{tr("Art-Net")}</button>
            <button onClick={() => setConn({ ...conn, protocol: "sacn" })} className={opt(conn.protocol === "sacn")}>{tr("sACN")}</button>
          </div>
          {!direct && (
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr("Bridge address")}<input value={conn.bridge} onChange={(e) => setConn({ ...conn, bridge: e.target.value.trim() })} className="w-full font-mono rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            </label>
          )}
          <button onClick={scan} disabled={scanning} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-glow py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}{scanning ? tr("Scanning…") : `Scan for ${conn.protocol === "artnet" ? "Art-Net" : "sACN"} devices`}
          </button>
          {discovery.error && <p className="text-xs text-muted-foreground">{discovery.error}</p>}
          {nodes.map((n) => (
            <button key={n.ip} onClick={() => pick(n)} className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2.5 text-left text-sm">
              <span><span className="block font-semibold">{n.name}{(() => { const hit = detectTransmitter(n.name, n.universes); return hit ? <span className="ml-1.5 text-[11px] font-normal text-success">· {hit.brand} {hit.model}</span> : null; })()}</span><span className="font-mono text-[11px] text-muted-foreground">{n.ip}</span></span>
              {conn.node?.ip === n.ip && <Check className="h-4 w-4 text-success" />}
            </button>
          ))}
          {!scanning && nodes.length === 0 && <p className="text-xs text-muted-foreground">{tr("No transmitters found yet. Check the tablet is on the transmitter's Wi-Fi, then scan again.")}</p>}
          <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">{tr("Enter IP manually")}</summary>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { pick({ name: "Manual transmitter", ip: manual.trim() }); setManual(""); } }}>
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={tr("Transmitter IP, e.g. 2.0.0.10")} className="min-w-0 flex-1 font-mono rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            <button type="submit" className="flex items-center gap-1 rounded-md bg-surface-elevated px-3 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />{tr("Add")}</button>
          </form></details>
          </div>
          <details className="text-xs"><summary className="cursor-pointer font-semibold uppercase tracking-wider text-muted-foreground">{tr("Advanced")}</summary>
            <div className="mt-2"><TransmitterRoutes conn={conn} setConn={setConn} universes={universes} /></div>
          </details>
          {msg && <p role="alert" className="text-xs text-destructive">{msg}</p>}

          {conn.node && conn.transport !== "bluetooth" && (
            <div className="flex items-center justify-between rounded-lg border border-success/50 px-3 py-2 text-sm">
              <span><Check className="mr-1 inline h-4 w-4 text-success" />{conn.node.name} <span className="font-mono text-xs text-muted-foreground">{conn.node.ip}</span></span>
              <span className={`text-[11px] ${status === "ok" ? "text-success" : status === "slow" ? "text-warning" : "text-destructive"}`}>{status === "error" ? (direct ? tr("send failed") : tr("bridge not answering")) : status === "slow" ? tr("slow response") : status === "ok" ? (direct ? tr("sending directly") : tr("sending to bridge")) : tr("disconnected")}</span>
              <Button variant="ghost" onClick={() => setConn({ ...conn, node: null })} className="text-xs text-destructive">{tr("Disconnect")}</Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
