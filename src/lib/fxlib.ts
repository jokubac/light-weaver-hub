// Saved (programmed) effects: fixture effects and pixel layers, shared across all projects.
import { useEffect, useState } from "react";
import type { FxParams } from "./dmx";
import type { PixelLayer } from "./pixels";

export interface SavedFx { id: string; name: string; createdAt: number; fx: FxParams }
export interface SavedPixel { id: string; name: string; createdAt: number; layer: PixelLayer }
export interface FxLibrary { fx: SavedFx[]; pixel: SavedPixel[] }

export const FXLIB_KEY = "crmx-console-effects-v1";
export const FXLIB_EVT = "crmx-effects";

export function readFxLib(): FxLibrary {
  try { const r = localStorage.getItem(FXLIB_KEY); if (r) return { fx: [], pixel: [], ...JSON.parse(r) }; } catch { /* ignore */ }
  return { fx: [], pixel: [] };
}
export function writeFxLib(lib: FxLibrary, silent = false) {
  localStorage.setItem(FXLIB_KEY, JSON.stringify(lib));
  window.dispatchEvent(new CustomEvent(FXLIB_EVT, { detail: { silent } }));
}
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function useFxLibrary() {
  const [lib, setLib] = useState<FxLibrary>({ fx: [], pixel: [] });
  useEffect(() => {
    const sync = () => setLib(readFxLib());
    sync();
    window.addEventListener(FXLIB_EVT, sync);
    return () => window.removeEventListener(FXLIB_EVT, sync);
  }, []);
  return {
    lib,
    saveFx: (name: string, fx: FxParams) => { const l = readFxLib(); writeFxLib({ ...l, fx: [{ id: id(), name, createdAt: Date.now(), fx: structuredClone(fx) }, ...l.fx] }); },
    savePixel: (name: string, layer: PixelLayer) => { const l = readFxLib(); writeFxLib({ ...l, pixel: [{ id: id(), name, createdAt: Date.now(), layer: structuredClone(layer) }, ...l.pixel] }); },
    remove: (kind: "fx" | "pixel", rid: string) => { const l = readFxLib(); writeFxLib({ ...l, [kind]: (l[kind] as { id: string }[]).filter((x) => x.id !== rid) } as FxLibrary); },
  };
}
