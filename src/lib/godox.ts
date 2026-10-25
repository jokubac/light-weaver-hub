// Godox KNOWLED profiles built from Godox's official "DMX Mode Specification" PDFs (godox.com / godox.com.cn):
// M600R V1.2 (FW 1.06), M300R, M1000R, AM1600R, M600Bi Pro. Every mode exists with the "Extend DMX Channels"
// menu setting off (default) and on; on appends Mode (output), Frequency and Smoothing as 8-bit channels.
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode } from "./dmx";

/** [attr, label?, 16-bit in 16-bit modes?, home 0-1?] */
type Ch = [ChannelAttr, string | undefined, boolean, number?];
const C = (attr: ChannelAttr, wide = true, label?: string, home?: number): Ch => [attr, label, wide, home];
const L = (label: string, wide = false, home?: number): Ch => ["Spare", label, wide, home];

// G/M: 120–145 = neutral → centre 133.
const GM_HOME = 133 / 255;
const DIM = C("Dimmer"), CCT = C("CCT"), GM = C("GM", true, undefined, GM_HOME);
const EXT: Ch[] = [L("Output Mode"), L("PWM Frequency"), L("Smoothing")];

function build(name: string, chs: Ch[], wide: boolean, ext: boolean): FixtureMode {
  const map: ChannelMapEntry[] = [];
  for (const [attr, label, w, home] of [...chs, ...(ext ? EXT : [])]) {
    const base: ChannelMapEntry = { attr, ...(label ? { label } : {}), ...(home !== undefined ? { home: +home.toFixed(4) } : {}) };
    map.push(base);
    if (wide && w) map.push({ attr, fine: true, ...(label ? { label } : {}) });
  }
  return { name: `${name}${ext ? " + Extend" : ""}`, channels: map.length, kind: "full", source: "manufacturer", channelMap: map };
}
const both = (name: string, chs: Ch[], wide: boolean) => [build(name, chs, wide, false), build(name, chs, wide, true)];

const HSI: Ch[] = [DIM, C("Hue"), C("Saturation")];
const RGB: Ch[] = [DIM, C("Red"), C("Green"), C("Blue")];
const RGBW: Ch[] = [...RGB, C("White")];
const XY: Ch[] = [DIM, L("CIE x", true, 0.3127 / 0.85), L("CIE y", true, 0.329 / 0.85)];
const CCT_HSI: Ch[] = [DIM, CCT, GM, C("Crossfade", false, "Dissolve"), C("Hue"), C("Saturation")];
const CCT_RGBW: Ch[] = [DIM, CCT, GM, C("Crossfade", false, "Dissolve"), C("Red"), C("Green"), C("Blue"), C("White")];
// FX: Effect type (8-bit) then three effect parameters (16-bit in 16-bit mode); 8-bit mode inserts a Type channel.
const FX8: Ch[] = [DIM, L("Effect Type"), L("FX Type"), L("FX Param 1"), L("FX Param 2"), L("FX Param 3")];
const FX16: Ch[] = [DIM, L("Effect Type"), L("FX Type"), L("FX Param 1", true), L("FX Param 2", true), L("FX Param 3", true)];
const GEL: Ch[] = [DIM, L("R-GEL/L-GEL"), L("Gel Type"), L("Gel CCT"), L("Gel Number", true), L("Fine-tune Hue"), L("Fine-tune Saturation")];

/** M600R chart order. Index 0 stays CCT+RGBW 8-bit so projects patched with the old one-mode profile keep it. */
export const GODOX_M600R_MODES: FixtureMode[] = [
  ...both("07 CCT+RGBW 8-bit", CCT_RGBW, false),
  ...both("01 CCT 8-bit", [DIM, CCT, GM], false),
  ...both("02 HSI 8-bit", HSI, false),
  ...both("03 RGB 8-bit", RGB, false),
  ...both("04 RGBW 8-bit", RGBW, false),
  ...both("05 RGBWW 8-bit", [...RGB, C("White", false, "Cool White"), C("White", false, "Warm White")], false),
  ...both("06 CCT+HSI 8-bit", CCT_HSI, false),
  ...both("08 FX 8-bit", FX8, false),
  ...both("09 GEL 8-bit", GEL, false),
  ...both("10 CCT 16-bit", [DIM, CCT, GM], true),
  ...both("11 HSI 16-bit", HSI, true),
  ...both("12 RGB 16-bit", RGB, true),
  ...both("13 RGBW 16-bit", RGBW, true),
  ...both("14 X-Y 16-bit", XY, true),
  ...both("15 FX 16-bit", FX16, true),
  ...both("16 GEL 16-bit", GEL, true),
];

/** M300R and M1000R share one chart layout (no RGBWW; X-Y is mode 13). */
export const GODOX_M300R_M1000R_MODES: FixtureMode[] = [
  ...both("01 CCT 8-bit", [DIM, CCT, GM], false),
  ...both("02 HSI 8-bit", HSI, false),
  ...both("03 RGB 8-bit", RGB, false),
  ...both("04 RGBW 8-bit", RGBW, false),
  ...both("05 CCT+HSI 8-bit", CCT_HSI, false),
  ...both("06 CCT+RGBW 8-bit", CCT_RGBW, false),
  ...both("07 FX 8-bit", FX8, false),
  ...both("08 GEL 8-bit", GEL, false),
  ...both("09 CCT 16-bit", [DIM, CCT, GM], true),
  ...both("10 HSI 16-bit", HSI, true),
  ...both("11 RGB 16-bit", RGB, true),
  ...both("12 RGBW 16-bit", RGBW, true),
  ...both("13 X-Y 16-bit", XY, true),
  ...both("14 FX 16-bit", FX16, true),
  ...both("15 GEL 16-bit", GEL, true),
];

// Ultimate: Mode selection then 6 colour parameters (8-bit) / 8 (16-bit) whose meaning follows the selected mode.
const ULT8: Ch[] = [DIM, L("Mode Selection"), ...Array.from({ length: 6 }, (_, i) => L(`Colour Param ${i + 1}`))];
const ULT16: Ch[] = [DIM, L("Mode Selection"), ...Array.from({ length: 8 }, (_, i) => L(`Colour Param ${i + 1}`))];

/** AM1600R. Index 0 stays CCT+RGBW 8-bit + Extend (11 ch) to match the old one-mode profile. */
export const GODOX_AM1600R_MODES: FixtureMode[] = [
  build("07 CCT+RGBW 8-bit", CCT_RGBW, false, true),
  build("07 CCT+RGBW 8-bit", CCT_RGBW, false, false),
  ...both("01 CCT 8-bit", [DIM, CCT, GM], false),
  ...both("02 HSI 8-bit", HSI, false),
  ...both("03 RGB 8-bit", RGB, false),
  ...both("04 RGBW 8-bit", RGBW, false),
  ...both("05 X-Y 8-bit", XY, false),
  ...both("06 CCT+HSI 8-bit", CCT_HSI, false),
  ...both("08 FX 8-bit", FX8, false),
  ...both("09 GEL 8-bit", GEL, false),
  ...both("10 CCT 16-bit", [DIM, CCT, GM], true),
  ...both("11 HSI 16-bit", HSI, true),
  ...both("12 RGB 16-bit", RGB, true),
  ...both("13 RGBW 16-bit", RGBW, true),
  ...both("14 X-Y 16-bit", XY, true),
  ...both("15 FX 16-bit", FX16, true),
  ...both("16 GEL 16-bit", GEL, true),
  build("17 Ultimate 8-bit", ULT8, false, false),
  build("17 Ultimate 8-bit", ULT8, false, true),
  build("18 Ultimate 16-bit", ULT16, false, false),
  build("18 Ultimate 16-bit", ULT16, false, true),
];

// M600Bi Pro (bi-colour 2800–6500K): FX has no Type channel; Ultimate carries 3 parameters (16-bit in mode 06).
const BI_FX: Ch[] = [DIM, L("Effect Type"), L("FX Param 1", true), L("FX Param 2", true), L("FX Param 3", true)];
const BI_ULT: Ch[] = [DIM, L("Mode Selection"), L("Param 1", true), L("Param 2", true), L("Param 3", true), L("Param 4", true)];
export const GODOX_M600BI_PRO_MODES: FixtureMode[] = [
  ...both("01 CCT 8-bit", [DIM, CCT], false),
  ...both("02 FX 8-bit", BI_FX, false),
  ...both("03 CCT 16-bit", [DIM, CCT], true),
  ...both("04 FX 16-bit", BI_FX, true),
  ...both("05 Ultimate 8-bit", BI_ULT.slice(0, 6), false),
  ...both("06 Ultimate 16-bit", BI_ULT.slice(0, 6), true).map((m) => m),
];

export const GODOX_FIXTURES: FixtureDef[] = [
  { id: "gdtf-godox-godox-m600r", brand: "Godox", model: "Godox M600R", cctRange: [1800, 10000], lightType: "LED colour", modes: GODOX_M600R_MODES },
  { id: "gdtf-godox-knowled-am1600r", brand: "Godox", model: "Knowled AM1600R", cctRange: [1800, 10000], lightType: "LED colour", modes: GODOX_AM1600R_MODES },
  { id: "gdtf-godox-knowled-m300r", brand: "Godox", model: "Knowled M300R", cctRange: [1800, 10000], lightType: "LED colour", modes: GODOX_M300R_M1000R_MODES },
  { id: "gdtf-godox-knowled-m1000r", brand: "Godox", model: "Knowled M1000R", cctRange: [1800, 10000], lightType: "LED colour", modes: GODOX_M300R_M1000R_MODES },
  { id: "gdtf-godox-knowled-m600bi-pro", brand: "Godox", model: "Knowled M600Bi Pro", cctRange: [2800, 6500], lightType: "LED bi-colour", modes: GODOX_M600BI_PRO_MODES },
];
