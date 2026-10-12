// Client helper for the bridge's /rdm scan endpoint (see public/crmx-bridge.mjs).
export interface RdmDevice {
  uid: string;
  manufacturer: string;
  model: string;
  footprint: number;
  address: number;
  personality: number;
}

/** Scans one Art-Net node for RDM responders via the local bridge. Times out after ~6s. */
export async function scanRdm(bridge: string, nodeIp: string, universe: number, timeoutMs = 6000): Promise<RdmDevice[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `http://${bridge}/rdm?ip=${encodeURIComponent(nodeIp)}&universe=${universe}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`RDM scan failed (${res.status})`);
    const data = (await res.json()) as RdmDevice[];
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}
