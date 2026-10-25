import { MAX_UNIVERSE } from "@/lib/dmx";
import { Plus, X, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "./NumberField";
import type { Connection, UniverseRoute } from "@/lib/store";

/** PATCH panel: each universe can go to its own transmitter IP, switchable on/off; plus Hold Last State. */
export function TransmitterRoutes({ conn, setConn, universes }: { conn: Connection; setConn: (c: Connection) => void; universes: number[] }) {
  const routes = conn.routes ?? [];
  const put = (r: UniverseRoute[]) => setConn({ ...conn, routes: r });
  const patch = (id: string, p: Partial<UniverseRoute>) => put(routes.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const next = universes.find((u) => !routes.some((r) => r.universe === u)) ?? (Math.max(0, ...routes.map((r) => r.universe)) + 1);
  return (
    <section aria-label="Transmitters" className="space-y-2 rounded-lg border border-border p-3 text-xs">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4" /><span className="font-semibold">Transmitters</span>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => put([...routes, { id: crypto.randomUUID(), universe: Math.min(MAX_UNIVERSE, next), ip: conn.node?.ip ?? "", enabled: true }])}><Plus />Universe</Button>
      </div>
      {!routes.length && <p className="text-muted-foreground">All universes go to {conn.node ? `${conn.node.name} (${conn.node.ip})` : "the connected transmitter"}. Add a route to send a universe to another IP.</p>}
      {routes.map((r) => (
        <div key={r.id} className={`flex items-center gap-1.5 ${r.enabled ? "" : "opacity-50"}`}>
          <Checkbox checked={r.enabled} onCheckedChange={(c) => patch(r.id, { enabled: c === true })} aria-label={`Send universe ${r.universe}`} />
          <span>U</span>
          <NumberField integer min={1} max={MAX_UNIVERSE} value={r.universe} onChange={(v) => { if (v !== undefined) patch(r.id, { universe: v }); }} aria-label="Universe" className="w-12 rounded border border-input bg-surface-elevated px-1.5 py-1" />
          <input value={r.ip} onChange={(e) => patch(r.id, { ip: e.target.value.trim() })} placeholder="2.0.0.10" aria-label={`IP for universe ${r.universe}`} className="min-w-0 flex-1 rounded border border-input bg-surface-elevated px-2 py-1 font-mono" />
          <input value={r.name ?? ""} onChange={(e) => patch(r.id, { name: e.target.value })} placeholder="Name" aria-label="Transmitter name" className="w-24 rounded border border-input bg-surface-elevated px-2 py-1" />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove route" onClick={() => put(routes.filter((x) => x.id !== r.id))}><X /></Button>
        </div>
      ))}
      <label className="flex items-start gap-2 border-t border-border pt-2">
        <Checkbox checked={conn.holdLast !== false} onCheckedChange={(c) => setConn({ ...conn, holdLast: c === true })} />
        <span><b>Hold Last State</b><span className="block text-muted-foreground">If the iPad or network drops, lights stay on their last look; output resumes as soon as the link is back.</span></span>
      </label>
    </section>
  );
}
