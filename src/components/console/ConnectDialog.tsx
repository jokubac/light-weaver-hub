import { useState } from "react";
import { Wifi, Cable, Radar, Loader2, Check, Plus, Download } from "lucide-react";
import type { BridgeStatus } from "@/lib/output";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Connection } from "@/lib/store";
import { TRANSMITTERS, getTransmitter } from "@/lib/transmitters";

interface Node { name: string; ip: string; universes?: number }

/**
 * Browsers cannot send Art-Net / sACN UDP directly, so scanning goes through a small
 * bridge app on the same network that exposes GET http://<bridge>/nodes and forwards DMX.
 */
export function ConnectDialog({ open, onOpenChange, conn, setConn, status }: { open: boolean; onOpenChange: (o: boolean) => void; conn: Connection; setConn: (c: Connection) => void; status: BridgeStatus }) {
  const [scanning, setScanning] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const scan = async () => {
    setScanning(true); setMsg(null); setNodes([]);
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`http://${conn.bridge}/nodes?net=${conn.network}&proto=${conn.protocol}`, { signal: ctrl.signal });
      clearTimeout(to);
      const list = (await res.json()) as Node[];
      setNodes(list);
      if (!list.length) setMsg("Bridge found, but no transmitters answered the Art-Net poll.");
    } catch {
      setMsg(`No bridge found at ${conn.bridge}. A browser can't send Art-Net by itself — a small bridge app on a laptop or Raspberry Pi on the same ${conn.network === "wifi" ? "Wi-Fi" : "Ethernet"} network is needed. You can still enter the transmitter IP manually.`);
    } finally {
      setScanning(false);
    }
  };

  const pick = (n: Node) => {
    // auto-detect the transmitter model from the name it reports in the Art-Net reply
    const hit = TRANSMITTERS.find((t) => n.name.toLowerCase().includes(t.model.toLowerCase().split(" ")[0]!) && n.name.toLowerCase().includes(t.brand.toLowerCase().split(" ")[0]!));
    setConn({ ...conn, node: { name: n.name, ip: n.ip }, transmitter: hit?.id ?? conn.transmitter });
  };
  const tx = getTransmitter(conn.transmitter ?? undefined);
  const opt = (active: boolean) => `flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Connect to transmitter</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
            <div className="font-semibold">1. Run the bridge on a laptop on the transmitter's network</div>
            <a href="/crmx-bridge.mjs" download className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground"><Download className="h-3.5 w-3.5" />Download bridge</a>
            <p className="text-muted-foreground">Install Node.js (nodejs.org), then in Terminal: <code className="rounded bg-surface-elevated px-1 font-mono">node crmx-bridge.mjs</code>. Open this console on the same laptop and keep the bridge address as <span className="font-mono">localhost:8765</span>.</p>
            <div className="font-semibold">2. Scan and pick your CRMX transmitter</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConn({ ...conn, network: "wifi" })} className={opt(conn.network === "wifi")}><Wifi className="h-4 w-4" />Wireless</button>
            <button onClick={() => setConn({ ...conn, network: "ethernet" })} className={opt(conn.network === "ethernet")}><Cable className="h-4 w-4" />Ethernet</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConn({ ...conn, protocol: "artnet" })} className={opt(conn.protocol === "artnet")}>Art-Net</button>
            <button onClick={() => setConn({ ...conn, protocol: "sacn" })} className={opt(conn.protocol === "sacn")}>sACN</button>
          </div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bridge address
            <input value={conn.bridge} onChange={(e) => setConn({ ...conn, bridge: e.target.value.trim() })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 font-mono text-sm text-foreground" />
          </label>
          <button onClick={scan} disabled={scanning} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-glow py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}{scanning ? "Scanning…" : `Scan for ${conn.protocol === "artnet" ? "Art-Net" : "sACN"} devices`}
          </button>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          {nodes.map((n) => (
            <button key={n.ip} onClick={() => pick(n)} className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2.5 text-left text-sm">
              <span><span className="block font-semibold">{n.name}</span><span className="font-mono text-[11px] text-muted-foreground">{n.ip}</span></span>
              {conn.node?.ip === n.ip && <Check className="h-4 w-4 text-success" />}
            </button>
          ))}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { pick({ name: "Manual transmitter", ip: manual.trim() }); setManual(""); } }}>
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Transmitter IP, e.g. 2.0.0.10" className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 font-mono text-sm" />
            <button type="submit" className="flex items-center gap-1 rounded-md bg-surface-elevated px-3 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add</button>
          </form>
          {conn.node && (
            <div className="flex items-center justify-between rounded-lg border border-success/50 px-3 py-2 text-sm">
              <span><Check className="mr-1 inline h-4 w-4 text-success" />{conn.node.name} <span className="font-mono text-xs text-muted-foreground">{conn.node.ip}</span></span>
              <span className={`text-[11px] ${status === "error" ? "text-destructive" : "text-success"}`}>{status === "error" ? "bridge not answering" : status === "ok" ? "sending" : ""}</span>
              <button onClick={() => setConn({ ...conn, node: null })} className="text-xs text-destructive">Disconnect</button>
            </div>
          )}
          <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
            <div className="font-semibold">Transmitter model</div>
            <select value={conn.transmitter ?? ""} onChange={(e) => setConn({ ...conn, transmitter: e.target.value || null })} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm">
              <option value="">Not set</option>
              {TRANSMITTERS.map((t) => <option key={t.id} value={t.id}>{t.brand} {t.model} · {t.universes} univ.</option>)}
            </select>
            {tx && <p className="text-muted-foreground">{tx.universes} universe{tx.universes > 1 ? "s" : ""} · {tx.radio.join(", ")} · {tx.protocols.map((p) => (p === "artnet" ? "Art-Net" : "sACN")).join(" / ")} · starts at Art-Net {tx.artnetStart} / sACN {tx.sacnStart} · colour order {tx.order}</p>}
            <label className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-2 font-semibold">
              Auto-set universes & channel order
              <input type="checkbox" checked={conn.autoMap} onChange={(e) => setConn({ ...conn, autoMap: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
            </label>
            <p className="text-muted-foreground">{conn.autoMap ? "Universe 1 in the app goes to the transmitter's first input, colours are sent in its order, extra universes it can't carry are skipped." : "Off: universes and RGB order are sent exactly as patched."}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
