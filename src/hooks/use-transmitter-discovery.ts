import { useEffect, useRef, useState } from "react";
import { isNativeApp, scanArtNet } from "@/lib/native-udp";
import type { Connection } from "@/lib/store";

export interface DiscoveredNode { name: string; ip: string; universes?: number }

/** Discovery never connects or replaces a manually selected output destination. */
export function useTransmitterDiscovery(conn: Connection) {
  const [nodes, setNodes] = useState<DiscoveredNode[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const current = useRef(conn);
  current.current = conn;
  const scan = async () => {
    if (busy.current || current.current.transport === "bluetooth") return;
    busy.current = true; setScanning(true);
    const connection = current.current;
    try {
      let list: DiscoveredNode[];
      if (isNativeApp() && connection.transport !== "bridge") list = await scanArtNet();
      else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(`http://${connection.bridge}/nodes?net=${connection.network}&proto=artnet`, { signal: controller.signal });
          if (!response.ok) throw new Error("Bridge discovery failed");
          list = await response.json();
        } finally { clearTimeout(timeout); }
      }
      setNodes(list); setError(null);
    } catch { setError("No discovery response — check the network or enter the transmitter IP."); }
    finally { busy.current = false; setScanning(false); }
  };
  useEffect(() => {
    setNodes([]);
    void scan();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void scan(); }, 15000);
    return () => clearInterval(timer);
    // Scan reads current connection through a ref; no output-state dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.transport, conn.bridge, conn.network]);
  return { nodes, scanning, error, scan };
}