// DMG Lumière (Rosco) MIX family from DMG's official "DMX PROFILES DMG" (Nov 2022, rosco.com).
// Availability per the chart: SL1/MINI MIX get modes 1–7 and 15–17; MAXI MIX gets 1–20 (2-zone modes repeat the
// single-zone block per zone, then one Control channel). Modes 21–22 are DASH only.
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode } from "./dmx";

/** [attr, label?, 16-bit in 16-bit modes?] */
type Ch = [ChannelAttr, string | undefined, boolean];
const C = (attr: ChannelAttr, wide = true): Ch => [attr, undefined, wide];
const L = (label: string, wide = false): Ch => ["Spare", label, wide];

const DIM = C("Dimmer"), CCT = C("CCT"), GM = C("GM"), HUE = C("Hue"), SAT = C("Saturation", false);
const MEM = [L("Gel mem 100"), L("Gel mem 10"), L("Gel mem 1")];
const GELADJ = [L("Gel CCT"), L("Gel Hue"), L("Gel Sat")];
const STROBE = L("Light Strobe"), CTRL = L("Control Channel");
const PARAMS = (w: boolean) => Array.from({ length: 8 }, (_, i) => L(`Colour param ${i + 1}`, w));

/** Per-zone blocks (Control channel excluded). `w` = 16-bit profile. */
const WHITE: Ch[] = [DIM, CCT, GM];
const COLOR: Ch[] = [DIM, CCT, HUE, C("Saturation")];
const GEL: Ch[] = [DIM, ...MEM, ...GELADJ];
const PRO: Ch[] = [DIM, ...MEM, C("CCT", false), C("GM", false), HUE, SAT, ...GELADJ, L("Effect Speed"), L("CIE x", true), L("CIE y", true), STROBE];
const FULL: Ch[] = [DIM, CCT, GM, C("Crossfade"), C("Red"), C("Green"), C("Blue"), C("White"), L("Amber", true), L("Lime", true), STROBE];
const GLOBAL = (w: boolean): Ch[] => [DIM, L("Colour Mode 1"), ...PARAMS(w), C("Crossfade"), L("Colour Mode 2"), ...PARAMS(w), L("myMIX Memory"), STROBE];
const NEWGEL: Ch[] = [DIM, L("Gel Brand"), L("Gel CCT"), L("Gel Type"), L("Gel List"), L("Gel Hue"), L("Gel Sat")];

function build(name: string, block: Ch[], wide: boolean, zones: 1 | 2, ctrl: boolean): FixtureMode {
  const map: ChannelMapEntry[] = [];
  for (let z = 0; z < zones; z++) for (const [attr, label, w] of block) {
    const lab = zones === 2 ? `${label ?? attr} Z${z + 1}` : label;
    // Zone 2 colour channels are labelled spares so the console's colour controls drive zone 1 only once.
    const a: ChannelAttr = zones === 2 && z === 1 ? "Spare" : attr;
    const e: ChannelMapEntry = { attr: a, ...(lab ? { label: lab } : {}) };
    map.push(e);
    if (wide && w) map.push({ ...e, fine: true });
  }
  if (ctrl) map.push({ attr: "Spare", label: "Control Channel" });
  return { name, channels: map.length, kind: "full", source: "manufacturer", channelMap: map };
}

export const DMG_MODES: Record<number, FixtureMode> = {
  1: build("Mode 1 White 8b", WHITE, false, 1, false),
  2: build("Mode 2 Color 8b", COLOR, false, 1, false),
  3: build("Mode 3 Gel 8b (legacy)", GEL, false, 1, false),
  4: build("Mode 4 Pro 8b", PRO, false, 1, true),
  5: build("Mode 5 Pro 16b", PRO, true, 1, true),
  6: build("Mode 6 Full 8b", FULL, false, 1, true),
  7: build("Mode 7 Full 16b", FULL, true, 1, true),
  8: build("Mode 8 MAXI White 8b", WHITE, false, 2, false),
  9: build("Mode 9 MAXI Color 8b", COLOR, false, 2, false),
  10: build("Mode 10 MAXI Gel 8b (legacy)", GEL, false, 2, false),
  11: build("Mode 11 MAXI Pro 8b", PRO, false, 2, true),
  12: build("Mode 12 MAXI Pro 16b", PRO, true, 2, true),
  13: build("Mode 13 MAXI Full 8b", FULL, false, 2, true),
  14: build("Mode 14 MAXI Full 16b", FULL, true, 2, true),
  15: build("Mode 15 Global 8b", GLOBAL(false), false, 1, true),
  16: build("Mode 16 Global 16b", GLOBAL(true), true, 1, true),
  17: build("Mode 17 New Gel 8b", NEWGEL, false, 1, false),
  18: build("Mode 18 MAXI Global 8b", GLOBAL(false), false, 2, true),
  19: build("Mode 19 MAXI Global 16b", GLOBAL(true), true, 2, true),
  20: build("Mode 20 MAXI New Gel 8b", NEWGEL, false, 2, false),
};
void CTRL;

/** Old profile's modes first in their old order, so saved mode indices keep working; the rest follow. */
const pick = (first: number[], all: number[]) => [...first, ...all.filter((n) => !first.includes(n))].map((n) => DMG_MODES[n]!);
const SL1_MINI = [1, 2, 3, 4, 5, 6, 7, 15, 16, 17];
const MAXI = Array.from({ length: 20 }, (_, i) => i + 1);

export const DMG_FIXTURES: FixtureDef[] = [
  { id: "gdtf-dmg-minimix", brand: "DMG Lumière", model: "MINIMIX", cctRange: [1700, 10000], lightType: "LED colour", modes: pick([6, 7], SL1_MINI) },
  { id: "gdtf-dmg-mix", brand: "DMG Lumière", model: "MIX", cctRange: [1700, 10000], lightType: "LED colour", modes: pick([6, 7], SL1_MINI) },
  { id: "gdtf-rosco-rosco-dmg-sl1-a", brand: "Rosco", model: "Rosco DMG SL1 A", cctRange: [1700, 10000], lightType: "LED colour", modes: pick([1, 2, 4, 5, 6, 7, 15, 16], SL1_MINI) },
  { id: "gdtf-rosco-rosco-dmg-maxi", brand: "Rosco", model: "Rosco DMG MAXI", cctRange: [1700, 10000], lightType: "LED colour", modes: pick([1, 2, 4, 5, 6, 7, 8, 9, 15, 16], MAXI) },
];
