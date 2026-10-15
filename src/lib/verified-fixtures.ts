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

// Creamsource Vortex DMX Tables V3.1 rev A (knowledge.creamsource.com). CCT 2200–15000K. Fan + Control are 8-bit tail slots.
const V_TAIL: Slot[] = [SP, SP];
const V_CCTRGBW: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Red", "Green", "Blue", "White"];
const V_CCT: Slot[] = ["Dimmer", "CCT", GM];
const V_CCTHS: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", "Hue", "Saturation"];
const V_RGBW: Slot[] = ["Dimmer", "Red", "Green", "Blue", "White"];
const V_HS: Slot[] = ["Dimmer", "Hue", "Saturation"];
const V_XY: Slot[] = ["Dimmer", ...XY];
const V_CCTXY: Slot[] = ["Dimmer", "CCT", GM, "Crossfade", ...XY];
const vortexModes = (zones: number): FixtureMode[] => [
  mm("1 CCT RGBW 8-bit", [[V_CCTRGBW, false], [V_TAIL, false]]),
  mm("2 CCT 8-bit", [[V_CCT, false], [V_TAIL, false]]),
  mm("3 CCT HS 8-bit", [[V_CCTHS, false], [V_TAIL, false]]),
  mm("4 RGBW 8-bit", [[V_RGBW, false], [V_TAIL, false]]),
  mm("5 HS 8-bit", [[V_HS, false], [V_TAIL, false]]),
  mm("6 CCT RGBW 16-bit", [[V_CCTRGBW, true], [V_TAIL, false]]),
  mm("7 CCT 16-bit", [[V_CCT, true], [V_TAIL, false]]),
  mm("8 CCT HS 16-bit", [[V_CCTHS, true], [V_TAIL, false]]),
  mm("9 RGBW 16-bit", [[V_RGBW, true], [V_TAIL, false]]),
  mm("10 HS 16-bit", [[V_HS, true], [V_TAIL, false]]),
  mm("11 xy 8-bit", [[V_XY, false], [V_TAIL, false]]),
  mm("12 CCT xy 8-bit", [[V_CCTXY, false], [V_TAIL, false]]),
  mm("13 xy 16-bit", [[V_XY, true], [V_TAIL, false]]),
  mm("14 CCT xy 16-bit", [[V_CCTXY, true], [V_TAIL, false]]),
  ...(zones > 1
    ? [
        mm(`32 Multi-Zone CCT RGBW 8-bit (${zones} zones)`, [[Array.from({ length: zones }, () => V_CCTRGBW).flat(), false], [[SP], false]]),
        mm(`38 Multi-Zone CCT HS 8-bit (${zones} zones)`, [[Array.from({ length: zones }, () => V_CCTHS).flat(), false], [[SP], false]]),
      ]
    : []),
];

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
  nl("CCT 8bit (Reduced)", [[["Dimmer", "CCT", GM, ZOOM], false]]),
  nl("CCT 16bit", [[["Dimmer", "CCT", GM], true], [[ZOOM, SP, SP, FAN, STROBE, ...NA(4)], false]]),
  nl("CCT 16bit (Reduced)", [[["Dimmer", "CCT", GM], true], [[ZOOM], false]]),
  nl("Ultimate DMX 8bit - CCT", [[["Dimmer", ULT_CCT, "CCT", GM, ...NA(7), ZOOM, SP, SP, FAN], false]]),
  nl("Ultimate DMX 8bit - Effect", [[["Dimmer", ULT_FX, ...NA(9), ZOOM, SP, SP, FAN], false]]),
];

// Nanlux Evoke 150C / 600C DMX Charts V1.2 (Nebula C8 engine, 1000–20000K, Zoom added in V1.2).
// Every mode ends with Fan, Strobe, Zoom (default 127) + 4 reserved; "Reduced" drops that tail.
const C8_TAIL: Slot[] = [FAN, STROBE, ["Zoom", 0.498], ...NA(4)];
const C8_RGBW: Slot[] = ["Red", "Green", "Blue", "White"];
const C8_DIRECT: Slot[] = ["Red", "Red", "Amber", "Green", "Green", "Cyan", "Blue", "Blue"]; // Deep Red, Red, Amber, Lime, Green, Cyan, Blue, Indigo
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
  ...c8("CCT & HSI", ["Dimmer", "CCT", GM, XF, "Hue", "Saturation"]).map((m, i) => (i % 4 > 1 ? mm(m.name, [[["Dimmer", "CCT", GM], true], [[XF], false], [["Hue", "Saturation"], true], [i === 2 ? C8_TAIL : [], false]]) : m)),
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

export const VERIFIED_FIXTURES: FixtureDef[] = [
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
