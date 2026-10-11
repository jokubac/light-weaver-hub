// Project / scene state with localStorage persistence.

import { normalizeFixture, type PatchedFixture } from "./dmx";
import type { PixelLayer, PixelMap } from "./pixels";

export interface Scene {
  id: string;
  name: string;
  createdAt: number;
  fixtures: PatchedFixture[];
  master: number;
  pixelMap?: PixelMap; // legacy single layer
  pixelLayers?: PixelLayer[];
}

/** A saved snapshot of fixture settings, recallable from any scene in the project. */
export type LookState = Pick<PatchedFixture, "intensity" | "cct" | "gm" | "hue" | "saturation" | "crossfade" | "cctOnly" | "fx" | "on" | "fxPlaying" | "fan" | "gel">;
export interface Look {
  id: string;
  name: string;
  createdAt: number;
  states: { uid: string; name: string; state: LookState }[];
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  scenes: Scene[];
  looks?: Look[];
}

export const PROJECT_COLORS = ["#00E5FF", "#00E676", "#FFEA00", "#FF9100", "#FF3D00", "#F50057", "#D500F9", "#651FFF", "#2979FF", "#BDBDBD"];

const KEY = "crmx-console-projects-v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ps = JSON.parse(raw) as Project[];
      return ps.map((p) => ({
        ...p,
        scenes: p.scenes.map((s) => ({ ...s, fixtures: s.fixtures.map((f) => normalizeFixture(f as never)) })),
      }));
    }
  } catch {
    // corrupted storage — start fresh
  }
  return [];
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ---------------- Output connection ---------------- */

export interface Connection {
  network: "wifi" | "ethernet";
  protocol: "artnet" | "sacn";
  bridge: string; // address of the local bridge that sends UDP
  node: { name: string; ip: string } | null;
}

const CKEY = "crmx-console-connection-v1";
export const defaultConnection = (): Connection => ({ network: "wifi", protocol: "artnet", bridge: "localhost:8765", node: null });
export function loadConnection(): Connection {
  try { const r = localStorage.getItem(CKEY); if (r) return { ...defaultConnection(), ...JSON.parse(r) }; } catch { /* ignore */ }
  return defaultConnection();
}
export function saveConnection(c: Connection) { localStorage.setItem(CKEY, JSON.stringify(c)); }
