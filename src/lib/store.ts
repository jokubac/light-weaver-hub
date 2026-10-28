// Project / scene state with localStorage persistence.

import { normalizeFixture, type PatchedFixture } from "./dmx";
import type { PixelLayer, PixelMap } from "./pixels";
import type { Timeline } from "./timeline";

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
  kind: "group" | "look" | "fixtures" | "master" | "timeline" | "rec";
  ref?: string; // group name, look id or REC recording id
  uids?: string[]; // for kind "fixtures"
  level: number;
  /** what a group/selection fader drives; intensity scales, the rest set the value (last moved wins) */
  param?: "intensity" | "cct" | "hue" | "saturation" | "fxSpeed" | "fxSize" | "gm" | "pan" | "tilt" | "zoom" | "focus" | "iris" | "frost" | "strobe";
  /** seconds FULL/ZERO (and timeline/REC start/stop) take to reach the new level */
  fadeIn?: number | undefined;
  fadeOut?: number | undefined;
  /** response curve from fader travel to output */
  curve?: "linear" | "s" | "log" | "exp" | undefined;
  /** limiter: fader bottom/top map to these output levels (0..1) */
  min?: number | undefined;
  max?: number | undefined;
  /** up to two buttons under the fader */
  buttons?: ("flash" | "solo" | "onoff" | "full" | "zero")[];
  color?: "primary" | "success" | "warning" | "destructive" | "accent" | "muted";
  /** last time the fader moved — later wins (LTP) */
  touched?: number;
  /** switched off with the On/Off button */
  off?: boolean;
}

/** Stored fader positions keyed by fader id. */
export interface FaderSnap { id: string; name: string; levels: Record<string, number> }

/** A theatre-style cue: full fixture states plus fade time, fired with GO. */
export interface Cue {
  id: string;
  number: number;
  name: string;
  note?: string;
  fade: number;
  states: { uid: string; name: string; state: LookState }[];
  /** tracking (default) carries values forward; cue-only reverts them when the next cue runs */
  mode?: "track" | "cueonly" | undefined;
  /** MIDI timecode trigger, in seconds */
  tc?: number | undefined;
}

/** A timeline saved on its own, apart from the scene's working timeline. */
export interface TimelineSave {
  id: string;
  name: string;
  createdAt: number;
  timeline: Timeline;
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
  timelines?: TimelineSave[]; // named timeline saves, shared within this project
  bank?: BankFader[];
  /** saved fader positions, recalled with a fade */
  faderSnaps?: FaderSnap[];
  cues?: Cue[];
  /** parked lights held at a fixed output state, keyed by fixture uid */
  parked?: Record<string, LookState>;
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
  /** Per-universe transmitter routes; universes without a route go to `node`. */
  routes?: UniverseRoute[];
  /** Hold Last State: keep lights on the last frame when the console stops sending (default on). */
  holdLast?: boolean;
}
export interface UniverseRoute { id: string; universe: number; ip: string; name?: string; enabled: boolean }

const CKEY = "crmx-console-connection-v1";
export const defaultConnection = (): Connection => ({ network: "wifi", protocol: "artnet", bridge: "localhost:8765", node: null, transmitter: null, autoMap: true });
export function loadConnection(): Connection {
  try { const r = localStorage.getItem(CKEY); if (r) return { ...defaultConnection(), ...JSON.parse(r) }; } catch { /* ignore */ }
  return defaultConnection();
}
export function saveConnection(c: Connection) { localStorage.setItem(CKEY, JSON.stringify(c)); }
