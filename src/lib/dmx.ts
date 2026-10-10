// DMX engine: fixture library, universe state, effects math.

export type FixtureMode = "dimmer" | "cct" | "rgb" | "rgbw";

export interface FixtureDef {
  id: string;
  brand: string;
  model: string;
  mode: FixtureMode;
  channels: number;
}

// Film-industry fixture library
export const FIXTURE_LIBRARY: FixtureDef[] = [
  { id: "arri-skypanel-s60", brand: "ARRI", model: "SkyPanel S60-C", mode: "rgbw", channels: 16 },
  { id: "arri-orbiter", brand: "ARRI", model: "Orbiter", mode: "rgbw", channels: 12 },
  { id: "arri-m18", brand: "ARRI", model: "M18 (Dimmer)", mode: "dimmer", channels: 1 },
  { id: "aputure-600d", brand: "Aputure", model: "600d Pro", mode: "dimmer", channels: 2 },
  { id: "aputure-1200d", brand: "Aputure", model: "1200d Pro", mode: "dimmer", channels: 2 },
  { id: "aputure-600c", brand: "Aputure", model: "600c Pro", mode: "rgbw", channels: 10 },
  { id: "aputure-mc", brand: "Aputure", model: "MC", mode: "rgb", channels: 6 },
  { id: "nanlite-forza-720", brand: "Nanlite", model: "Forza 720B", mode: "cct", channels: 4 },
  { id: "nanlite-pavotube-30c", brand: "Nanlite", model: "PavoTube 30C", mode: "rgbw", channels: 8 },
  { id: "nanlux-evoke-1200", brand: "Nanlux", model: "Evoke 1200", mode: "cct", channels: 4 },
  { id: "nanlux-dyno-650", brand: "Nanlux", model: "Dyno 650C", mode: "rgbw", channels: 14 },
  { id: "astera-titan", brand: "Astera", model: "Titan Tube", mode: "rgbw", channels: 8 },
  { id: "astera-nyx", brand: "Astera", model: "NYX Bulb", mode: "rgbw", channels: 6 },
  { id: "generic-dimmer", brand: "Generic", model: "Dimmer Channel", mode: "dimmer", channels: 1 },
  { id: "generic-rgb", brand: "Generic", model: "RGB Par", mode: "rgb", channels: 4 },
];

export interface PatchedFixture {
  uid: string;
  defId: string;
  name: string;
  address: number; // 1-512
  // live control state (0-1 unless noted)
  intensity: number;
  cct: number; // 0 = 2700K, 1 = 6500K
  hue: number; // 0-360
  saturation: number; // 0-1
  effect: EffectKind;
  effectSpeed: number; // 0-1
  effectSize: number; // 0-1
}

export type EffectKind = "none" | "fire" | "pulse" | "strobe" | "lightning" | "tv";

export const EFFECTS: { id: EffectKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fire", label: "Fire" },
  { id: "pulse", label: "Pulse" },
  { id: "strobe", label: "Strobe" },
  { id: "lightning", label: "Lightning" },
  { id: "tv", label: "TV Flicker" },
];

export function createFixture(def: FixtureDef, address: number, index: number): PatchedFixture {
  return {
    uid: `${def.id}-${Date.now()}-${index}`,
    defId: def.id,
    name: `${def.model} ${index}`,
    address,
    intensity: 0,
    cct: 0.5,
    hue: 200,
    saturation: 1,
    effect: "none",
    effectSpeed: 0.5,
    effectSize: 0.5,
  };
}

// --- Effects math ---

// Deterministic value noise (cheap Perlin substitute)
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i);
  const b = hash(i + 1);
  return a + (b - a) * u;
}
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

let lightningUntil = 0;
let nextBolt = 0;

export function effectLevel(kind: EffectKind, t: number, speed: number, size: number): number {
  const s = 0.5 + speed * 3;
  switch (kind) {
    case "none":
      return 1;
    case "pulse":
      return 0.5 + 0.5 * Math.sin(t * s * Math.PI * 2);
    case "strobe":
      return Math.sin(t * (4 + speed * 20) * Math.PI * 2) > 0 ? 1 : 0;
    case "fire": {
      const n = noise1(t * s * 4) * 0.7 + noise1(t * s * 11) * 0.3;
      return 1 - size * 0.7 + n * size * 0.7;
    }
    case "tv": {
      const n = noise1(t * s * 7);
      return Math.max(0.15, 0.55 + (n - 0.5) * size * 1.4);
    }
    case "lightning": {
      if (t > nextBolt) {
        nextBolt = t + 1 + Math.random() * (6 - speed * 5);
        lightningUntil = t + 0.08 + Math.random() * 0.25;
      }
      if (t < lightningUntil) return Math.random() > 0.3 ? 1 : 0.2;
      return 0.05;
    }
  }
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function cctToRgb(cct: number): [number, number, number] {
  // 2700K (warm) -> 6500K (cool) approximation
  const warm: [number, number, number] = [255, 169, 87];
  const cool: [number, number, number] = [200, 220, 255];
  return [
    Math.round(warm[0] + (cool[0] - warm[0]) * cct),
    Math.round(warm[1] + (cool[1] - warm[1]) * cct),
    Math.round(warm[2] + (cool[2] - warm[2]) * cct),
  ];
}

export function fixtureColor(f: PatchedFixture, def: FixtureDef | undefined, t: number): string {
  const level = effectLevel(f.effect, t, f.effectSpeed, f.effectSize);
  const v = f.intensity * level;
  let rgb: [number, number, number];
  if (def?.mode === "cct" || def?.mode === "dimmer") rgb = cctToRgb(f.cct);
  else rgb = hsvToRgb(f.hue, f.saturation, 1);
  return `rgb(${Math.round(rgb[0] * v)}, ${Math.round(rgb[1] * v)}, ${Math.round(rgb[2] * v)})`;
}
