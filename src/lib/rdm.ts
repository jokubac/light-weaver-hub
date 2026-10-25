// Client helper for the bridge's RDM endpoints (see public/crmx-bridge.mjs): scan one universe, then SET values.
export interface RdmPersonality { n: number; footprint: number; name: string }
export interface RdmBattery { value: number; unit: string; label: string }
export interface RdmDevice {
  uid: string;
  manufacturer: string;
  model: string;
  label?: string;
  footprint: number;
  address: number;
  personality: number;
  personalities?: RdmPersonality[];
  /** null when the light does not report a battery sensor over RDM */
  battery?: RdmBattery | null;
}

/** E1.20 parameter IDs the app can SET. */
export const RDM_PID = { address: 0x00f0, personality: 0x00e0, label: 0x0082, identify: 0x1000 } as const;

/** Parameter data bytes for each SET, per ANSI E1.20. */
export const rdmData = {
  address: (a: number) => { const v = Math.max(1, Math.min(512, Math.round(a))); return [v >> 8, v & 0xff]; },
  personality: (n: number) => [Math.max(1, Math.min(255, Math.round(n)))],
  identify: (on: boolean) => [on ? 1 : 0],
  label: (s: string) => [...s.slice(0, 32)].map((c) => c.charCodeAt(0) & 0x7f),
};

/** Scans one Art-Net node universe for RDM responders via the local bridge. */
export async function scanRdm(bridge: string, nodeIp: string, universe: number, timeoutMs = 30000): Promise<RdmDevice[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${bridge}/rdm?ip=${encodeURIComponent(nodeIp)}&universe=${universe}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`RDM scan failed (${res.status})`);
    const data = (await res.json()) as RdmDevice[];
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one RDM SET and returns the device as re-read afterwards (null if the bridge could not re-read it). */
export async function setRdm(bridge: string, nodeIp: string, universe: number, uid: string, pid: number, data: number[]): Promise<RdmDevice | null> {
  const res = await fetch(`http://${bridge}/rdm/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip: nodeIp, universe, uid, pid, data }) });
  if (res.status === 409) throw new Error("The light refused this change.");
  if (!res.ok) throw new Error(`RDM change failed (${res.status})`);
  return (await res.json()) as RdmDevice | null;
}

/** Last RDM scan per universe, kept so the battery panel can list every light in one place. */
const RDM_KEY = "nox-rdm-last";
export interface RdmSnapshot { universe: number; at: number; devices: RdmDevice[] }
export function rememberRdm(universe: number, devices: RdmDevice[]) {
  try {
    const all = loadRdmSnapshots().filter((s) => s.universe !== universe);
    localStorage.setItem(RDM_KEY, JSON.stringify([...all, { universe, at: Date.now(), devices }]));
  } catch { /* storage full or unavailable */ }
}
export function loadRdmSnapshots(): RdmSnapshot[] {
  try { const v = JSON.parse(localStorage.getItem(RDM_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
