// Favourites (gels, fixture models, fixture+mode pairs) saved in localStorage and shared across all projects.
import { useEffect, useState } from "react";

export type FavKind = "gels" | "fixtures" | "modes" | "manufacturers";
const KEY = "crmx-console-favorites-v1";
const EVT = "crmx-favorites";

function read(): Record<FavKind, string[]> {
  try { const r = localStorage.getItem(KEY); if (r) return { gels: [], fixtures: [], modes: [], manufacturers: [], ...JSON.parse(r) }; } catch { /* ignore */ }
  return { gels: [], fixtures: [], modes: [], manufacturers: [] };
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

/** Stable favourites-first ordering; unstarred items keep their existing order. */
export function favoritesFirst<T>(items: T[], isFavorite: (item: T) => boolean): T[] {
  return [...items.filter(isFavorite), ...items.filter((item) => !isFavorite(item))];
}
