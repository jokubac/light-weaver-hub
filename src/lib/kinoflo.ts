// Kino Flo True Match Firmware 5.0 "DMX Protocol Specifications and RDM Protocol Specifications" (May 2021, kinoflo.com).
// Covers the LED-140X controller that drives FreeStyle Air panels. P30 is left out: its table numbers 15 channels
// but lists 19 functions, so the chart contradicts itself. [attr, label|null, fine-of-previous?] per chart row.
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode } from "./dmx";

type Row = [ChannelAttr, string | null, boolean];
const TABLE: [string, Row[]][] = [
  ["P1 CCT 8b, 3", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false]]],
  ["P2 GEL 8b, 6", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false], ["Spare", "Gel List", false], ["Hue", null, false], ["Saturation", null, false]]],
  ["P3 RGB 8b, 6", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false], ["Red", null, false], ["Green", null, false], ["Blue", null, false]]],
  ["P4 FX 8b, 8", [["Dimmer", null, false], ["Spare", "Effect Selection", false], ["CCT", null, false], ["Spare", "FX Parameter 1", false], ["Spare", "FX Parameter 2", false], ["Spare", "FX Parameter 3", false], ["Spare", "FX Parameter 4", false], ["Spare", "FX Parameter 5", false]]],
  ["P5 xy 8b, 3", [["Dimmer", null, false], ["Spare", "CIE x", false], ["Spare", "CIE y", false]]],
  ["P6 CCT 16b, 4", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["GM", null, false]]],
  ["P7 GEL 16b, 7", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["GM", null, false], ["Spare", "Gel List", false], ["Hue", null, false], ["Saturation", null, false]]],
  ["P8 RGB 16b, 7", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["GM", null, false], ["Red", null, false], ["Green", null, false], ["Blue", null, false]]],
  ["P9 FX 16b, 9", [["Dimmer", null, false], ["Dimmer", null, true], ["Spare", "Effect Selection", false], ["CCT", null, false], ["Spare", "FX Parameter 1", false], ["Spare", "FX Parameter 2", false], ["Spare", "FX Parameter 3", false], ["Spare", "FX Parameter 4", false], ["Spare", "FX Parameter 5", false]]],
  ["P10 xy 16b, 4", [["Dimmer", null, false], ["Dimmer", null, true], ["Spare", "CIE x", false], ["Spare", "CIE y", false]]],
  ["P11 CCT 8b, 3", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false]]],
  ["P12 CCT 16b, 5", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["GM", null, false]]],
  ["P13 Gel 8b , 3", [["Dimmer", null, false], ["CCT", null, false], ["Spare", "Gel List", false]]],
  ["P14 Gel 16b , 5", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["Spare", "Gel List", false]]],
  ["P15 HS 8b, 4", [["Dimmer", null, false], ["CCT", null, false], ["Hue", null, false], ["Saturation", null, false]]],
  ["P16 HS 16b, 8", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["Hue", null, false], ["Hue", null, true], ["Saturation", null, false], ["Saturation", null, true]]],
  ["P17 RGB 8b, 5", [["Dimmer", null, false], ["CCT", null, false], ["Red", null, false], ["Green", null, false], ["Blue", null, false]]],
  ["P18 RGB 16b, 10", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["Red", null, false], ["Red", null, true], ["Green", null, false], ["Green", null, true], ["Blue", null, false], ["Blue", null, true]]],
  ["P19 CIE xy 8b, 3", [["Dimmer", null, false], ["Spare", "CIE x", false], ["Spare", "CIE y", false]]],
  ["P20 CIE xy 16b, 6", [["Dimmer", null, false], ["Dimmer", null, true], ["Spare", "CIE x", false], ["Spare", "CIE x", true], ["Spare", "CIE y", false], ["Spare", "CIE y", true]]],
  ["P21 FX 8b, 8", [["Dimmer", null, false], ["Spare", "Effect Selection", false], ["CCT", null, false], ["Spare", "FX Parameter 1", false], ["Spare", "FX Parameter 2", false], ["Spare", "FX Parameter 3", false], ["Spare", "FX Parameter 4", false], ["Spare", "FX Parameter 5", false]]],
  ["P22 FX 16b, 10", [["Dimmer", null, false], ["Dimmer", null, true], ["Spare", "Effect Selection", false], ["CCT", null, false], ["CCT", null, true], ["Spare", "FX Parameter 1", false], ["Spare", "FX Parameter 2", false], ["Spare", "FX Parameter 3", false], ["Spare", "FX Parameter 4", false], ["Spare", "FX Parameter 5", false]]],
  ["P23 CCT & HS 8b, 7", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false], ["Crossfade", null, false], ["Spare", "Colour CCT", false], ["Hue", null, false], ["Saturation", null, false]]],
  ["P24 CCT & HS 16b, 13", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["GM", null, false], ["Crossfade", null, false], ["Crossfade", null, true], ["Spare", "Colour CCT", false], ["Spare", "Colour CCT", true], ["Hue", null, false], ["Hue", null, true], ["Saturation", null, false], ["Saturation", null, true]]],
  ["P25 CCT & RGB 8b, 8", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false], ["Crossfade", null, false], ["Spare", "Colour CCT", false], ["Red", null, false], ["Green", null, false], ["Blue", null, false]]],
  ["P26 CCT & RGB 16b, 15", [["Dimmer", null, false], ["Dimmer", null, true], ["CCT", null, false], ["CCT", null, true], ["GM", null, false], ["Crossfade", null, false], ["Crossfade", null, true], ["Spare", "Colour CCT", false], ["Spare", "Colour CCT", true], ["Red", null, false], ["Red", null, true], ["Green", null, false], ["Green", null, true], ["Blue", null, false], ["Blue", null, true]]],
  ["P27 xy1 & xy2 8b, 6", [["Dimmer", null, false], ["Spare", "CIE x1", false], ["Spare", "CIE y1", false], ["Crossfade", null, false], ["Spare", "CIE x2", false], ["Spare", "CIE y2", false]]],
  ["P28 xy1 & xy2 16b, 12", [["Dimmer", null, false], ["Dimmer", null, true], ["Spare", "CIE x1", false], ["Spare", "CIE x1", true], ["Spare", "CIE y1", false], ["Spare", "CIE y1", true], ["Crossfade", null, false], ["Crossfade", null, true], ["Spare", "CIE x2", false], ["Spare", "CIE x2", true], ["Spare", "CIE y2", false], ["Spare", "CIE y2", true]]],
  ["P29 CCT & TDRGB 8b, 9", [["Dimmer", null, false], ["CCT", null, false], ["GM", null, false], ["Crossfade", null, false], ["White", "Tungsten", false], ["White", "Daylight", false], ["Red", null, false], ["Green", null, false], ["Blue", null, false]]],
];

const build = ([name, rows]: [string, Row[]]): FixtureMode => {
  const map: ChannelMapEntry[] = rows.map(([attr, label, fine]) => ({ attr, ...(fine ? { fine: true } : {}), ...(label ? { label } : {}) }));
  return { name, channels: map.length, kind: "full", source: "manufacturer", channelMap: map };
};
const ALL = TABLE.map(build);
/** Old profile modes first (same footprints), so saved mode indices keep working. */
const ordered = (first: string[]) => [...first.map((p) => ALL.find((m) => m.name.startsWith(p + " "))!), ...ALL.filter((m) => !first.some((p) => m.name.startsWith(p + " ")))];
export const KINOFLO_TM5_MODES = ALL;
export const KINOFLO_FIXTURES: FixtureDef[] = [
  { id: "gdtf-kinoflo-freestyle-air", brand: "Kino Flo", model: "FREESTYLE AIR", cctRange: [2500, 9900], lightType: "LED colour", modes: ordered(["P3", "P8", "P25", "P26"]) },
  { id: "gdtf-kino-flo-freestyle-air-max", brand: "Kino Flo", model: "FreeStyle Air Max", cctRange: [2500, 9900], lightType: "LED colour", modes: ordered(["P26"]) },
];
