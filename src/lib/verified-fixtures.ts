import { SPEC_PAGE_CHECKED } from "./spec-checked";
import { GODOX_FIXTURES } from "./godox";
import { GEMINI_FIXTURES } from "./litepanels-gemini";
import { DMG_FIXTURES } from "./dmg";
import { KINOFLO_FIXTURES } from "./kinoflo";
// Manufacturer-verified fixture profiles built from official DMX charts.
// The curation script replaces same-id library entries with these, so they win over community GDTF files.
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode } from "./dmx";
import { ORBITER_TABLE } from "./arri-orbiter-table";

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

// Mixed-resolution helper: parts are [slots, wide16] pairs concatenated in order.
function mm(name: string, parts: [Slot[], boolean][], pixels?: { count: number; master: boolean }): FixtureMode {
  const build = (): ChannelMapEntry[] => parts.flatMap(([slots, wide]) => expand(slots, wide));
  const channelMap: ChannelMapEntry[] = pixels
    ? [...(pixels.master ? expand(["Dimmer"], false) : []), ...Array.from({ length: pixels.count }, build).flat()]
    : build();
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap, ...(pixels ? { pixels: pixels.count } : {}) };
}

const SP: Slot = "Spare";
const XY: Slot[] = [["Spare", 0.3127], ["Spare", 0.329]];

// Creamsource Vortex DMX Tables V3.1 rev B (knowledge.creamsource.com, CreamOS 3.1+). CCT 2200–15000K.
// Every mode ends with Fan Mode + Control Channel; Split/Bars modes add Zone Orientation.
const lab = (label: string): ChannelMapEntry => ({ attr: "Spare", label });
const V_FAN = lab("Fan Mode"), V_CTRL = lab("Control Channel"), V_ORIENT = lab("Zone Orientation");
const V_FX: Slot[] = ["Spare", "Spare", "Spare", "Spare", "Spare", "Spare"];
const V_FX_LABELS = ["Effects Mode", "Effects Ch 1", "Effects Ch 2", "Effects Ch 3", "Effects Ch 4", "Effects Ch 5"];
const V_GEL: Slot[] = ["Spare", "Spare", "Spare"];
const V_GEL_LABELS = ["Gel Library", "Gel Swatch", "Gel Source"];
const V_BUMP: Slot[] = [["Spare", 134 / 255], ["Spare", 134 / 255], ["Spare", 134 / 255], ["Spare", 134 / 255]];
const V_BUMP_LABELS = ["Bump Red/Cyan", "Bump Green/Magenta", "Bump Blue/Yellow", "Bump Saturation"];
const V_CCTRGBW: Slot[] = ["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue", "White"];
const V_CCT: Slot[] = ["Dimmer", "CCT", "GM"];
const V_CCTHS: Slot[] = ["Dimmer", "CCT", "GM", "Crossfade", "Hue", "Saturation"];
const V_RGBW: Slot[] = ["Dimmer", "Red", "Green", "Blue", "White"];
const V_RGBW_BARE: Slot[] = ["Red", "Green", "Blue", "White"];
const V_HS: Slot[] = ["Dimmer", "Hue", "Saturation"];
const V_XY: Slot[] = ["Dimmer", ...XY];
const V_CCTXY: Slot[] = ["Dimmer", "CCT", "GM", "Crossfade", ...XY];
const V_DIM: Slot[] = ["Dimmer"];
/** Labelled Spare slots (effects, gels, bumps) expanded at the mode's resolution. */
const labelled = (slots: Slot[], labels: string[], wide: boolean): ChannelMapEntry[] =>
  expand(slots, wide).map((e, i) => ({ ...e, label: labels[wide ? Math.floor(i / 2) : i] ?? "" }));
type VPart = Slot[] | ChannelMapEntry[];
const isEntries = (p: VPart): p is ChannelMapEntry[] => p.length > 0 && typeof p[0] === "object" && !Array.isArray(p[0]);
function vSingle(name: string, wide: boolean, ...parts: VPart[]): FixtureMode {
  const channelMap = [...parts.flatMap((p) => (isEntries(p) ? p : expand(p as Slot[], wide))), V_FAN, V_CTRL];
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap };
}
function vZones(name: string, wide: boolean, block: Slot[], zones: number, grid: [number, number], tail: ChannelMapEntry[], master: Slot[] = []): FixtureMode {
  const channelMap = [...Array.from({ length: zones }, () => expand(block, wide)).flat(), ...expand(master, wide), ...tail];
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap, pixels: zones, grid };
}
const VORTEX_GRID: Record<number, [number, number]> = { 4: [2, 2], 8: [4, 2], 24: [6, 4] };
const VORTEX_BARS: Record<number, number> = { 4: 2, 8: 4, 24: 6 };
// Zone order matches the panel: zone 1 top-left, left→right, then next row (Creamsource zoning photo).
const vortexModes = (zones: number): FixtureMode[] => {
  const multi = zones > 1;
  const grid = VORTEX_GRID[zones] ?? [zones, 1];
  const bars = VORTEX_BARS[zones] ?? 2;
  const MZ = (n: number, label: string, wide: boolean, block: Slot[]) => vZones(`${n} Multi-Zone ${label} ${wide ? 16 : 8}-bit (${zones} zones)`, wide, block, zones, grid, [V_FAN, V_CTRL]);
  const SZ = (n: number, label: string, wide: boolean, block: Slot[]) => vZones(`${n} Split Zone ${label} ${wide ? 16 : 8}-bit (2 zones)`, wide, block, 2, [2, 1], [V_FAN, V_CTRL, V_ORIENT]);
  const BZ = (n: number, label: string, wide: boolean, block: Slot[]) => vZones(`${n} Bars Zone ${label} ${wide ? 16 : 8}-bit (${bars} bars)`, wide, block, bars, [bars, 1], [V_FAN, V_CTRL, V_ORIENT]);
  const GZ = (n: number, label: string, wide: boolean, block: Slot[]) => vZones(`${n} Grid Zone ${label} ${wide ? 16 : 8}-bit (4 zones)`, wide, block, 4, [2, 2], [V_FAN, V_CTRL]);
  // Effects and gel slots stay 8-bit even in 16-bit modes (chart modes 18–20, 24–26).
  const fx = (_wide: boolean) => labelled(V_FX, V_FX_LABELS, false);
  const gel = labelled(V_GEL, V_GEL_LABELS, false);
  const bump = (w: boolean) => labelled(V_BUMP, V_BUMP_LABELS, w);
  const flexLen = zones === 24 ? 387 : zones === 8 ? 131 : zones === 4 ? 67 : 131;
  // Saved projects store mode indices: the first 16 entries keep their original order, the rest follow.
  return [
    vSingle("1 CCT RGBW 8-bit", false, V_CCTRGBW),
    vSingle("2 CCT 8-bit", false, V_CCT),
    vSingle("3 CCT HS 8-bit", false, V_CCTHS),
    vSingle("4 RGBW 8-bit", false, V_RGBW),
    vSingle("5 HS 8-bit", false, V_HS),
    vSingle("6 CCT RGBW 16-bit", true, V_CCTRGBW),
    vSingle("7 CCT 16-bit", true, V_CCT),
    vSingle("8 CCT HS 16-bit", true, V_CCTHS),
    vSingle("9 RGBW 16-bit", true, V_RGBW),
    vSingle("10 HS 16-bit", true, V_HS),
    vSingle("11 xy 8-bit", false, V_XY),
    vSingle("12 CCT xy 8-bit", false, V_CCTXY),
    vSingle("13 xy 16-bit", true, V_XY),
    vSingle("14 CCT xy 16-bit", true, V_CCTXY),
    ...(multi ? [MZ(32, "CCT RGBW", false, V_CCTRGBW), MZ(38, "CCT HS", false, V_CCTHS)] : []),
    vSingle("15 CCT HS + Effects 8-bit", false, V_CCTHS, fx(false)),
    vSingle("16 CCT RGBW + Effects 8-bit", false, V_CCTRGBW, fx(false)),
    vSingle("17 CCT xy + Effects 8-bit", false, V_CCTXY, fx(false)),
    vSingle("18 CCT HS + Effects 16-bit", true, V_CCTHS, fx(true)),
    vSingle("19 CCT RGBW + Effects 16-bit", true, V_CCTRGBW, fx(true)),
    vSingle("20 CCT xy + Effects 16-bit", true, V_CCTXY, fx(true)),
    vSingle("21 Gels 8-bit", false, V_DIM, gel),
    vSingle("22 CCT Gels 8-bit", false, V_CCT, ["Crossfade"], gel),
    vSingle("23 CCT Gels + Effects 8-bit", false, V_CCT, ["Crossfade"], gel, fx(false)),
    vSingle("24 Gels 16-bit", true, V_DIM, gel),
    vSingle("25 CCT Gels 16-bit", true, V_CCT, ["Crossfade"], gel),
    vSingle("26 CCT Gels + Effects 16-bit", true, V_CCT, ["Crossfade"], gel, fx(true)),
    vSingle("27 Gels + Colour Bump 8-bit", false, V_DIM, gel, bump(false)),
    vSingle("28 CCT Gels + Colour Bump 8-bit", false, V_CCT, ["Crossfade"], gel, bump(false)),
    vSingle("29 Gels + Colour Bump 16-bit", true, V_DIM, gel, bump(true)),
    vSingle("30 CCT Gels + Colour Bump 16-bit", true, V_CCT, ["Crossfade"], gel, bump(true)),
    ...(multi
      ? [
          { name: `31 FLEX (${flexLen} ch)`, channels: flexLen, kind: "full" as const, source: "manufacturer" as const, channelMap: [lab("Flex Mode Select"), ...Array.from({ length: flexLen - 1 }, () => ({ attr: "Spare" as ChannelAttr }))] },
          MZ(33, "HS", false, V_HS),
          MZ(34, "xy", false, V_XY),
          MZ(35, "CCT RGBW", true, V_CCTRGBW),
          MZ(36, "HS", true, V_HS),
          MZ(37, "xy", true, V_XY),
          MZ(39, "CCT HS", true, V_CCTHS),
          SZ(40, "CCT RGBW", false, V_CCTRGBW), SZ(41, "HS", false, V_HS), SZ(42, "xy", false, V_XY), SZ(43, "CCT HS", false, V_CCTHS),
          SZ(44, "CCT RGBW", true, V_CCTRGBW), SZ(45, "HS", true, V_HS), SZ(46, "xy", true, V_XY), SZ(47, "CCT HS", true, V_CCTHS),
          BZ(48, "CCT RGBW", false, V_CCTRGBW), BZ(49, "HS", false, V_HS), BZ(50, "xy", false, V_XY), BZ(51, "CCT HS", false, V_CCTHS),
          BZ(52, "CCT RGBW", true, V_CCTRGBW), BZ(53, "HS", true, V_HS), BZ(54, "xy", true, V_XY), BZ(55, "CCT HS", true, V_CCTHS),
          GZ(56, "CCT RGBW", false, V_CCTRGBW), GZ(57, "HS", false, V_HS), GZ(58, "xy", false, V_XY), GZ(59, "CCT HS", false, V_CCTHS),
          GZ(60, "CCT RGBW", true, V_CCTRGBW), GZ(61, "HS", true, V_HS), GZ(62, "xy", true, V_XY), GZ(63, "CCT HS", true, V_CCTHS),
          vZones(`64 Multi-Zone RGBW Bare 8-bit (${zones} zones)`, false, V_RGBW_BARE, zones, grid, []),
          vZones(`65 Multi-Zone RGBW + Master CCT 8-bit (${zones} zones)`, false, V_RGBW_BARE, zones, grid, [V_FAN, V_CTRL], V_CCT),
          vZones(`66 Multi-Zone RGBW Bare 16-bit (${zones} zones)`, true, V_RGBW_BARE, zones, grid, []),
          vZones(`67 Multi-Zone RGBW + Master CCT 16-bit (${zones} zones)`, true, V_RGBW_BARE, zones, grid, [V_FAN, V_CTRL], V_CCT),
          MZ(68, "CCT xy", false, V_CCTXY),
          MZ(69, "CCT xy", true, V_CCTXY),
          SZ(70, "CCT xy", false, V_CCTXY), SZ(71, "CCT xy", true, V_CCTXY),
          BZ(72, "CCT xy", false, V_CCTXY), BZ(73, "CCT xy", true, V_CCTXY),
          GZ(74, "CCT xy", false, V_CCTXY), GZ(75, "CCT xy", true, V_CCTXY),
        ]
      : []),
  ];
};
export const vortexProfileModes = vortexModes;

// Creamsource Sky/SpaceX DMX Tables V2.0 (RGBWA engine, Fan last). CCT 2200–15000K.
const X_CCTRGBWA: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue", "White", "Amber"];
const X_RGBWA: Slot[] = ["Dimmer", "Red", "Green", "Blue", "White", "Amber"];
const SPACEX_MODES: FixtureMode[] = [
  mm("1 CCT RGBWA 8-bit", [[X_CCTRGBWA, false], [[SP], false]]),
  mm("2 CCT 8-bit", [[V_CCT, false], [[SP], false]]),
  mm("3 CCT HS 8-bit", [[V_CCTHS, false], [[SP], false]]),
  mm("4 RGBWA 8-bit", [[X_RGBWA, false], [[SP], false]]),
  mm("5 HS 8-bit", [[V_HS, false], [[SP], false]]),
  mm("6 CCT RGBWA 16-bit", [[X_CCTRGBWA, true], [[SP], false]]),
  mm("7 CCT 16-bit", [[V_CCT, true], [[SP], false]]),
  mm("8 CCT HS 16-bit", [[V_CCTHS, true], [[SP], false]]),
  mm("9 RGBWA 16-bit", [[X_RGBWA, true], [[SP], false]]),
  mm("10 HS 16-bit", [[V_HS, true], [[SP], false]]),
  mm("11 xy 8-bit", [[V_XY, false], [[SP], false]]),
  mm("12 CCT xy 8-bit", [[V_CCTXY, false], [[SP], false]]),
  mm("13 xy 16-bit", [[V_XY, true], [[SP], false]]),
  mm("14 CCT xy 16-bit", [[V_CCTXY, true], [[SP], false]]),
];

// Aputure STORM 1200x DMX Profile Specification V1.5 (docs.aputure.com). CCT 2500–10000K.
// Control tail = Strobe, Control Channel, Fan (8-bit). FX block = Crossfade, Trigger, Effect, Frequency.
const A_CTRL: Slot[] = [SP, SP, SP];
const A_FX: Slot[] = ["Crossfade", SP, SP, SP];
const A_CCT: Slot[] = ["Dimmer", "CCT", GM];
const A_XY: Slot[] = ["Dimmer", ...XY];
const A_CCTXY: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", ...XY];
const A_CCTRGB: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"];
const A_HSIC: Slot[] = ["Dimmer", "CCT", GM, "Hue", "Saturation"];
const A_RGB: Slot[] = ["Red", "Green", "Blue"];
const A_RGBA: Slot[] = ["Red", "Green", "Blue", "Amber"];
const stormProfiles = (base: string, core: Slot[], fx: boolean): FixtureMode[] => [
  mm(`${base} 8-bit`, [[core, false]]),
  mm(`${base} 16-bit`, [[core, true]]),
  mm(`${base} Control 8-bit`, [[core, false], [A_CTRL, false]]),
  mm(`${base} Control 16-bit`, [[core, true], [A_CTRL, false]]),
  ...(fx
    ? [
        mm(`${base} Control & FX 8-bit`, [[core, false], [A_FX, false], [A_CTRL, false]]),
        mm(`${base} Control & FX 16-bit`, [[core, true], [A_FX, false], [A_CTRL, false]]),
      ]
    : []),
];
const STORM1200X_MODES: FixtureMode[] = [
  ...stormProfiles("1-6 CCT+", A_CCT, true).map((m, i) => ({ ...m, name: m.name.replace(/^1-6 /, `${[1, 2, 3, 4, 5, 6][i]} `) })),
  ...stormProfiles("7-12 xy", A_XY, true).map((m, i) => ({ ...m, name: m.name.replace(/^7-12 /, `${[7, 8, 9, 10, 11, 12][i]} `) })),
  ...stormProfiles("13-16 CCT & xy", A_CCTXY, false).map((m, i) => ({ ...m, name: m.name.replace(/^13-16 /, `${[13, 14, 15, 16][i]} `) })),
  ...stormProfiles("17-20 Limited CCT & RGB", A_CCTRGB, false).map((m, i) => ({ ...m, name: m.name.replace(/^17-20 /, `${[17, 18, 19, 20][i]} `) })),
  ...stormProfiles("21-24 Limited HSIC+", A_HSIC, false).map((m, i) => ({ ...m, name: m.name.replace(/^21-24 /, `${[21, 22, 23, 24][i]} `) })),
  ...stormProfiles("25-28 RGB", A_RGB, false).map((m, i) => ({ ...m, name: m.name.replace(/^25-28 /, `${[25, 26, 27, 28][i]} `) })),
  ...stormProfiles("29-32 RGBA", A_RGBA, false).map((m, i) => ({ ...m, name: m.name.replace(/^29-32 /, `${[29, 30, 31, 32][i]} `) })),
];

// Astera DMX Profiles for PlutoFresnel (AF80) and LeoFresnel (AF250), V1 (astera-led.com). Titan engine 1750–20000K.
const F_RGB: Slot[] = ["Red", "Green", "Blue"];
const F_RGBW: Slot[] = ["Red", "Green", "Blue", "White"];
const F_RGBAW: Slot[] = ["Red", "Green", "Blue", "Amber", "White"];
const F_CCTRGB: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"];
const F_CCTHS: Slot[] = ["Dimmer", "CCT", GM, "Hue", "Saturation"];
const F_XY: Slot[] = ["Dimmer", ...XY];
const ASTERA_FRESNEL_MODES: FixtureMode[] = [
  mm("1 RGB", [[F_RGB, false]]),
  mm("2 RGBW", [[F_RGBW, false]]),
  mm("3 RGBAW", [[F_RGBAW, false]]),
  mm("4 DIM RGB", [[["Dimmer", ...F_RGB], false]]),
  mm("5 DIM RGBW", [[["Dimmer", ...F_RGBW], false]]),
  mm("6 DIM RGBAW", [[["Dimmer", ...F_RGBAW], false]]),
  mm("7 RGB CCT DIM IND", [[[...F_RGB, "CCT", "Dimmer", SP], false]]),
  mm("89 D CCT GM CRO RGB", [[F_CCTRGB, false]]),
  mm("90 D CCT GM HUE SAT", [[F_CCTHS, false]]),
  mm("91 D16 CCT GM C RGB", [[["Dimmer"], true], [["CCT", GM, "Crossfade", "Red", "Green", "Blue"], false]]),
  mm("92 D16 CCT GM H SAT", [[["Dimmer"], true], [["CCT", GM], false], [["Hue"], true], [["Saturation"], false]]),
  mm("93 D16 X Y", [[["Dimmer"], true], [XY, true]]),
];

// Quasar Science RR/R2 DMX Chart v0.9a (quasarscience.com). Per-pixel channel groups, CCT 1750–10000K.
const Q_HSIC: Slot[] = ["Dimmer", "CCT", GM, "Hue", "Saturation"];
const Q_HSI: Slot[] = ["Hue", "Saturation", "Dimmer"];
const Q_XFCC: Slot[] = ["Dimmer", "CCT", GM];
const Q_XF: Slot[] = ["Dimmer", "CCT"];
const Q_CCTRGB: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"];
const Q_RGB: Slot[] = ["Red", "Green", "Blue"];
const Q_XY: Slot[] = ["Dimmer", ...XY];
const quasarModes = (px: number): FixtureMode[] => {
  const P = { count: px, master: false };
  return [
    mm("1 HSIC 8-bit", [[Q_HSIC, false]], P),
    mm("3 HSI 8-bit", [[Q_HSI, false]], P),
    mm("4 XFade +CC 8-bit", [[Q_XFCC, false]], P),
    mm("5 XFade 8-bit", [[Q_XF, false]], P),
    mm("6 CCT & RGB 8-bit", [[Q_CCTRGB, false]], P),
    mm("7 CCT & RGB 16-bit", [[["Dimmer"], true], [["CCT", GM], false], [["Crossfade"], true], [Q_RGB, false]], P),
    mm("8 RGB 8-bit", [[Q_RGB, false]], P),
    mm("19 xy 8-bit", [[Q_XY, false]], P),
  ];
};


// Nanlux / Nanlite official DMX Reference Guides (Evoke 1200 V2 2021-11-03, Evoke 1200B V2 2022-08-30, Evoke 2400B,
// Forza 500B II V1 2022-12-28, Forza 720 V2 2021-12-25, Forza 720B). "Reduced" = DMX Reduced Channels ON (tail slots dropped).
// Ultimate modes are fixed-length; channel 2 selects CCT/Daylight (0) or Effect (64) and is held at that value.
const FAN: Slot = ["Spare", 0];
const STROBE: Slot = ["Strobe", 0];
const NA = (n: number): Slot[] => Array.from({ length: n }, () => SP);
const ULT_CCT: Slot = ["Spare", 0];
const ULT_FX: Slot = ["Spare", 0.2549];
const nl = (name: string, parts: [Slot[], boolean][]) => mm(name, parts);
const EVOKE1200_MODES: FixtureMode[] = [
  nl("Daylight 8bit", [[["Dimmer", FAN], false]]),
  nl("Daylight 16bit", [[["Dimmer"], true], [[FAN], false]]),
  nl("Ultimate DMX 8bit - Daylight", [[["Dimmer", ULT_CCT, ...NA(7), FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(7), FAN], false]]),
];
const FORZA720_MODES = EVOKE1200_MODES;
const EVOKE1200B_MODES: FixtureMode[] = [
  nl("CCT 8bit", [[["Dimmer", "CCT", FAN, STROBE, SP, SP], false]]),
  nl("CCT 8bit (Reduced)", [[["Dimmer", "CCT"], false]]),
  nl("CCT 16bit", [[["Dimmer", "CCT"], true], [[FAN, STROBE, ...NA(4)], false]]),
  nl("CCT 16bit (Reduced)", [[["Dimmer", "CCT"], true]]),
  nl("Ultimate DMX 8bit - CCT", [[["Dimmer", ULT_CCT, "CCT", ...NA(7), FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(8), FAN], false]]),
];
const FORZA720B_MODES: FixtureMode[] = [
  nl("CCT 8bit", [[["Dimmer", "CCT", FAN], false]]),
  nl("CCT 16bit", [[["Dimmer", "CCT"], true], [[FAN], false]]),
  nl("Ultimate DMX 8bit - CCT", [[["Dimmer", ULT_CCT, "CCT", ...NA(7), FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(8), FAN], false]]),
];
const FORZA500BII_MODES: FixtureMode[] = [
  nl("CCT 8bit", [[["Dimmer", "CCT", GM, FAN, STROBE, SP, SP], false]]),
  nl("CCT 8bit (Reduced)", [[["Dimmer", "CCT", GM], false]]),
  nl("CCT 16bit", [[["Dimmer", "CCT", GM], true], [[FAN, STROBE, ...NA(4)], false]]),
  nl("CCT 16bit (Reduced)", [[["Dimmer", "CCT", GM], true]]),
  nl("Ultimate DMX 8bit - CCT", [[["Dimmer", ULT_CCT, "CCT", GM, ...NA(7), FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(9), FAN], false]]),
];
const ZOOM: Slot = ["Zoom", 0];
const EVOKE2400B_MODES: FixtureMode[] = [
  nl("CCT 8bit", [[["Dimmer", "CCT", GM, ZOOM, SP, SP, FAN, STROBE, SP, SP], false]]),
  nl("CCT 8bit (Reduced)", [[["Dimmer", "CCT", GM, ZOOM, SP, SP], false]]),
  nl("CCT 16bit", [[["Dimmer", "CCT", GM], true], [[ZOOM, SP, SP, FAN, STROBE, ...NA(4)], false]]),
  nl("CCT 16bit (Reduced)", [[["Dimmer", "CCT", GM], true], [[ZOOM, SP, SP], false]]),
  nl("Ultimate DMX 8bit - CCT", [[["Dimmer", ULT_CCT, "CCT", GM, ...NA(7), ZOOM, SP, SP, FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(9), ZOOM, SP, SP, FAN], false]]),
];

// Nanlux Evoke 150C / 600C DMX Charts V1.2 (Nebula C8 engine, 1000–20000K, Zoom added in V1.2).
// Every mode ends with Fan, Strobe, Zoom (default 127) + 4 reserved; "Reduced" drops that tail.
const C8_TAIL: Slot[] = [FAN, STROBE, ["Zoom", 0.498], ...NA(4)];
const C8_RGBW: Slot[] = ["Red", "Green", "Blue", "White"];
const C8_DIRECT: Slot[] = ["Red", "Red", "Amber", "Green", "Green", SP, "Blue", "Blue"]; // Deep Red, Red, Amber, Lime, Green, Cyan (held at 0), Blue, Indigo
const C8_XY: Slot[] = [["Spare", 0.3127 / 0.8], ["Spare", 0.329 / 0.8]];
function c8(name: string, eight: Slot[], wide: Slot[] = eight, extra8: Slot[] = []): FixtureMode[] {
  // wide = slots sent as 16-bit; extra8 = slots that stay 8-bit in the 16-bit chart (crossfade, gel brand…)
  return [
    mm(`${name} 8bit`, [[[...eight, ...C8_TAIL], false]]),
    mm(`${name} 8bit (Reduced)`, [[eight, false]]),
    mm(`${name} 16bit`, [...wide.length ? [[wide, true] as [Slot[], boolean]] : [], [[...extra8, ...C8_TAIL], false]]),
    mm(`${name} 16bit (Reduced)`, [...wide.length ? [[wide, true] as [Slot[], boolean]] : [], [extra8, false]]),
  ];
}
const XF: Slot = "Crossfade";
const C8_MODES: FixtureMode[] = [
  ...c8("CCT & RGBW", ["Dimmer", "CCT", GM, XF, ...C8_RGBW]).map((m, i) => (i % 4 > 1 ? mm(m.name, [[["Dimmer", "CCT", GM], true], [[XF], false], [C8_RGBW, true], [i === 2 ? C8_TAIL : [], false]]) : m)),
  ...c8("CCT & HSI", ["Dimmer", "CCT", GM, XF, "Hue", "Saturation"]).map((m, i) => (i === 0 ? mm(m.name, [[["Dimmer", "CCT", GM, XF, "Hue", "Saturation", ...C8_TAIL.slice(0, 6)], false]]) : i % 4 > 1 ? mm(m.name, [[["Dimmer", "CCT", GM], true], [[XF], false], [["Hue", "Saturation"], true], [i === 2 ? C8_TAIL : [], false]]) : m)),
  ...c8("CCT & C8-Direct", ["Dimmer", "CCT", GM, XF, ...C8_DIRECT]).map((m, i) => (i % 4 > 1 ? mm(m.name, [[["Dimmer", "CCT", GM], true], [[XF], false], [C8_DIRECT, true], [i === 2 ? C8_TAIL : [], false]]) : m)),
  ...c8("CCT & XY Coordinates", ["Dimmer", "CCT", GM, XF, ...C8_XY]).map((m, i) => (i % 4 > 1 ? mm(m.name, [[["Dimmer", "CCT", GM], true], [[XF], false], [C8_XY, true], [i === 2 ? C8_TAIL : [], false]]) : m)),
  ...c8("CCT", ["Dimmer", "CCT", GM]),
  ...c8("HSI", ["Dimmer", "Hue", "Saturation"]),
  ...c8("RGBW", ["Dimmer", ...C8_RGBW]),
  ...c8("C8-Direct", ["Dimmer", ...C8_DIRECT]),
  ...c8("XY Coordinates", ["Dimmer", ...C8_XY]),
  ...c8("RGB (No Dimmer)", ["Red", "Green", "Blue"]),
  ...c8("Gel", ["Dimmer", SP, SP, SP], ["Dimmer"], [SP, SP, SP]),
];

// Nanlux Dyno 650C/1200C DMX Reference Guide B V2 2023-02-05 — Ultimate DMX 8bit modes (15 ch; ch2 selects the sub-mode).
const DYNO_FAN: Slot = ["Spare", 0];
const dynoUlt = (name: string, sel: number, body: Slot[]) => mm(`Ultimate DMX 8bit - ${name}`, [[["Dimmer", ["Spare", sel / 255], ...body, DYNO_FAN, ...NA(8)], false]]);
const DYNO_ULTIMATE: FixtureMode[] = [
  dynoUlt("CCT", 0, ["CCT", GM, SP, SP]),
  dynoUlt("HSI", 32, ["Hue", "Saturation", SP, SP]),
  dynoUlt("RGBW", 64, ["Red", "Green", "Blue", "White"]),
  dynoUlt("XY", 96, [["Spare", 0.3127], ["Spare", 0.329], SP, SP]),
  dynoUlt("Gel", 128, [SP, SP, SP, SP]),
  dynoUlt("Effect", 160, [SP, SP, SP, SP]),
];
/** Official modes missing from an otherwise correct community profile; appended (never reordered) by gdtf-curate. */
export const VERIFIED_EXTRA_MODES: { brand: string; model: string; modes: FixtureMode[] }[] = [
  { brand: "Nanlux", model: "Dyno 650C", modes: DYNO_ULTIMATE },
  { brand: "Nanlux", model: "Dyno 1200C", modes: DYNO_ULTIMATE },
];

// Aputure LS 600c Pro / Pro II DMX Profile Specification V1.6 (docs.aputure.com, April 2026). CCT 2300–10000K.
// G/M 0–10 = neutral, so the console's G/M 0 (raw 0) is exactly neutral. Strobe 0–19 = no effect.
const A_STROBE = lab("Strobe");
const A_BASE = lab("HSI Base CCT");
const A_GEL = ["Gel CCT 3200/5600", "Rosco / Lee", "Gel Series", "Gel Category"].map(lab);
const A_SRC = ["Source", "Source x offset", "Source y offset"].map(lab);
const aBase = (wide: boolean): ChannelMapEntry[] => (wide ? [lab("HSI Base CCT"), { attr: "Spare", fine: true, label: "HSI Base CCT" }] : [A_BASE]);
const aMode = (name: string, wide: boolean, ...parts: VPart[]): FixtureMode => {
  const channelMap = parts.flatMap((p) => (isEntries(p) ? p : expand(p as Slot[], wide)));
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap };
};
const aFx = (n: number) => Array.from({ length: n }, (_, i) => lab(i === 0 ? "FX Effect" : `FX Param ${i}`));
const APUTURE_600C_MODES: FixtureMode[] = [
  aMode("1 CCT & RGB 8-bit", false, ["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue"], [A_STROBE]),
  aMode("2 CCT 8-bit", false, ["Dimmer", "CCT", "GM"], [A_STROBE]),
  aMode("3 CCT & HSI 8-bit", false, ["Dimmer", "CCT", "GM", "Crossfade", "Hue", "Saturation"], aBase(false), [A_STROBE]),
  aMode("4 RGB 8-bit", false, ["Dimmer", "Red", "Green", "Blue"], [A_STROBE]),
  aMode("5 HSI 8-bit", false, ["Dimmer", "Hue", "Saturation"], aBase(false), [A_STROBE]),
  aMode("6 GEL 8-bit", false, ["Dimmer"], A_GEL, [A_STROBE]),
  aMode("7 xy 8-bit", false, ["Dimmer", ...XY], [A_STROBE]),
  aMode("8 Source 8-bit", false, ["Dimmer"], A_SRC, [A_STROBE]),
  aMode("9 FX 8-bit", false, ["Dimmer"], aFx(9)),
  aMode("10 WW & RGB 8-bit", false, ["White", "White", "Red", "Green", "Blue"]),
  aMode("11 Ultimate 8-bit", false, ["Dimmer"], [lab("Lighting Mode")], ["CCT", "GM", "Crossfade", "Red", "Green", "Blue"], [A_STROBE, lab("Ultimate param"), lab("Ultimate param")]),
  aMode("12 CCT & RGB 16-bit", true, ["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue"], [A_STROBE]),
  aMode("13 CCT 16-bit", true, ["Dimmer", "CCT", "GM"], [A_STROBE]),
  aMode("14 CCT & HSI 16-bit", true, ["Dimmer", "CCT", "GM", "Crossfade", "Hue", "Saturation"], aBase(true), [A_STROBE]),
  aMode("15 RGB 16-bit", true, ["Dimmer", "Red", "Green", "Blue"], [A_STROBE]),
  aMode("16 HSI 16-bit", true, ["Dimmer", "Hue", "Saturation"], aBase(true), [A_STROBE]),
  aMode("17 GEL 16-bit", true, ["Dimmer"], A_GEL, [A_STROBE]),
  aMode("18 xy 16-bit", true, ["Dimmer", ...XY], [A_STROBE]),
  aMode("19 Source 16-bit", true, ["Dimmer"], A_SRC, [A_STROBE]),
  aMode("20 FX 16-bit", true, ["Dimmer"], aFx(10)),
  aMode("21 WW & RGB 16-bit", true, ["White", "White", "Red", "Green", "Blue"]),
  aMode("22 Ultimate 16-bit", true, ["Dimmer"], [lab("Lighting Mode")], ["CCT", "GM", "Crossfade", "Red", "Green", "Blue"], [A_STROBE]),
];

// Aputure Nova P600c DMX Profile Specification V1.1.1 (docs.aputure.com, May 2022). CCT 2000–10000K, 4 light engines.
const nEngines = (name: string, wide: boolean, block: Slot[]): FixtureMode => vZones(name, wide, block, 4, [4, 1], []);
const nParams = (n: number) => Array.from({ length: n }, (_, i) => lab(`Ultimate param ${i + 1}`));
const NOVA_P600C_MODES: FixtureMode[] = [
  ...APUTURE_600C_MODES.slice(0, 8).map((m) => ({ ...m })),
  aMode("9 FX 8-bit", false, ["Dimmer"], aFx(20)),
  aMode("10 WW & RGB 8-bit", false, ["White", "White", "Red", "Green", "Blue"]),
  nEngines("11 Light Engine CCT & RGB 8-bit (4 engines)", false, ["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue"]),
  nEngines("12 Light Engine HSI 8-bit (4 engines)", false, ["Dimmer", "Hue", "Saturation", ["Spare", 0]]),
  nEngines("13 Light Engine xy 8-bit (4 engines)", false, ["Dimmer", ...XY]),
  aMode("14 Ultimate 8-bit", false, ["Dimmer"], [lab("Lighting Mode")], nParams(20)),
  ...APUTURE_600C_MODES.slice(11, 19).map((m, i) => ({ ...m, name: m.name.replace(/^\d+/, String(15 + i)) })),
  aMode("23 FX 16-bit", true, ["Dimmer"], aFx(33)),
  aMode("24 WW & RGB 16-bit", true, ["White", "White", "Red", "Green", "Blue"]),
  nEngines("25 Light Engine CCT & RGB 16-bit (4 engines)", true, ["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue"]),
  nEngines("26 Light Engine HSI 16-bit (4 engines)", true, ["Dimmer", "Hue", "Saturation", ["Spare", 0]]),
  nEngines("27 Light Engine xy 16-bit (4 engines)", true, ["Dimmer", ...XY]),
  aMode("28 Ultimate 16-bit", true, ["Dimmer"], [lab("Lighting Mode")], nParams(33)),
];


// ARRI Orbiter V5.0: each mode pair (8/16 bit) × ECC off/on × Operation off/on, exactly as the chart allows.
const ORB_ATTR: Record<string, Slot> = {
  Dimmer: "Dimmer", "Color Temperature CCT": "CCT", "Green - Magenta Point": GM, Hue: "Hue", Saturation: "Saturation",
  "Intensity Red": "Red", "Intensity Green": "Green", "Intensity Blue": "Blue", "Intensity Amber": "Amber", "Intensity White": "White",
  "Cross Fade to Color": "Crossfade", Zoom: ["Zoom", 0], Focus: ["Focus", 0], X: ["Spare", 0.3127], Y: ["Spare", 0.329],
};
const ORB_ECC = ["Warmer / Cooler", "Saturate / Desaturate", "+/- Red", "+/- Green", "+/- Blue", "+/- Cyan", "+/- Magenta", "+/- Yellow"];
const ORB_OP = ["Fan Control", "Favorites", "Light Strobe", "Color Sensor", "Sync"];
function orbiterModes(): FixtureMode[] {
  const out: FixtureMode[] = [];
  for (const t of ORBITER_TABLE) for (const wide of [false, true]) for (const ecc of [false, true]) for (const op of [false, true]) {
    const channelMap: ChannelMapEntry[] = t.rows.flatMap(([label, w16]) => {
      const slot = ORB_ATTR[label];
      const entries = slot ? expand([slot], wide && w16) : expand([SP], wide && w16);
      return entries.map((e) => (slot && label !== "X" && label !== "Y" ? e : { ...e, label }));
    });
    if (ecc) channelMap.push(...ORB_ECC.flatMap((l) => expand([["Spare", 0]], wide).map((e) => ({ ...e, label: l }))));
    if (op) channelMap.push(...ORB_OP.map(lab));
    const n = t.n + (wide ? 1 : 0);
    out.push({ name: `Mode ${n} - ${t.name} ${wide ? "16" : "8"}bit${ecc ? " + ECC" : ""}${op ? " + Operation" : ""}`, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap });
  }
  return out;
}

// Aputure Nova P300c DMX Profile Specification V1.1 (Sept 2022, controller FW 1.8). 8-bit only, CCT 2000–10000K.
const nm = (name: string, ...entries: (Slot | ChannelMapEntry)[]): FixtureMode => {
  const channelMap = entries.flatMap((e) => (typeof e === "object" && !Array.isArray(e) ? [e as ChannelMapEntry] : expand([e as Slot], false)));
  return { name, channels: channelMap.length, kind: "full", source: "manufacturer", channelMap };
};
const NOVA_P300C_MODES: FixtureMode[] = [
  nm("Mode 1 - CCT & RGB 8-bit", "Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"),
  nm("Mode 2 - CCT 8-bit", "Dimmer", "CCT", GM),
  nm("Mode 3 - CCT & HSI 8-bit", "Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation"),
  nm("Mode 4 - GEL 8-bit", "Dimmer", lab("Gel CCT 3200/5600"), lab("Rosco / Lee"), lab("Gel Series"), lab("Gel Category")),
  nm("Mode 5 - HSI 8-bit", "Dimmer", "Hue", "Saturation"),
  nm("Mode 6 - Source 8-bit", "Dimmer", lab("Source")),
  nm("Mode 7 - RGB 8-bit", "Dimmer", "Red", "Green", "Blue"),
  nm("Mode 8 - XY 8-bit", "Dimmer", { attr: "Spare", label: "X", home: 0.3127 / 0.8 }, { attr: "Spare", label: "Y", home: 0.329 / 0.8 }),
  nm("Mode 9 - FX 8-bit", lab("FX Selection"), "Dimmer", ...Array.from({ length: 8 }, (_, i) => lab(`FX Param ${i + 1}`))),
];

// Aputure MC Pro DMX Profile Specification V2.0 (02/2025, FW 2.0). CCT 2000–10000K; 16-bit modes widen every
// continuous channel (incl. ±Green) but keep Strobe, Gel and Source selectors 8-bit.
const MC_ST = lab("Strobe");
const MC_P = (n: number): Slot[] => Array.from({ length: n }, () => "Spare" as Slot);
const MC_GEL: ChannelMapEntry[] = [lab("Gel CCT 3200/5600"), lab("Rosco / Lee"), lab("Gel Series"), lab("Gel Category")];
const mcx = (name: string, parts: [Slot[], boolean][], tail: ChannelMapEntry[]): FixtureMode => {
  const m = mm(name, parts);
  const channelMap = [...(m.channelMap ?? []), ...tail];
  return { ...m, channels: channelMap.length, channelMap };
};
const MC_PRO_MODES: FixtureMode[] = [
  nm("Mode 1 - CCT & RGB 8-bit", "Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue", MC_ST),
  nm("Mode 2 - CCT 8-bit", "Dimmer", "CCT", GM, MC_ST),
  nm("Mode 3 - CCT & HSI 8-bit", "Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation", MC_ST),
  nm("Mode 4 - RGB 8-bit", "Dimmer", "Red", "Green", "Blue", MC_ST),
  nm("Mode 5 - HSIC 8-bit", "Dimmer", "Hue", "Saturation", "CCT", MC_ST),
  nm("Mode 6 - Gel 8-bit", "Dimmer", ...MC_GEL, MC_ST),
  nm("Mode 7 - xy 8-bit", "Dimmer", { attr: "Spare", label: "X", home: 0.3127 / 0.8 }, { attr: "Spare", label: "Y", home: 0.329 / 0.8 }, MC_ST),
  nm("Mode 8 - Source 8-bit", "Dimmer", lab("Source"), lab("Source x offset"), lab("Source y offset"), MC_ST),
  nm("Mode 9 - FX 8-bit", "Dimmer", lab("FX Selection"), ...Array.from({ length: 8 }, (_, i) => lab(`FX Param ${i + 1}`))),
  nm("Mode 10 - WWRGB 8-bit", "White", "White", "Red", "Green", "Blue"),
  nm("Mode 11 - Ultimate 8-bit", "Dimmer", lab("Lighting Mode"), ...Array.from({ length: 9 }, (_, i) => lab(`Param ${i + 1}`))),
  nm("Mode 12 - HSIC+ 8-bit", "Dimmer", "CCT", GM, "Hue", "Saturation", MC_ST),
  mcx("Mode 13 - CCT & RGB 16-bit", [[["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"], true]], [MC_ST]),
  mcx("Mode 14 - CCT 16-bit", [[["Dimmer", "CCT", GM], true]], [MC_ST]),
  mcx("Mode 15 - CCT & HSI 16-bit", [[["Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation"], true]], [MC_ST]),
  mcx("Mode 16 - RGB 16-bit", [[["Dimmer", "Red", "Green", "Blue"], true]], [MC_ST]),
  mcx("Mode 17 - HSIC 16-bit", [[["Dimmer", "Hue", "Saturation", "CCT"], true]], [MC_ST]),
  mcx("Mode 18 - Gel 16-bit", [[["Dimmer"], true]], [...MC_GEL, MC_ST]),
  mcx("Mode 19 - xy 16-bit", [[["Dimmer", ...XY], true]], [MC_ST]),
  mcx("Mode 20 - Source 16-bit", [[["Dimmer"], true]], [lab("Source"), lab("Source x offset"), lab("Source y offset"), MC_ST]),
  mcx("Mode 21 - FX 16-bit", [[["Dimmer"], true]], [lab("FX Selection"), ...Array.from({ length: 8 }, (_, i) => lab(`FX Param ${i + 1}`))]),
  mcx("Mode 22 - WWRGB 16-bit", [[["White", "White", "Red", "Green", "Blue"], true]], []),
  mcx("Mode 23 - Ultimate 16-bit", [[["Dimmer"], true], [MC_P(0), false]], [lab("Lighting Mode"), ...Array.from({ length: 13 }, (_, i) => lab(`Param ${i + 1}`))]),
  mcx("Mode 24 - HSIC+ 16-bit", [[["Dimmer", "CCT", GM, "Hue", "Saturation"], true]], [MC_ST]),
];

// amaran PT DMX Profile Specification V1.0 (PT1c/PT2c/PT4c). CCT 2700–10000K; PT4c has all 14 modes (16 px max).
const PT_R = lab("Reserved"), PT_ST = lab("Strobe");
const PT_PX_CCT: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"];
const PT_PX_HSI: Slot[] = ["Dimmer", "Hue", "Saturation"];
const PT4C_MODES: FixtureMode[] = [
  nm("Mode 1 - CCT & RGB", "Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue", PT_R, PT_R, PT_ST),
  nm("Mode 2 - CCT", "Dimmer", "CCT", GM, PT_R, PT_R, PT_ST),
  nm("Mode 3 - CCT & HSI", "Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation", PT_R, PT_R, PT_ST),
  nm("Mode 4 - RGB", "Dimmer", "Red", "Green", "Blue", PT_R, PT_R, PT_ST),
  nm("Mode 5 - HSI", "Dimmer", "Hue", "Saturation", PT_R, PT_R, PT_ST),
  nm("Mode 6 - System FX", "Dimmer", lab("FX Trigger"), lab("FX Selection"), ...Array.from({ length: 4 }, (_, i) => lab(`FX Param ${i + 1}`))),
  ...[2, 4, 8, 16].map((n, i) => mm(`Mode ${7 + i} - Light Engine CCT & RGB ${n} px`, [[PT_PX_CCT, false]], { count: n, master: false })),
  ...[2, 4, 8, 16].map((n, i) => mm(`Mode ${11 + i} - Light Engine HSI ${n} px`, [[PT_PX_HSI, false]], { count: n, master: false })),
];

// Nanlux TK-140B/TK-280B DMX Reference Guide V1 (2020-12-25). CCT 2700–7500K.
const TK_MODES: FixtureMode[] = [
  nm("CCT 8bit", "Dimmer", "CCT"),
  mm("CCT 16bit", [[["Dimmer", "CCT"], true]]),
  nm("Ultimate 8bit", "Dimmer", lab("Mode CCT/Effect"), lab("CCT / Effect"), ...Array.from({ length: 7 }, (_, i) => lab(`Effect Param ${i + 1}`))),
];

// Aputure Electro Storm CS15 DMX Profile Specification V1.1. CCT 2000–10000K. Each profile can add Motorized
// Accessories (Zoom, Pan, Tilt; 16-bit in 16-bit profiles) and Function Configuration (Fan Mode, Dimming Curve),
// so every profile is listed in its four menu variants. Ultimate 8-bit is omitted: the chart gives no channel count.
const CS_XY: ChannelMapEntry[] = [{ attr: "Spare", label: "X", home: 0.3127 / 0.8 }, { attr: "Spare", label: "Y", home: 0.329 / 0.8 }];
const csFx = (n: number) => Array.from({ length: n }, (_, i) => lab(`FX Param ${i + 1}`));
const csCore = (wide: boolean, slots: Slot[], tail: ChannelMapEntry[]): ChannelMapEntry[] => [...expand(slots, wide), ...tail];
const CS_CORES: [number, string, boolean, ChannelMapEntry[]][] = [
  [1, "CCT & RGB", false, csCore(false, ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"], [MC_ST])],
  [2, "CCT", false, csCore(false, ["Dimmer", "CCT", GM], [MC_ST])],
  [3, "CCT & HSI", false, csCore(false, ["Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation"], [lab("HSI Base CCT"), MC_ST])],
  [4, "RGB", false, csCore(false, ["Dimmer", "Red", "Green", "Blue"], [MC_ST])],
  [5, "Adv.HSI", false, csCore(false, ["Dimmer", "Hue", "Saturation"], [lab("HSI Base CCT"), MC_ST])],
  [6, "Gel", false, csCore(false, ["Dimmer"], [...MC_GEL, MC_ST])],
  [7, "x y", false, csCore(false, ["Dimmer"], [...CS_XY, MC_ST])],
  [8, "Source", false, csCore(false, ["Dimmer"], [lab("Source"), lab("Source x offset"), lab("Source y offset"), MC_ST])],
  [9, "FX", false, csCore(false, ["Dimmer"], [lab("FX Trigger"), lab("FX Selection"), ...csFx(7)])],
  [10, "WWRGB", false, csCore(false, ["White", "White", "Red", "Green", "Blue"], [MC_ST])],
  [12, "CCT & RGB", true, csCore(true, ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue"], [MC_ST])],
  [13, "CCT", true, csCore(true, ["Dimmer", "CCT", GM], [MC_ST])],
  [14, "CCT & HSI", true, csCore(true, ["Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation", "Spare"], [MC_ST]).map((c, i) => (i === 12 || i === 13 ? { ...c, label: "HSI Base CCT" } : c))],
  [15, "RGB", true, csCore(true, ["Dimmer", "Red", "Green", "Blue"], [MC_ST])],
  [16, "Adv.HSI", true, csCore(true, ["Dimmer", "Hue", "Saturation", "Spare"], [MC_ST]).map((c, i) => (i === 6 || i === 7 ? { ...c, label: "HSI Base CCT" } : c))],
  [17, "Gel", true, csCore(true, ["Dimmer"], [...MC_GEL, MC_ST])],
  [18, "x y", true, csCore(true, ["Dimmer", ...XY], [MC_ST])],
  [19, "Source", true, csCore(true, ["Dimmer"], [lab("Source"), lab("Source x offset"), lab("Source y offset"), MC_ST])],
  [20, "FX", true, csCore(true, ["Dimmer"], [lab("FX Trigger"), lab("FX Selection"), ...csFx(9)])],
  [21, "WWRGB", true, csCore(true, ["White", "White", "Red", "Green", "Blue"], [MC_ST])],
  [22, "Ultimate", true, csCore(true, ["Dimmer"], [lab("Lighting Mode"), ...Array.from({ length: 13 }, (_, i) => lab(`Param ${i + 1}`))])],
];
const CS_MOTOR = (wide: boolean) => ["Zoom", "Pan", "Tilt"].flatMap((n) => (wide ? [lab(n), lab(`${n} fine`)] : [lab(n)]));
const CS_CONF = [lab("Fan Mode"), lab("Dimming Curve")];
const CS15_MODES: FixtureMode[] = CS_CORES.flatMap(([no, name, wide, core]) =>
  ([["", []], [" + Config", CS_CONF], [" + Motor", CS_MOTOR(wide)], [" + Motor + Config", [...CS_MOTOR(wide), ...CS_CONF]]] as [string, ChannelMapEntry[]][]).map(([suf, extra]) => {
    const channelMap = [...core, ...extra];
    return { name: `Mode ${no} - ${name} ${wide ? 16 : 8}-bit${suf}`, channels: channelMap.length, kind: "full" as const, source: "manufacturer" as const, channelMap };
  }),
);

// Aputure Electro Storm XT26 DMX Profile Specification V1.1. CCT 2700–6500K. Same Motor/Config variants as CS15.
// FX 16-bit follows the table (5 base ch: Int16, Trigger, Effect, Frequency); the TOC's "4–12" is a typo.
const XT_FX: ChannelMapEntry[] = [lab("FX Trigger"), lab("FX Selection"), lab("FX Frequency")];
const XT_CORES: [number, string, boolean, ChannelMapEntry[]][] = [
  [1, "CCT", false, csCore(false, ["Dimmer", "CCT", GM], [MC_ST])],
  [2, "FX", false, csCore(false, ["Dimmer"], XT_FX)],
  [3, "CCT & FX", false, csCore(false, ["Dimmer", "CCT", GM], [lab("CCT / FX"), ...XT_FX])],
  [4, "CCT", true, csCore(true, ["Dimmer", "CCT", GM], [MC_ST])],
  [5, "FX", true, csCore(true, ["Dimmer"], XT_FX)],
  [6, "CCT & FX", true, csCore(true, ["Dimmer", "CCT", GM], [lab("CCT / FX"), ...XT_FX])],
];
const variants = (cores: [number, string, boolean, ChannelMapEntry[]][]): FixtureMode[] => cores.flatMap(([no, name, wide, core]) =>
  ([["", []], [" + Config", CS_CONF], [" + Motor", CS_MOTOR(wide)], [" + Motor + Config", [...CS_MOTOR(wide), ...CS_CONF]]] as [string, ChannelMapEntry[]][]).map(([suf, extra]) => {
    const channelMap = [...core, ...extra];
    return { name: `Mode ${no} - ${name} ${wide ? 16 : 8}-bit${suf}`, channels: channelMap.length, kind: "full" as const, source: "manufacturer" as const, channelMap };
  }),
);

export const VERIFIED_FIXTURES: FixtureDef[] = [
  ...GODOX_FIXTURES,
  ...GEMINI_FIXTURES,
  ...DMG_FIXTURES,
  ...KINOFLO_FIXTURES,
  { id: "gdtf-aputure-xt26", brand: "Aputure", model: "XT26", cctRange: [2700, 6500], lightType: "LED bi-colour", modes: variants(XT_CORES) },
  { id: "gdtf-aputure-electro-storm-cs15", brand: "Aputure", model: "Electro Storm CS15", cctRange: [2000, 10000], lightType: "LED colour", modes: CS15_MODES },
  { id: "gdtf-nanlux-tk-140b", brand: "Nanlux", model: "TK-140B", cctRange: [2700, 7500], lightType: "LED bi-colour", modes: TK_MODES },
  { id: "gdtf-nanlux-tk-280b", brand: "Nanlux", model: "TK-280B", cctRange: [2700, 7500], lightType: "LED bi-colour", modes: TK_MODES },
  { id: "gdtf-amaran-pt4c", brand: "Amaran", model: "PT4C", cctRange: [2700, 10000], lightType: "LED colour", modes: PT4C_MODES },
  { id: "gdtf-aputure-mc-pro", brand: "Aputure", model: "MC Pro", cctRange: [2000, 10000], lightType: "LED colour", modes: MC_PRO_MODES },
  // STORM XT52 DMX Profile Spec V1.3 (06/2026, FW 1.6): profiles 1–32 unified with STORM 1200x; Aputure states 700x/400x share them.
  { id: "gdtf-aputure-storm-xt52", brand: "Aputure", model: "STORM XT52", watts: 5200, lightType: "LED daylight", modes: STORM1200X_MODES },
  { id: "gdtf-aputure-storm-700x", brand: "Aputure", model: "STORM 700x", watts: 700, lightType: "LED daylight", modes: STORM1200X_MODES },
  { id: "gdtf-aputure-storm-400x", brand: "Aputure", model: "STORM 400x", watts: 400, lightType: "LED daylight", modes: STORM1200X_MODES },
  { id: "gdtf-aputure-nova-p300c", brand: "Aputure", model: "Nova P300c", watts: 300, cctRange: [2000, 10000], lightType: "LED colour", modes: NOVA_P300C_MODES },
  { id: "gdtf-arri-orbiter", brand: "ARRI", model: "Orbiter", watts: 500, cctRange: [2000, 20000], lightType: "LED colour", modes: orbiterModes() },
  { id: "gdtf-aputure-nova-p600c", brand: "Aputure", model: "Nova P600c", watts: 600, cctRange: [2000, 10000], lightType: "LED colour", modes: NOVA_P600C_MODES },
  { id: "gdtf-aputure-ls-600c-pro", brand: "Aputure", model: "LS 600c Pro", watts: 600, cctRange: [2300, 10000], lightType: "LED colour", modes: APUTURE_600C_MODES },
  { id: "gdtf-aputure-ls-600c-pro-ii", brand: "Aputure", model: "LS 600c Pro II", watts: 600, cctRange: [2300, 10000], lightType: "LED colour", modes: APUTURE_600C_MODES },
  { id: "gdtf-nanlux-evoke-150c", brand: "Nanlux", model: "Evoke 150C", watts: 150, cctRange: [1000, 20000], lightType: "LED colour", modes: C8_MODES },
  { id: "gdtf-nanlux-evoke-600c", brand: "Nanlux", model: "Evoke 600C", cctRange: [1000, 20000], lightType: "LED colour", modes: C8_MODES },
  { id: "gdtf-nanlux-evoke-1200", brand: "Nanlux", model: "Evoke 1200", watts: 1200, lightType: "LED daylight", modes: EVOKE1200_MODES },
  { id: "gdtf-nanlux-evoke-1200b", brand: "Nanlux", model: "Evoke 1200B", watts: 1200, cctRange: [2700, 6500], lightType: "Bi-colour LED", modes: EVOKE1200B_MODES },
  { id: "gdtf-nanlux-evoke-2400b", brand: "Nanlux", model: "Evoke 2400B", watts: 2400, cctRange: [2700, 6500], lightType: "Bi-colour LED", modes: EVOKE2400B_MODES },
  { id: "gdtf-nanlite-forza-500b-ii", brand: "Nanlite", model: "Forza 500B II", cctRange: [2700, 6500], lightType: "Bi-colour LED", modes: FORZA500BII_MODES },
  { id: "gdtf-nanlite-forza-720", brand: "Nanlite", model: "Forza 720", lightType: "LED daylight", modes: FORZA720_MODES },
  { id: "gdtf-nanlite-forza-720b", brand: "Nanlite", model: "Forza 720B", cctRange: [2700, 6500], lightType: "Bi-colour LED", modes: FORZA720B_MODES },
  { id: "gdtf-sumolight-sumomax", brand: "SumoLight", model: "SUMOMAX", watts: 700, cctRange: [1800, 10000], lightType: "LED colour", modes: SUMOMAX_MODES },
  { id: "gdtf-creamsource-vortex-8", brand: "Creamsource", model: "Vortex 8", watts: 650, cctRange: [2200, 15000], lightType: "LED colour", modes: vortexModes(8) },
  { id: "gdtf-creamsource-vortex-4", brand: "Creamsource", model: "Vortex 4", watts: 325, cctRange: [2200, 15000], lightType: "LED colour", modes: vortexModes(4) },
  { id: "gdtf-creamsource-vortex-24", brand: "Creamsource", model: "Vortex 24", watts: 1800, cctRange: [2200, 15000], lightType: "LED colour", modes: vortexModes(24) },
  { id: "gdtf-creamsource-vortex-8-soft", brand: "Creamsource", model: "Vortex 8 Soft", watts: 650, cctRange: [2200, 15000], lightType: "LED colour", modes: vortexModes(1) },
  { id: "gdtf-creamsource-spacex-csx-1200-c", brand: "Creamsource", model: "SpaceX CSX-1200-C", watts: 1200, cctRange: [2200, 15000], lightType: "LED colour", modes: SPACEX_MODES },
  { id: "gdtf-aputure-storm-1200x", brand: "Aputure", model: "STORM 1200x", watts: 1200, cctRange: [2500, 10000], lightType: "LED colour", modes: STORM1200X_MODES },
  { id: "gdtf-astera-led-technology-af80-plutofresnel", brand: "Astera", model: "AF80 PlutoFresnel", watts: 80, cctRange: [1750, 20000], lightType: "LED colour", modes: ASTERA_FRESNEL_MODES },
  { id: "gdtf-astera-led-technology-af250-leofresnel", brand: "Astera", model: "AF250 LeoFresnel", watts: 250, cctRange: [1750, 20000], lightType: "LED colour", modes: ASTERA_FRESNEL_MODES },
  { id: "gdtf-quasar-science-double-rainbow-2ft", brand: "Quasar Science", model: "Double Rainbow 2ft", watts: 25, cctRange: [1750, 10000], lightType: "LED colour", modes: quasarModes(8) },
  { id: "gdtf-quasar-science-double-rainbow-4ft", brand: "Quasar Science", model: "Double Rainbow 4ft", watts: 50, cctRange: [1750, 10000], lightType: "LED colour", modes: quasarModes(16) },
];

/** Library GDTF profiles whose footprints were checked mode-by-mode against the manufacturer's own chart;
 *  gdtf-curate tags their modes as manufacturer-sourced so PATCH shows them as official. */
const ROBE_CHECKED: string[] = ["ColorSpot 250 AT", "Robin BMFL Blade", "Robin BMFL FollowSpot", "Robin BMFL FollowSpot LT", "Robin BMFL Spot", "Robin BMFL WashBeam", "Robin BMFL WashBeam EV", "Robin ColorStrobe IP", "Robin Cuete", "Robin CycFX 8", "Robin DL4F Wash", "Robin DL4X Spot", "Robin DL7F Wash", "Robin DLF Wash", "Robin DLX Spot", "Robin Esprite", "Robin Esprite Fresnel", "Robin Esprite FS", "Robin Esprite PC", "Robin Footsie1 MC", "Robin Footsie2 MC", "Robin Forte", "Robin Forte Fresnel", "Robin Forte FS", "Robin Forte PC", "Robin iBeam 250", "Robin iBeam 350", "Robin iBolt", "Robin iEsprite", "Robin iEsprite Fresnel", "Robin iEsprite LTL FS", "Robin iEsprite LTL WB", "Robin iForte", "Robin iForte FS", "Robin iForte LTX FS", "Robin iForte LTX WB", "Robin iPainte", "Robin iPAINTE LTM WB", "Robin iParFect 150 FW RGBA", "Robin iParFect 150 FW RGBW", "Robin iPointe65", "Robin iProMotion", "Robin iT12 Fresnel", "Robin iT12 PC", "Robin iT12 Profile", "Robin LEDBeam 350", "Robin LEDBeam 350 FW", "Robin LedPOINTE", "Robin MegaPointe", "Robin MiniMe", "Robin MiniPointe", "Robin MMX Blade", "Robin MMX Spot", "Robin Painte", "Robin Painte Spot", "Robin ParFect 150 FW RGBA", "Robin ParFect 150 FW RGBW", "Robin ParFect 150 RGBA", "Robin ParFect 150 RGBW", "Robin Pointe", "Robin ProMotion", "Robin SilverScan", "Robin Spikie", "Robin Spote", "Robin SuperSpikie", "Robin T1 Fresnel", "Robin T1 PC", "Robin T1 Profile", "Robin T1 Profile FS", "Robin T15 Fresnel", "Robin T15 PC", "Robin T2 Fresnel", "Robin T2 PC", "Robin T2 Profile", "Robin T2 Profile FS", "Robin T32 CYC Slim", "Robin TX1 PosiProfile", "Robin Viva", "Robin Viva CMY", "RoboSpot MotionCamera", "SVOPATT Classic"];

export const CHART_CHECKED_GDTF: { brand: string; model: string; chart: string; modesFrom?: string; padTo?: Record<string, number> }[] = [
  // Rosco Braq Cube (manual R4) and Pica Cube (manual R5) DMX Channel Layout: 4C 8-bit R,G,B,W / 16-bit coarse+fine pairs — exact match.
  { brand: "Rosco", model: "Braq Cube 4C", chart: "Rosco Braq Cube User Manual R4" },
  { brand: "Rosco", model: "Pica Cube 4C", chart: "Rosco Pica Cube User Manual R5" },
  // Robe product pages (robe.cz, "DMX Protocol modes / Control channels"): every official footprint is present
  // (1-ch modes are dropped library-wide). Robe models whose pixel/extended modes disagree stay unverified.
  ...ROBE_CHECKED.map((model) => ({ brand: "Robe", model, chart: "Robe official product specification (robe.cz)" })),
  ...Object.entries(SPEC_PAGE_CHECKED).flatMap(([brand, { chart, models }]) => models.map((model) => ({ brand, model, chart }))),
  // Nanlux Evoke 900C DMX Reference Guide (Reduced Channels OFF): all 18 standard modes match, except xy 16-bit where
  // the guide reserves ch 9–12 (12 ch) and the community file stops at 10 — padded with reserved channels.
  { brand: "Nanlux", model: "Evoke 900C", chart: "Nanlux Evoke 900C DMX Reference Guide", padTo: { "XY 16bit (16-bit)": 12 } },
  // Aputure STORM 1000c & 80c DMX Profile Spec V1.3 (05/2026): profiles 1–32 footprints 7/14/17/26/10/20/20/32/3/6/5/10/15/22/8/16/18/28/3/6/3/6/4/8/6/12/3/6/4/7/5/6 match.
  { brand: "Aputure", model: "STORM 1000C", chart: "Aputure STORM 1000c & 80c DMX Profile Specification V1.3" },
  // Same chart covers the 80c; its community profile (VRGB modes) is wrong, so it takes the 1000c's checked modes.
  { brand: "Aputure", model: "STORM 80C", chart: "Aputure STORM 1000c & 80c DMX Profile Specification V1.3", modesFrom: "STORM 1000C" },
  // ARRI SkyPanel DMX Protocol Specification V4.4 (12/2022): modes 1–10, 16–23, 30 footprints match exactly.
  ...["SkyPanel S30C", "SkyPanel S60C", "SkyPanel S120C", "SkyPanel S360C"].map((model) => ({ brand: "ARRI", model, chart: "ARRI SkyPanel DMX Protocol V4.4" })),
  // Same V4.4 document, Sxx-RP section: modes 1/2 = 5/6 channels.
  { brand: "ARRI", model: "SkyPanel S60RP", chart: "ARRI SkyPanel DMX Protocol V4.4 (Sxx-RP)" },
  // ARRI L-Series Plus DMX Protocol V4.4 (07/2024): modes 1–10, 16–27 and Extended Color Control (+8/+16) match.
  ...["L5C Plus", "L7C Plus"].map((model) => ({ brand: "ARRI", model, chart: "ARRI L-Series Plus DMX Protocol V4.4" })),
  // ARRI L-Series DMX Protocol V3.3, Lx-C section: modes 1–10 = 8/3/6/5/3/16/6/12/10/6 channels.
  // Aputure LS 600d DMX Profile Spec V1.0.1 (04/2022): modes 2/3 = 4/5 ch (1-ch mode 1 is dropped library-wide).
  { brand: "Aputure", model: "LS 600d", chart: "Aputure LS 600d DMX Profile Specification V1.0.1" },
  // Aputure LS 600d Pro / LS 300d II common spec V1.0.1 (02/2022): single Lighting & Effect mode, 5 ch.
  { brand: "Aputure", model: "LS600d pro", chart: "Aputure LS 600d Pro DMX Profile Specification V1.0.1" },
  // Aputure INFINIBAR DMX Profile Spec V2.0 (08/2024): modes 1–32 match (TOC lists RGB 16 px as 72 ch; the table itself is 64).
  ...["INFINIBAR PB3", "INFINIBAR PB6", "INFINIBAR PB12"].map((model) => ({ brand: "Aputure", model, chart: "Aputure INFINIBAR DMX Profile Specification V2.0" })),
  ...["L5-C", "L7C"].map((model) => ({ brand: "ARRI", model, chart: "ARRI L-Series DMX Protocol V3.3" })),
];
