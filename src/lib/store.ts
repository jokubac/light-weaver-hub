// Project / scene state with localStorage persistence.

import { normalizeFixture, type PatchedFixture } from "./dmx";
import type { PixelLayer, PixelMap } from "./pixels";

export interface Scene {
  id: string;
  name: string;
  /** Accent colour for this scene's own listings; falls back to the project colour. */
  color?: string;
  createdAt: number;
  fixtures: PatchedFixture[];
  master: number;
  pixelMap?: PixelMap; // legacy single layer
  pixelLayers?: PixelLayer[];
  pixelMaster?: number;
  plot?: import("@/components/console/PlotPanel").Plot;
  grid?: import("@/components/console/GridBoard").GridLayout;
  timeline?: import("./timeline").Timeline;
}

/** A scene shows the accent picked for it; when none was picked it uses the project's colour. */
export function sceneColor(scene: { color?: string | undefined }, project: { color: string }): string {
  return scene.color ?? project.color;
}

/** A saved snapshot of fixture settings, recallable from any scene in the project. */
export type LookState = Pick<PatchedFixture, "intensity" | "cct" | "gm" | "hue" | "saturation" | "crossfade" | "cctOnly" | "fx" | "on" | "fxPlaying" | "fan" | "gel" | "beam">;
export interface Look {
  id: string;
  name: string;
  createdAt: number;
  color?: string;
  states: { uid: string; name: string; state: LookState }[];
}

/** One step of a REC sequence: fixture states plus timing in seconds. */
export interface RecStep {
  id: string;
  name: string;
  states: { uid: string; name: string; state: LookState }[];
  fadeIn: number;
  hold: number;
  fadeOut: number;
  /** pixel layers active at this cue; applied when the cue starts */
  pixels?: import("./pixels").PixelLayer[];
  /** cue waits for a manual GO before it starts */
  manual?: boolean;
  /** seconds this cue starts before the previous one ends (cross-dissolve, like stacked clips) */
  overlap?: number | undefined;
  /** playback-only corrections applied on top of the recorded states */
  tweak?: StepTweak | undefined;
  /** how overlapping cues merge colours: forward round the hue wheel or additive light */
  mixMode?: "hue" | "add" | undefined;
}
export interface StepTweak {
  intensity?: number | undefined; // multiplier, 1 = as recorded
  cct?: number | undefined; // normalised CCT offset (-1..1)
  fxSpeed?: number | undefined; // effect rate multiplier
  fxSize?: number | undefined; // effect depth multiplier
  pixelSpeed?: number | undefined; // pixel layer speed multiplier
}
export interface Recording {
  id: string;
  name: string;
  createdAt: number;
  loop?: boolean;
  steps: RecStep[];
}

/** A playback / submaster fader. Group & fixture faders scale intensity (default 1); look faders crossfade into the look (default 0). */
export interface BankFader {
  id: string;
  name: string;
  kind: "group" | "look" | "fixtures";
  ref?: string; // group name or look id
  uids?: string[]; // for kind "fixtures"
  level: number;
}

/** A theatre-style cue: full fixture states plus fade time, fired with GO. */
export interface Cue {
  id: string;
  number: number;
  name: string;
  note?: string;
  fade: number;
  states: { uid: string; name: string; state: LookState }[];
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  scenes: Scene[];
  looks?: Look[];
  setups?: Scene[]; // named, complete scene snapshots shared within this project
  recordings?: Recording[];
  bank?: BankFader[];
  cues?: Cue[];
  callSheet?: CallSheetData;
}

/** Saved call sheet / equipment list state for a project. */
export interface CallSheetData {
  production?: string; date?: string; location?: string; gaffer?: string; shiftHours?: number;
  qty?: Record<string, number>; removed?: string[];
  custom?: { id: string; label: string; group: string; qty: number }[];
  packed?: Record<string, number>; returned?: Record<string, number>;
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
  transmitter: string | null; // id from the transmitter library
  autoMap: boolean; // auto universe numbering + colour channel order from the transmitter profile
  transport?: "bridge" | "direct" | "bluetooth";
  bluetoothUniverse?: number;
}

const CKEY = "crmx-console-connection-v1";
export const defaultConnection = (): Connection => ({ network: "wifi", protocol: "artnet", bridge: "localhost:8765", node: null, transmitter: null, autoMap: true });
export function loadConnection(): Connection {
  try { const r = localStorage.getItem(CKEY); if (r) return { ...defaultConnection(), ...JSON.parse(r) }; } catch { /* ignore */ }
  return defaultConnection();
}
export function saveConnection(c: Connection) { localStorage.setItem(CKEY, JSON.stringify(c)); }
