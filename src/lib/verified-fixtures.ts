// Manufacturer-verified fixture profiles built from official DMX charts.
// The curation script replaces same-id library entries with these, so they win over community GDTF files.
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode } from "./dmx";

type Slot = ChannelAttr | [ChannelAttr, number]; // [attr, home 0-1]

function expand(slots: Slot[], wide: boolean): ChannelMapEntry[] {
  return slots.flatMap((s) => {
    const [attr, home] = Array.isArray(s) ? s : [s, undefined];
    const hi: ChannelMapEntry = { attr, ...(home !== undefined ? { home } : {}) };
    if (!wide) return [hi];
    const n = Math.round((home ?? 0) * 65535);
    return [{ ...hi, ...(home !== undefined ? { home: +((n >> 8) / 255).toFixed(4) } : {}) }, { attr, fine: true, ...(home !== undefined ? { home: +((n & 255) / 255).toFixed(4) } : {}) }];
  });
}

function mode(name: string, slots: Slot[], wide: boolean, pixels?: { count: number; master: boolean }): FixtureMode {
  const all: Slot[] = pixels ? [...(pixels.master ? (["Dimmer"] as Slot[]) : []), ...Array.from({ length: pixels.count }, () => slots).flat()] : slots;
  const channelMap = expand(all, wide);
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap, ...(pixels ? { pixels: pixels.count } : {}) };
}

// SUMOMAX DMX Table, firmware 1.3.0 (sumolight.com/downloads). 19 pixels per head; multi-pixel modes start with Master.
const GM: Slot = ["GM", 0.5];
const S_CCT: Slot[] = ["Dimmer", "CCT", GM];
const S_HSI: Slot[] = ["Dimmer", "CCT", GM, "Hue", "Crossfade"];
const S_RGB: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"];
const S_CCTRGBWW: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue", "White", "White"];
const S_RGBWW: Slot[] = ["Red", "Green", "Blue", "White", "White"];
const S_XY: Slot[] = ["Dimmer", ["Spare", 0.3127], ["Spare", 0.329]];
const S_GEL: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Spare", "Spare"];
const FX: Slot[] = Array.from({ length: 14 }, () => "Spare" as Slot);
const FLEX: Slot[] = Array.from({ length: 9 }, () => "Spare" as Slot);
const PX = (master = true) => ({ count: 19, master });

const SUMOMAX_MODES: FixtureMode[] = [
  mode("1 CCT 8-bit Single", S_CCT, false),
  mode("2 CCT 16-bit Single", S_CCT, true),
  mode("3 CCT 8-bit Multi (19 px)", S_CCT, false, PX()),
  mode("4 CCT 16-bit Multi (19 px)", S_CCT, true, PX()),
  mode("5 CCT HSI 8-bit Single", S_HSI, false),
  mode("6 CCT HSI 16-bit Single", S_HSI, true),
  mode("7 CCT HSI 8-bit Multi (19 px)", S_HSI, false, PX()),
  mode("8 CCT HSI 16-bit Multi (19 px)", S_HSI, true, PX()),
  mode("9 CCT RGB 8-bit Single", S_RGB, false),
  mode("10 CCT RGB 16-bit Single", S_RGB, true),
  mode("11 CCT RGB 8-bit Multi (19 px)", S_RGB, false, PX()),
  mode("12 CCT RGB 16-bit Multi (19 px)", S_RGB, true, PX()),
  mode("13 CCT RGBWW 8-bit Single", S_CCTRGBWW, false),
  mode("14 CCT RGBWW 16-bit Single", S_CCTRGBWW, true),
  mode("15 CCT RGBWW 8-bit Multi (19 px)", S_CCTRGBWW, false, PX()),
  mode("16 CCT RGBWW 16-bit Multi (19 px)", S_CCTRGBWW, true, PX()),
  mode("17 RGBWW 8-bit Single", S_RGBWW, false),
  mode("18 RGBWW 16-bit Single", S_RGBWW, true),
  mode("19 RGBWW 8-bit Multi (19 px)", S_RGBWW, false, PX()),
  mode("20 RGBWW 16-bit Multi (19 px)", S_RGBWW, true, PX()),
  mode("21 XY 8-bit Single", S_XY, false),
  mode("22 XY 16-bit Single", S_XY, true),
  mode("23 XY 8-bit Multi (19 px)", S_XY, false, PX()),
  mode("24 XY 16-bit Multi (19 px)", S_XY, true, PX()),
  mode("25 CCT Gel 8-bit Single", S_GEL, false),
  mode("26 CCT Gel 16-bit Single", S_GEL, true),
  mode("27 FX", FX, false),
  { ...mode("28 Flex 8-bit Single", ["Spare", ...FLEX], false) },
  { ...mode("29 Flex 16-bit Single", FLEX, true), channels: 19, channelMap: [{ attr: "Spare" }, ...expand(FLEX, true)] },
];

export const VERIFIED_FIXTURES: FixtureDef[] = [
  { id: "gdtf-sumolight-sumomax", brand: "SumoLight", model: "SUMOMAX", watts: 700, cctRange: [1800, 10000], lightType: "LED colour", modes: SUMOMAX_MODES },
];
