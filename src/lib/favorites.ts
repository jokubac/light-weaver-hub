// Favourites (gels, fixture models) saved in localStorage and shared across all projects.
import { useEffect, useState } from "react";

export type FavKind = "gels" | "fixtures";
const KEY = "crmx-console-favorites-v1";
const EVT = "crmx-favorites";

function read(): Record<FavKind, string[]> {
  try { const r = localStorage.getItem(KEY); if (r) return { gels: [], fixtures: [], ...JSON.parse(r) }; } catch { /* ignore */ }
  return { gels: [], fixtures: [] };
}

export function useFavorites(kind: FavKind) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setList(read()[kind]);
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, [kind]);
  const toggle = (id: string) => {
    const all = read();
    all[kind] = all[kind].includes(id) ? all[kind].filter((x) => x !== id) : [...all[kind], id];
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(EVT));
  };
  return { list, has: (id: string) => list.includes(id), toggle };
}
