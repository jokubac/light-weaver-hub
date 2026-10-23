// Pixel mapping engine: lays pixel fixtures out on one shared grid so effects flow
// from one fixture into the next, supports 2D fixtures (e.g. SkyPanel S360 4×3) and
// several independent layers playing at once.

import { getMode, hexToRgb, hsvToRgb, type PatchedFixture } from "./dmx";
import { generatorById, PIXEL_GENERATORS } from "./pixel-generators";
import { videoFrame } from "./pixel-media";

export type PixelFx =
  | "runner" | "chase" | "meteor" | "bounce" | "rainbow" | "wave" | "gradient" | "plasma"
  | "fire" | "sparkle" | "twinkle" | "strobe" | "police" | "solid" | "text" | "generator" | "video";

/** line = fixtures end-to-end in one long row; stack = horizontal fixtures stacked; upright = tubes standing side by side */
export type PixelLayout = "line" | "stack" | "upright" | "canvas";

export interface PixelLayer {
  id: string;
  name: string;
  /** effects sharing a group id form one layer (shared lights, play/pause); unset = its own layer */
  group?: string | undefined;
  playing: boolean;
  /** page/effect slot with no effect picked yet — renders nothing */
  empty?: boolean | undefined;
  /** frozen effect time (seconds, performance clock) while paused */
  pausedAt?: number | undefined;
  kind: PixelFx;
  colors: string[];
  /** Optional tint for generated-colour effects (rainbow, plasma, fire). */
  tint?: string;
  /** Opt-in so existing generated-colour effects retain their original look. */
  customPalette?: boolean;
  speed: number; // 0.001–100 multiplier
  size: number; // band width in pixels
  text: string;
  layout: PixelLayout;
  order: string[]; // fixture uids in layout order
  reverse: boolean;
  /** police: flashes per side (1 single, 2 double, 3 triple, 4 quad) */
  flashes?: number;
  /** police: alternate sides, both together, or slow wig-wag */
  policeMode?: "alternate" | "together" | "wigwag";
  /** runner: number of moving segments spread over the whole map */
  runners?: number;
  brightness?: number; // output gain 0–1
  background?: number; // minimum output 0–1
  softness?: number; // moving segment edge softness 0–1
  duty?: number; // strobe on-time fraction
  density?: number; // sparkle probability
  phase?: number; // time offset in effect units
  /** generator kind: id from PIXEL_GENERATORS */
  gen?: string;
  /** video kind: id of the clip stored on this device */
  videoId?: string;
  videoName?: string;
  /** canvas cells the effect covers; whole canvas when unset */
  area?: { x: number; y: number; w: number; h: number };
  /** effect rotation in degrees around the area centre */
  angle?: number;
  /** continuous rotation, degrees per second */
  spin?: number;
  /** recorded movement of the effect box: absolute x/y/angle at t seconds, looped over motionLen */
  motion?: { t: number; x: number; y: number; a: number }[];
  motionLen?: number;
}

/** Layer as it sits at time t: recorded motion and spin applied to area/angle. */
export function layerAt<L extends PixelLayer>(l: L, t: number): L {
  const m = l.motion;
  let x = l.area?.x, y = l.area?.y, a = l.angle ?? 0;
  if (m?.length) {
    const len = Math.max(0.05, l.motionLen ?? m[m.length - 1]!.t);
    const tt = ((t % len) + len) % len;
    let i = 0; while (i < m.length - 1 && m[i + 1]!.t <= tt) i++;
    const p = m[i]!, q = m[i + 1];
    const k = q && q.t > p.t ? (tt - p.t) / (q.t - p.t) : 0;
    x = p.x + ((q?.x ?? p.x) - p.x) * k; y = p.y + ((q?.y ?? p.y) - p.y) * k; a = p.a + ((q?.a ?? p.a) - p.a) * k;
  }
  a += (l.spin ?? 0) * t;
  if (!a && !m?.length) return l;
  return { ...l, angle: a, area: l.area && x != null && y != null ? { ...l.area, x, y } : l.area };
}

export const POLICE_FLASHES = [{ n: 1, l: "Single" }, { n: 2, l: "Double" }, { n: 3, l: "Triple" }, { n: 4, l: "Quad" }];

/** @deprecated single-layer format from older saves */
export interface PixelMap {
  playing: boolean; kind: PixelFx; colors: string[]; speed: number; size: number; text: string;
  vertical: boolean; order: string[]; reverse: boolean;
}

export const PIXEL_FX: { id: PixelFx; label: string }[] = [
  { id: "runner", label: "Runner" },
  { id: "chase", label: "Chase" },
  { id: "meteor", label: "Meteor" },
  { id: "bounce", label: "Bounce" },
  { id: "rainbow", label: "Rainbow" },
  { id: "wave", label: "Wave" },
  { id: "gradient", label: "Gradient" },
  { id: "plasma", label: "Plasma" },
  { id: "fire", label: "Fire" },
  { id: "sparkle", label: "Sparkle" },
  { id: "twinkle", label: "Twinkle" },
  { id: "strobe", label: "Strobe" },
  { id: "police", label: "Police" },
  { id: "solid", label: "Colour" },
  { id: "text", label: "Text" },
  { id: "generator", label: "Generators" },
  { id: "video", label: "Video" },
];

/** One library entry: built-in effect or generator. Each look appears once, sorted by group. */
export interface PixelLook { key: string; label: string; group: string; kind: PixelFx; gen?: string }
export const PIXEL_GROUPS = ["Chase", "Colour", "Fire", "Water", "Sky", "Nature", "Party", "Shapes", "Media"];
const BUILT_IN: PixelLook[] = [
  { key: "runner", label: "Runner", group: "Chase", kind: "runner" },
  { key: "chase", label: "Chase", group: "Chase", kind: "chase" },
  { key: "meteor", label: "Meteor", group: "Chase", kind: "meteor" },
  { key: "bounce", label: "Scanner", group: "Chase", kind: "bounce" },
  { key: "solid", label: "Colour", group: "Colour", kind: "solid" },
  { key: "rainbow", label: "Rainbow", group: "Colour", kind: "rainbow" },
  { key: "gradient", label: "Gradient", group: "Colour", kind: "gradient" },
  { key: "wave", label: "Wave", group: "Colour", kind: "wave" },
  { key: "plasma", label: "Plasma", group: "Colour", kind: "plasma" },
  { key: "twinkle", label: "Stars", group: "Sky", kind: "twinkle" },
  { key: "sparkle", label: "Sparkle", group: "Party", kind: "sparkle" },
  { key: "strobe", label: "Strobe", group: "Party", kind: "strobe" },
  { key: "police", label: "Police", group: "Party", kind: "police" },
  { key: "text", label: "Text", group: "Media", kind: "text" },
  { key: "video", label: "Video", group: "Media", kind: "video" },
];
export const PIXEL_LIBRARY: PixelLook[] = [...BUILT_IN, ...PIXEL_GENERATORS.map((g) => ({ key: `gen:${g.id}`, label: g.label, group: g.group, kind: "generator" as const, gen: g.id }))];
export const lookOf = (l: Pick<PixelLayer, "kind" | "gen">) =>
  PIXEL_LIBRARY.find((x) => x.kind === l.kind && (l.kind !== "generator" || x.gen === (l.gen ?? PIXEL_GENERATORS[0]!.id)));

const newId = () => Math.random().toString(36).slice(2, 10);

/** Copied effect settings: identity, name, order (which lights) and playing never travel. */
export type PixelEffectClipboard = Omit<PixelLayer, "id" | "name" | "playing" | "order">;

export function copyPixelEffect(l: PixelLayer): PixelEffectClipboard {
  const { id: _id, name: _name, playing: _playing, order: _order, ...rest } = l;
  return structuredClone(rest);
}

/** Paste onto an existing layer: keeps the layer's lights, replaces the effect. */
export function applyPixelEffect(layer: PixelLayer, clip: PixelEffectClipboard): PixelLayer {
  return normalizeLayer({ ...structuredClone(clip), id: layer.id, name: layer.name, playing: false, order: layer.order });
}

/** Paste as a new layer aimed at other lights, e.g. the ones selected in the console. */
export function pastePixelEffect(name: string, order: string[], clip: PixelEffectClipboard): PixelLayer {
  return normalizeLayer({ ...structuredClone(clip), id: newId(), name, playing: false, order });
}

/** localStorage key so a copied effect survives closing the app. */
export const PIXEL_EFFECT_CLIPBOARD_KEY = "nox-pixel-effect-clipboard";

export const savePixelEffectClipboard = (clip: PixelEffectClipboard) => {
  try { localStorage.setItem(PIXEL_EFFECT_CLIPBOARD_KEY, JSON.stringify(clip)); } catch { /* private mode */ }
};
export const loadPixelEffectClipboard = (): PixelEffectClipboard | null => {
  try { const raw = localStorage.getItem(PIXEL_EFFECT_CLIPBOARD_KEY); return raw ? JSON.parse(raw) as PixelEffectClipboard : null; } catch { return null; }
};

export const defaultLayer = (name = "Layer 1", order: string[] = []): PixelLayer => ({
  id: newId(),
  name,
  playing: false,
  kind: "chase",
  colors: ["#ff0040", "#00e5ff", "#ffea00"],
  speed: 1,
  size: 3,
  text: "HELLO",
  layout: "canvas",
  order,
  reverse: false,
});

/** Every effect paints the canvas; duplicates merged into one catalog entry. */
export function normalizeLayer(l: PixelLayer): PixelLayer {
  const n: PixelLayer = { ...l, layout: "canvas" };
  if (n.kind === "fire") { n.kind = "generator"; n.gen = "fire-classic"; }
  if (n.kind === "generator" && n.gen === "stars") n.kind = "twinkle";
  if (n.kind === "generator" && n.gen === "scanner") n.kind = "bounce";
  return n;
}

export function migrateLayers(s: { pixelLayers?: PixelLayer[]; pixelMap?: PixelMap }): PixelLayer[] {
  if (s.pixelLayers?.length) return s.pixelLayers.map((l) => normalizeLayer({ ...defaultLayer(), ...l, playing: false }));
  if (s.pixelMap) {
    const { vertical: _v, ...rest } = s.pixelMap;
    return [normalizeLayer({ ...defaultLayer(), ...rest, playing: false })];
  }
  return [{ ...defaultLayer("Effect 1"), empty: true }];
}

/** Non-pixel lights placed on the PIXEL map act as one pixel. */
export const pixelCount = (f: PatchedFixture) => (f.split ? 0 : getMode(f).pixels ?? (f.pixelPos ? 1 : 0));
export const isPixelFixture = (f: PatchedFixture) => pixelCount(f) > 0;
/** Physical pixel grid of one fixture [cols, rows]; pixels are numbered row by row from top-left. */
export const pixelGrid = (f: PatchedFixture): [number, number] => {
  const mo = getMode(f);
  return mo.grid ?? [pixelCount(f), 1];
};

/** Position [x, y] of DMX pixel i inside the fixture's grid, following the manufacturer's numbering. */
export const pixelCell = (f: PatchedFixture, i: number): [number, number] => {
  const mo = getMode(f);
  const c = mo.cells?.[i];
  if (c) return c;
  const lc = (mo.grid ?? [mo.pixels ?? 1, 1])[0] || 1;
  return [i % lc, Math.floor(i / lc)];
};

type RGB = [number, number, number];

/** Renders text into a boolean mask `height` pixels tall (browser only). */
export function textMask(text: string, height: number): { w: number; h: number; on: (x: number, y: number) => boolean } {
  const h = Math.max(4, height);
  if (typeof document === "undefined" || !text) return { w: 1, h, on: () => false };
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `bold ${h}px monospace`;
  ctx.font = font;
  const w = Math.max(1, Math.ceil(ctx.measureText(text).width) + h);
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 0, h / 2 + 1);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { w, h, on: (x, y) => data[(y * w + x) * 4 + 3]! > 110 };
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (x: number) => { const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const BLACK: RGB = [0, 0, 0];

function fireColor(h: number): RGB {
  const x = Math.max(0, Math.min(1, h));
  if (x < 0.35) return [x / 0.35 * 200, 0, 0];
  if (x < 0.7) return [200 + (x - 0.35) / 0.35 * 55, (x - 0.35) / 0.35 * 120, 0];
  return [255, 120 + (x - 0.7) / 0.3 * 120, (x - 0.7) / 0.3 * 90];
}

interface Placed { f: PatchedFixture; cells: { x: number; y: number; s: number }[] }

/** Positions of every pixel of every fixture in the layer on one shared grid. */
export function layoutLayer(layer: PixelLayer, fixtures: PatchedFixture[]): { placed: Placed[]; W: number; H: number; S: number } {
  const list = layer.order.map((u) => fixtures.find((f) => f.uid === u)).filter((f): f is PatchedFixture => !!f && isPixelFixture(f));
  if (layer.layout === "canvas") { const st = stageSize(fixtures); const placedOnMap = fixtures.filter((f) => isPixelFixture(f) && !!f.pixelPos); const use = placedOnMap.length ? list.filter((f) => !!f.pixelPos) : list; const pos = new Map(canvasPositions(fixtures)); let fy = 0; for (const f of use) if (!pos.has(f.uid)) { pos.set(f.uid, { x: 0, y: fy, r: 0 }); fy += canvasSize(f)[1] + 1; } return layoutCanvas(use, pos, st, picturePoint(layer, st), layerArea(layer, st)); }
  const placed: Placed[] = [];
  let ox = 0, oy = 0, W = 0, H = 0, seq = 0;
  for (const f of list) {
    let [c, r] = pixelGrid(f);
    const tube = r === 1;
    const rotate = layer.layout === "upright" && tube;
    if (rotate) [c, r] = [1, c];
    const cells: { x: number; y: number; s: number }[] = [];
    const n = pixelCount(f);
    for (let i = 0; i < n; i++) {
      const [lc, lr] = pixelGrid(f);
      const px = i % lc, py = Math.floor(i / lc);
      // upright tubes: pixel 0 at the top
      const lx = rotate ? 0 : px, ly = rotate ? i : (lr > 1 ? py : 0);
      cells.push({ x: ox + lx, y: oy + ly, s: seq++ });
    }
    placed.push({ f, cells });
    if (layer.layout === "stack") { oy += r; W = Math.max(W, c); H = oy; }
    else { ox += c; W = ox; H = Math.max(H, r); }
  }
  return { placed, W: Math.max(1, W), H: Math.max(1, H), S: Math.max(1, seq) };
}

/** Footprint [w, h] of a fixture on the canvas after rotation. */
export function canvasSize(f: PatchedFixture): [number, number] {
  let [c, r] = pixelGrid(f);
  if (f.pixelPos?.r === 90) [c, r] = [r, c];
  return [Math.max(1, c), Math.max(1, r)];
}

/** Canvas positions of every pixel light; unplaced lights are stacked below the placed ones. */
export function canvasPositions(fixtures: PatchedFixture[]): Map<string, { x: number; y: number; r: number }> {
  const px = fixtures.filter(isPixelFixture);
  const out = new Map<string, { x: number; y: number; r: number }>();
  let bottom = 0;
  for (const f of px) if (f.pixelPos) { out.set(f.uid, { x: f.pixelPos.x, y: f.pixelPos.y, r: f.pixelPos.r ?? 0 }); bottom = Math.max(bottom, f.pixelPos.y + canvasSize(f)[1]); }
  void bottom;
  return out;
}

/** Only lights added to the PIXEL map have a position; this picks a free spot for a newly added one. */
export function freeCanvasSpot(fixtures: PatchedFixture[], f: PatchedFixture): { x: number; y: number; r: number } {
  const [W, H] = STAGE_MIN; const [w, h] = canvasSize({ ...f, pixelPos: { x: 0, y: 0 } });
  const taken = [...canvasPositions(fixtures).entries()].map(([u, p]) => { const g = fixtures.find((x) => x.uid === u)!; const [gw, gh] = canvasSize(g); return { ...p, w: gw, h: gh }; });
  const cx = Math.round(W / 2 - w / 2);
  for (let y = Math.round(H / 2 - h / 2), k = 0; k < H; k++, y += (k % 2 ? k : -k)) {
    if (y < 0 || y + h > H) continue;
    if (!taken.some((t) => cx < t.x + t.w + 1 && cx + w + 1 > t.x && y < t.y + t.h + 1 && y + h + 1 > t.y)) return { x: cx, y, r: 0 };
  }
  return { x: Math.max(0, cx), y: 0, r: 0 };
}

/** Fixed PIXEL canvas in cells; lights and effect areas stay inside it. */
export const STAGE_MIN: [number, number] = [122, 72];

/** Effect area clamped into the canvas. */
export function layerArea(layer: Pick<PixelLayer, "area">, stage: { W: number; H: number }) {
  const a = layer.area ?? { x: 0, y: 0, w: stage.W, h: stage.H };
  const w = Math.max(1, Math.min(stage.W, Math.round(a.w))), h = Math.max(1, Math.min(stage.H, Math.round(a.h)));
  return { x: Math.max(0, Math.min(stage.W - w, Math.round(a.x))), y: Math.max(0, Math.min(stage.H - h, Math.round(a.y))), w, h };
}

/** A new effect starts small: 1/16 of the map, in the top-left corner. */
export function initArea(stage: { W: number; H: number }) {
  return layerArea({ area: { x: 0, y: 0, w: Math.max(1, Math.round(stage.W / 16)), h: Math.max(1, Math.round(stage.H / 16)) } }, stage);
}

/** Whole canvas the effect is painted on, so every light samples the spot it sits on. */
export function stageSize(_fixtures?: PatchedFixture[]): { W: number; H: number } {
  return { W: STAGE_MIN[0], H: STAGE_MIN[1] };
}

/** The effect is a picture (stage-sized) stretched into its box and rotated about the box centre.
 *  Returns, for a stage cell, the picture coordinate it shows, or null when outside the rotated box. */
export function picturePoint(layer: PixelLayer, stage: { W: number; H: number }) {
  const a = layerArea(layer, stage);
  const rad = ((layer.angle ?? 0) * Math.PI) / 180;
  const cs = Math.cos(rad), sn = Math.sin(rad);
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  return (X: number, Y: number): { x: number; y: number } | null => {
    const dx = X + 0.5 - cx, dy = Y + 0.5 - cy;
    const lx = dx * cs + dy * sn + a.w / 2, ly = -dx * sn + dy * cs + a.h / 2;
    if (lx < 0 || ly < 0 || lx >= a.w || ly >= a.h) return null;
    // the effect is generated at the box's own resolution, so shrinking never skips or doubles cells
    return { x: Math.min(a.w - 1, Math.floor(lx)), y: Math.min(a.h - 1, Math.floor(ly)) };
  };
}

function layoutCanvas(list: PatchedFixture[], pos: Map<string, { x: number; y: number; r: number }>, stage: { W: number; H: number }, pt: ReturnType<typeof picturePoint>, box = layerArea({}, stage)) {
  const placed: Placed[] = [];
  for (const f of list) {
    const p = pos.get(f.uid)!;
    const n = pixelCount(f);
    const cells: { x: number; y: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = pixelCell(f, i);
      const [lx, ly] = p.r === 90 ? [py, px] : [px, py];
      // travelling effects sweep across the canvas, so s follows x
      const q = pt(p.x + lx, p.y + ly);
      // s = -1: outside the effect picture, layers below show through
      cells.push(q ? { x: q.x, y: q.y, s: q.x } : { x: 0, y: 0, s: -1 });
    }
    placed.push({ f, cells });
  }
  return { placed, W: box.w, H: box.h, S: box.w };
}

export function layerHeight(layer: PixelLayer, fixtures: PatchedFixture[]) {
  return layoutLayer(layer, fixtures).H;
}

/** Colours (0-255) per fixture uid, one entry per pixel. */
export function renderLayer(layer0: PixelLayer, fixtures: PatchedFixture[], t: number, mask: ReturnType<typeof textMask> | null, out = new Map<string, RGB[]>()) {
  if (layer0.empty) return out;
  const layer = layerAt(layer0, t);
  const { placed, W, H, S } = layoutLayer(layer, fixtures);
  if (!placed.length) return out;
  const { at, finish } = makeSampler(layer, W, H, S, t, mask);
  for (const p of placed) out.set(p.f.uid, p.cells.map((c, i) => (c.s < 0 ? out.get(p.f.uid)?.[i] ?? BLACK : finish(at(c.x, c.y, c.s)))));
  return out;
}

/** The effect painted over the whole PIXEL canvas, like a video frame (row-major, W×H). */
export function renderCanvasImage(layer0: PixelLayer, fixtures: PatchedFixture[], t: number, mask: ReturnType<typeof textMask> | null) {
  const layer = layerAt(layer0, t);
  const { W, H } = stageSize(fixtures);
  const pt = picturePoint(layer, { W, H });
  const b = layerArea(layer, { W, H });
  const { at, finish } = makeSampler(layer, b.w, b.h, b.w, t, mask);
  const img: RGB[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = pt(x, y);
    img.push(q ? finish(at(q.x, q.y, q.x)) : BLACK);
  }
  return { W, H, img };
}

/** Several effect layers stacked into one canvas picture: each layer paints only its own area, upper layers on top. */
export function renderCanvasComposite(layers: PixelLayer[], fixtures: PatchedFixture[], t: number, maskOf: (l: PixelLayer) => ReturnType<typeof textMask> | null) {
  const { W, H } = stageSize(fixtures);
  const img: RGB[] = Array.from({ length: W * H }, () => BLACK);
  for (const l0 of layers) {
    if (l0.empty) continue;
    const l = layerAt(l0, l0.pausedAt ?? t);
    const pt = picturePoint(l, { W, H });
    const b = layerArea(l, { W, H });
    const { at, finish } = makeSampler(l, b.w, b.h, b.w, l0.pausedAt ?? t, maskOf(l));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = pt(x, y); if (q) img[y * W + x] = finish(at(q.x, q.y, q.x)); }
  }
  return { W, H, img };
}

function makeSampler(layer: PixelLayer, W: number, H: number, S: number, t: number, mask: ReturnType<typeof textMask> | null) {
  const cols: RGB[] = layer.colors.length ? layer.colors.map(hexToRgb) : [[255, 255, 255]];
  const tintRgb = layer.tint ? hexToRgb(layer.tint) : null;
  const tinted = (c: RGB): RGB => (tintRgb ? (c.map((v, i) => (v * tintRgb[i]!) / 255) as RGB) : c);
  const col = (i: number) => cols[((i % cols.length) + cols.length) % cols.length]!;
  const palette = (phase: number): RGB => {
    const p = ((phase % 1 + 1) % 1) * cols.length;
    const i = Math.floor(p);
    return mix(col(i), col(i + 1), p - i);
  };
  const dir = layer.reverse ? -1 : 1;
  const tt = t * layer.speed + (layer.phase ?? 0);
  const size = Math.max(1, layer.size);

  const gen = layer.kind === "generator" ? generatorById(layer.gen) : null;
  const vid = layer.kind === "video" ? videoFrame(layer.videoId, W, H) : null;
  // travelling effects follow the pixel path light → light (s), whatever the layout
  const at = (x: number, y: number, s: number): RGB => {
    const sd = layer.reverse ? S - 1 - s : s;
    switch (layer.kind) {
      case "generator": {
        const xx = layer.reverse ? W - 1 - x : x;
        return tinted(gen!.fn({ x: xx, y, W, H, t: tt, pal: palette, custom: !!layer.customPalette }));
      }
      case "video": {
        if (!vid) return BLACK;
        const i = (Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, layer.reverse ? W - 1 - x : x))) * 4;
        return tinted([vid[i]!, vid[i + 1]!, vid[i + 2]!]);
      }
      case "solid": return cols[0]!;
      case "chase": return col(Math.floor((sd - tt * 8) / size));
      case "meteor": {
        const span = S + size * 2;
        const head = (tt * 10) % span;
        const d = head - sd;
        return d >= 0 && d < size * 2 ? scale(col(Math.floor(tt * 10 / span)), Math.pow(1 - d / (size * 2), 2)) : BLACK;
      }
      case "bounce": {
        const p = (Math.sin(tt * 2) + 1) / 2 * (W - 1);
        const d = Math.abs(x - p);
        return d < size ? scale(cols[0]!, 1 - d / size) : (cols[1] ? scale(cols[1], 0.15) : BLACK);
      }
      case "rainbow": {
        const phase = (x / W + y / (H * 4)) * dir - tt * 0.3;
        return tinted(layer.customPalette ? palette(phase) : hsvToRgb(((phase * 360 % 360) + 360) % 360, 1, 1));
      }
      case "wave": {
        const k = (Math.sin((x / size) * dir - tt * 4) + 1) / 2;
        return mix(cols[1] ?? BLACK, cols[0]!, k);
      }
      case "gradient": {
        const p = (((x / W) * dir - tt * 0.2) % 1 + 1) % 1 * cols.length;
        const i = Math.floor(p);
        return mix(col(i), col(i + 1), p - i);
      }
      case "plasma": {
        const v = Math.sin(x * 0.4 + tt * 2) + Math.sin(y * 0.6 - tt * 1.5) + Math.sin((x + y) * 0.3 + tt);
        const phase = (v + 3) / 6 + tt / 9;
        return tinted(layer.customPalette ? palette(phase) : hsvToRgb(((phase * 360 % 360) + 360) % 360, 1, 1));
      }
      case "fire": {
        // 2D: hottest at the bottom row. 1D: flickering embers along the length.
        const base = H > 1 ? (y + 1) / H : 0.75;
        const n = smooth(x * 0.9 + tt * 6 + y * 3.1) * 0.6 + smooth(x * 2.3 - tt * 11) * 0.4;
        const flick = smooth(tt * 9 + x * 0.5);
        const heat = Math.max(0, Math.min(1, base * (0.55 + n * 0.6) * (0.75 + flick * 0.35)));
        const p = heat * (cols.length - 1);
        return tinted(layer.customPalette ? scale(mix(col(Math.floor(p)), col(Math.ceil(p)), p % 1), heat) : fireColor(heat));
      }
      case "sparkle": {
        const r = hash(x * 13.1 + y * 71.7 + Math.floor(tt * 12) * 3.3);
         return r > 1 - (layer.density ?? 0.15) ? col(Math.floor(r * 1000)) : BLACK;
      }
      case "twinkle": {
        const ph = hash(x * 7.7 + y * 3.3) * 6.28;
        const k = Math.pow((Math.sin(tt * (1 + hash(x + y * 9)) * 2 + ph) + 1) / 2, 3);
        return scale(col(Math.floor(hash(x * 5 + y) * 100)), k);
      }
      case "strobe": return ((tt * 8) % 1 + 1) % 1 < (layer.duty ?? 0.5) ? col(Math.floor(tt * 8)) : BLACK;
      case "runner": {
        // N-pixel segments travelling across every light in the layer, one after another
        const n = Math.max(1, layer.runners ?? 1);
        const span = S / n;
        const pos = ((tt * 10) % S + S) % S;
        const d = (((sd - pos) % span) + span) % span;
        const lap = Math.floor(tt * 10 / S);
        const k = Math.floor((((sd - pos) % S) + S) % S / span);
        const edge = Math.min(size / 2, size * (layer.softness ?? 0));
        const gain = edge > 0 ? Math.min(1, d / edge, (size - d) / edge) : 1;
        return d < size ? scale(col(lap + k), Math.max(0, gain)) : BLACK;
      }
      case "police": {
        const half = x < W / 2 ? 0 : 1;
        const fl = Math.max(1, layer.flashes ?? 2);
        const mode = layer.policeMode ?? "alternate";
        const cA = cols[0]!, cB = cols[1] ?? [0, 60, 255];
        if (mode === "wigwag") return Math.floor(tt * 2) % 2 === half ? (half ? cB : cA) : BLACK;
        // one side: fl flashes (on/off pairs) then a short pause
        const slots = fl * 2 + 2;
        const step = Math.floor(tt * 14);
        const inSide = step % slots;
        const flashOn = inSide < fl * 2 && inSide % 2 === 0;
        if (mode === "together") return flashOn ? (half ? cB : cA) : BLACK;
        const side = Math.floor(step / slots) % 2;
        return side === half && flashOn ? (half ? cB : cA) : BLACK;
      }
      case "text": {
        if (!mask) return BLACK;
        const off = Math.floor(tt * 10);
        const mx = ((((x + off * dir) % mask.w) + mask.w) % mask.w);
        const my = Math.floor((y / H) * mask.h);
        if (my < 0 || my >= mask.h) return BLACK;
        return mask.on(mx, my) ? cols[0]! : BLACK;
      }
    }
  };

  const brightness = Math.min(1, Math.max(0, layer.brightness ?? 1));
  const background = Math.min(1, Math.max(0, layer.background ?? 0));
  const finish = (c: RGB): RGB => scale(mix(cols[0] ?? BLACK, c, 1 - background), brightness);
  return { at, finish };
}

/** Renders all playing layers; later layers override earlier ones on shared fixtures. */
export function renderLayers(layers: PixelLayer[], fixtures: PatchedFixture[], t: number, masks: Map<string, ReturnType<typeof textMask>>) {
  const out = new Map<string, RGB[]>();
  for (const l of layers) if (l.playing) renderLayer(l, fixtures, l.pausedAt ?? t, masks.get(l.id) ?? null, out);
  return out;
}

/** Newly added lights: in order, columns of up to 8, a new column whenever the model changes; centred on the map. */
export function placeInColumns(list: PatchedFixture[], perCol = 8): Map<string, { x: number; y: number; r: number }> {
  const cols: PatchedFixture[][] = [];
  let key = "";
  for (const f of list) {
    const k = `${f.defId}#${f.modeIdx}`;
    const last = cols[cols.length - 1];
    if (!last || k !== key || last.length >= perCol) cols.push([f]); else last.push(f);
    key = k;
  }
  const size = (f: PatchedFixture) => canvasSize({ ...f, pixelPos: { x: 0, y: 0, r: 0 } });
  const widths = cols.map((c) => Math.max(...c.map((f) => size(f)[0])));
  const heights = cols.map((c) => c.reduce((s, f) => s + size(f)[1], 0) + c.length - 1);
  const [W, H] = STAGE_MIN;
  const totalW = widths.reduce((s, w) => s + w, 0) + cols.length - 1;
  let x = Math.max(0, Math.floor((W - totalW) / 2));
  const out = new Map<string, { x: number; y: number; r: number }>();
  cols.forEach((c, i) => {
    let y = Math.max(0, Math.floor((H - Math.max(...heights)) / 2));
    for (const f of c) { out.set(f.uid, { x: Math.min(x, W - size(f)[0]), y: Math.min(y, H - size(f)[1]), r: 0 }); y += size(f)[1] + 1; }
    x += widths[i]! + 1;
  });
  return out;
}
