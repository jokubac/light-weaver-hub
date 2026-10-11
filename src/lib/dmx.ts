// DMX engine: fixture library, patch helpers, colour + effects math.
import { asteraModes, asteraSpec } from "./astera";
import { RENTAL_ALIASES, RENTAL_FIXTURES } from "./rental-fixtures";

export type ModeKind = "dim" | "cct" | "cctgm" | "hsi" | "rgb" | "rgbw" | "full";

export interface FixtureMode {
  pixels?: number; // pixel count for pixel modes
  grid?: [number, number]; // physical pixel layout [cols, rows], numbered row by row from top-left
  name: string;
  channels: number;
  kind: ModeKind;
  profile?: "astera-hsi" | "astera-hsi-strobe" | "nanlux-evoke-cct" | "nanlux-dyno-cct" | "nanlux-dyno-hsi" | "nanlux-dyno-rgbw";
  source?: string;
  /** exact Astera profile layout (number + per-pixel channel order) */
  astera?: import("./astera").AsteraSpec;
}

export interface FixtureDef {
  id: string;
  brand: string;
  model: string;
  modes: FixtureMode[];
}

export function caps(kind: ModeKind) {
  return {
    cct: kind !== "dim" && kind !== "rgb",
    gm: kind === "cctgm" || kind === "full",
    color: kind === "hsi" || kind === "rgb" || kind === "rgbw" || kind === "full",
  };
}

/* ---------------- Fixture library ---------------- */
// Channel counts follow manufacturer DMX charts as closely as possible;
// always double-check against the fixture's firmware manual on set.

const m = (name: string, channels: number, kind: ModeKind, pixels?: number, grid?: [number, number]): FixtureMode => ({ name, channels, kind, ...(pixels ? { pixels } : {}), ...(grid ? { grid } : {}) });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fam = (brand: string, models: string[], modes: FixtureMode[]): FixtureDef[] =>
  models.map((model) => ({ id: slug(`${brand} ${model}`), brand, model, modes }));

const DIM = [m("Dimmer 8-bit", 1, "dim"), m("Dimmer 16-bit", 2, "dim")];
const DIM_STROBE = [...DIM, m("Dimmer + Strobe 8-bit", 2, "dim"), m("Dimmer + Effects 8-bit", 3, "dim")];
const BI = [m("CCT 8-bit", 2, "cct"), m("CCT 16-bit", 4, "cct"), m("CCT & G/M 8-bit", 3, "cctgm"), m("CCT & G/M 16-bit", 6, "cctgm")];

const ARRI_SKYPANEL = [
  m("CCT 8-bit", 4, "cctgm"), m("CCT 16-bit", 7, "cctgm"), m("CCT Fine", 8, "cctgm"),
  m("RGBW 8-bit", 6, "rgbw"), m("RGBW 16-bit", 10, "rgbw"),
  m("HSI 8-bit", 5, "hsi"), m("HSI 16-bit", 8, "hsi"),
  m("Advanced 8-bit", 16, "full"), m("Advanced 16-bit", 28, "full"),
  m("Lite 8-bit", 3, "cctgm"),
];
const ARRI_ORBITER = [
  ...ARRI_SKYPANEL,
  m("RGBACL 8-bit", 8, "rgbw"), m("RGBACL 16-bit", 14, "rgbw"), m("xy 16-bit", 7, "full"),
];
const ARRI_L = [m("8-bit Mode 1 (CCT)", 4, "cctgm"), m("16-bit Mode 1 (CCT)", 7, "cctgm"), m("8-bit Mode 2 (RGBW)", 6, "rgbw"), m("16-bit Mode 2 (RGBW)", 10, "rgbw"), m("8-bit Mode 3 (HSI)", 5, "hsi"), m("16-bit Mode 3 (HSI)", 8, "hsi")];

const APUTURE_COLOR = [
  m("CCT 8-bit", 3, "cctgm"), m("CCT 16-bit", 6, "cctgm"),
  m("CCT & RGB 8-bit", 8, "full"), m("CCT & RGB 16-bit", 14, "full"),
  m("HSI 8-bit", 4, "hsi"), m("HSI 16-bit", 7, "hsi"),
  m("RGB 8-bit", 4, "rgb"), m("RGB 16-bit", 7, "rgb"),
  m("RGBWW 8-bit", 6, "rgbw"), m("RGBWW 16-bit", 11, "rgbw"),
  m("XY 8-bit", 4, "full"), m("Gel 8-bit", 4, "cctgm"),
  m("Source Match 8-bit", 3, "cctgm"), m("Effect 8-bit", 6, "full"),
  m("Fan + CCT&RGB 16-bit", 15, "full"),
];
const APUTURE_DAY = [...DIM_STROBE, m("Dimmer + Fan 8-bit", 3, "dim")];
const APUTURE_BI = [...BI, m("CCT + Effects 8-bit", 5, "cctgm")];
const APUTURE_MC = [m("CCT 8-bit", 3, "cctgm"), m("HSI 8-bit", 4, "hsi"), m("RGB 8-bit", 4, "rgb"), m("CCT & HSI 8-bit", 6, "full")];

const NANLITE_DAY = [...DIM, m("Dimmer + Effects", 3, "dim")];
const NANLITE_BI = [...BI, m("CCT + Effects 8-bit", 5, "cctgm")];
const NANLITE_PAVO = [
  m("CCT 8-bit", 2, "cct"), m("CCT & G/M 8-bit", 3, "cctgm"), m("CCT & G/M 16-bit", 6, "cctgm"),
  m("HSI 8-bit", 4, "hsi"), m("HSI 16-bit", 7, "hsi"),
  m("RGBW 8-bit", 5, "rgbw"), m("RGBW 16-bit", 9, "rgbw"),
  m("XY 8-bit", 4, "full"), m("Gel 8-bit", 4, "cctgm"),
  m("All-in-one 8-bit", 12, "full"), m("All-in-one 16-bit", 20, "full"),
  m("Pixel RGBW 8-bit (8 px)", 32, "rgbw"),
];
const NANLUX_DYNO = [
  m("CCT 8-bit", 3, "cctgm"), m("CCT 16-bit", 6, "cctgm"),
  m("HSI 8-bit", 4, "hsi"), m("HSI 16-bit", 7, "hsi"),
  m("RGBWW 8-bit", 6, "rgbw"), m("RGBWW 16-bit", 11, "rgbw"),
  m("XY 16-bit", 6, "full"), m("Gel 8-bit", 4, "cctgm"),
  m("Full 8-bit", 14, "full"), m("Full 16-bit", 24, "full"),
];

const GODOX_RGB = [m("CCT 8-bit", 3, "cctgm"), m("HSI 8-bit", 4, "hsi"), m("RGB 8-bit", 4, "rgb"), m("RGBWW 8-bit", 6, "rgbw"), m("Full 8-bit", 10, "full"), m("Full 16-bit", 18, "full")];

const VORTEX = [
  m("Basic 8-bit (CCT)", 4, "cctgm"), m("Basic 16-bit (CCT)", 7, "cctgm"),
  m("HSI 8-bit", 5, "hsi"), m("HSI 16-bit", 8, "hsi"),
  m("RGBW 8-bit", 6, "rgbw"), m("RGBW 16-bit", 10, "rgbw"),
  m("Full 8-bit", 14, "full"), m("Full 16-bit", 24, "full"),
  m("Pixel RGBW 8-bit (per tile)", 32, "rgbw"),
];

const ASTERA_BASE = [
  m("1ch Dimmer", 1, "dim"), m("2ch Dim + CCT", 2, "cct"), m("3ch Dim CCT G/M", 3, "cctgm"),
  m("3ch RGB", 3, "rgb"), m("4ch RGBW", 4, "rgbw"), m("5ch RGBAW", 5, "rgbw"),
  m("4ch HSI", 4, "hsi"), m("6ch Dim RGBAW", 6, "rgbw"),
  m("8ch Dim RGBAW Strobe Prog", 8, "full"), m("16ch Full 16-bit", 16, "full"),
];
// Astera pixel modes: n pixels × channels-per-pixel
const asteraPx = (px: number) => [
  ...ASTERA_BASE,
  m(`Pixel RGB (${px} px)`, px * 3, "rgb", px), m(`Pixel RGBW (${px} px)`, px * 4, "rgbw", px),
  m(`Pixel RGBAW (${px} px)`, px * 5, "rgbw", px), m(`Pixel Dim+RGBAW (${px} px)`, px * 6, "rgbw", px),
  m(`Pixel CCT (${px} px)`, px * 2, "cct", px),
];
const pxModes = (px: number, extra: FixtureMode[] = []) => [
  ...extra,
  m(`Pixel RGB (${px} px)`, px * 3, "rgb", px), m(`Pixel RGBW (${px} px)`, px * 4, "rgbw", px),
];
const QUASAR = [
  m("Dimmer 1ch", 1, "dim"), m("CCT 2ch", 2, "cct"), m("CCT+G/M 3ch", 3, "cctgm"), m("HSI 4ch", 4, "hsi"),
  m("RGBX 5ch", 5, "rgbw"), m("Full 8-bit 12ch", 12, "full"), m("Full 16-bit 20ch", 20, "full"),
];
const ASTERA = ASTERA_BASE;

const KINO = [m("CCT 8-bit", 4, "cctgm"), m("CCT 16-bit", 7, "cctgm"), m("HSI 8-bit", 5, "hsi"), m("RGB 8-bit", 5, "rgb"), m("RGBW 8-bit", 6, "rgbw"), m("Full 8-bit", 12, "full"), m("Full 16-bit", 20, "full")];
const LITEPANELS = [m("CCT 8-bit", 4, "cctgm"), m("CCT 16-bit", 7, "cctgm"), m("HSI 8-bit", 5, "hsi"), m("RGBWW 8-bit", 6, "rgbw"), m("Gel 8-bit", 4, "cctgm"), m("Full 16-bit", 21, "full")];
const CREAM_MICRO = [m("Basic 8-bit", 4, "cctgm"), m("HSI 8-bit", 5, "hsi"), m("RGBW 8-bit", 6, "rgbw"), m("Full 16-bit", 16, "full")];
const DMG = [m("Simple 8-bit (CCT)", 4, "cctgm"), m("Simple 16-bit (CCT)", 7, "cctgm"), m("HSI 8-bit", 5, "hsi"), m("RGB 8-bit", 4, "rgb"), m("Full 8-bit", 12, "full"), m("Full 16-bit", 21, "full")];
const CHAUVET = [m("Dim 1ch", 1, "dim"), m("RGB 3ch", 3, "rgb"), m("RGBW 4ch", 4, "rgbw"), m("Dim RGBW Strobe 6ch", 6, "rgbw"), m("HSI 5ch", 5, "hsi"), m("CCT 4ch", 4, "cctgm"), m("Full 12ch", 12, "full"), m("Full 16-bit 20ch", 20, "full")];

export const FIXTURE_LIBRARY: FixtureDef[] = [
  ...fam("ARRI", ["SkyPanel S30-C", "SkyPanel S60-C", "SkyPanel S120-C", "SkyPanel S360-C", "SkyPanel X"], ARRI_SKYPANEL),
  ...fam("ARRI", ["SkyPanel S60-C (Pixel)"], [...ARRI_SKYPANEL, m("Pixel RGBW 8-bit (4 px)", 24, "rgbw", 4, [4, 1]), m("Pixel HSI 8-bit (4 px)", 20, "hsi", 4, [4, 1])]),
  ...fam("ARRI", ["SkyPanel S360-C (Pixel)"], [...ARRI_SKYPANEL, m("Pixel RGBW 8-bit (12 px)", 72, "rgbw", 12, [4, 3]), m("Pixel HSI 8-bit (12 px)", 60, "hsi", 12, [4, 3])]),
  ...fam("ARRI", ["Orbiter"], ARRI_ORBITER),
  ...fam("ARRI", ["L5-C", "L7-C", "L10-C"], ARRI_L),
  ...fam("ARRI", ["M18 (EB Max ballast)", "M40 (EB Max ballast)", "M90 (EB Max ballast)", "Studio Fresnel (dimmer)", "ARRIMAX 18/12"], DIM),
  ...fam("Aputure", ["600c Pro", "600c Pro II", "300c", "Nova P300c", "Nova P600c", "STORM 1200x", "STORM 80c", "LS 1200x"], APUTURE_COLOR),
  ...fam("Aputure", ["INFINIBAR PB3"], pxModes(4, APUTURE_COLOR)),
  ...fam("Aputure", ["INFINIBAR PB6"], pxModes(8, APUTURE_COLOR)),
  ...fam("Aputure", ["INFINIBAR PB12"], pxModes(16, APUTURE_COLOR)),
  ...fam("Aputure", ["MT Pro"], pxModes(36, APUTURE_MC)),
  ...fam("Aputure", ["MC", "MC Pro", "Accent B7c", "Amaran Ace 25c"], APUTURE_MC),
  ...fam("Aputure", ["LS 600d Pro", "LS 1200d Pro", "LS 300d II", "Electro Storm CS15", "STORM 1000c"], APUTURE_DAY),
  ...fam("Aputure", ["LS 600x Pro", "Electro Storm XT26", "Electro Storm XT52", "Amaran 200x S", "Amaran 300c", "Amaran F22x", "Amaran F22c", "Nova P300c"], APUTURE_BI),
  ...fam("Nanlite", ["Forza 60", "Forza 150", "Forza 300 II", "Forza 500 II", "Forza 720", "FC-500B"], NANLITE_DAY),
  ...fam("Nanlite", ["Forza 60B", "Forza 150B", "Forza 300B II", "Forza 720B", "FS-300B", "FS-150B"], NANLITE_BI),
  ...fam("Nanlite", ["PavoTube II 6C"], pxModes(4, NANLITE_PAVO)),
  ...fam("Nanlite", ["PavoTube II 15C", "PavoTube II 15X"], pxModes(8, NANLITE_PAVO)),
  ...fam("Nanlite", ["PavoTube II 30C", "PavoTube II 30X"], pxModes(16, NANLITE_PAVO)),
  ...fam("Nanlite", ["PavoTube T8-7X"], pxModes(8, NANLITE_PAVO)),
  ...fam("Nanlite", ["PavoSlim 60C", "PavoSlim 120C", "PavoSlim 240C", "Forza 60C", "Forza 300C", "PavoBulb 10C", "PavoLink"], NANLITE_PAVO),
  ...fam("Nanlux", ["Evoke 900C", "Evoke 1200", "Evoke 2400B", "Evoke 150C"], [...NANLITE_BI, m("Dimmer 16-bit", 2, "dim")]),
  ...fam("Nanlux", ["Evoke 1200B"], [...NANLITE_BI, m("Dimmer 16-bit", 2, "dim"), { name: "Ultimate DMX 8-bit — CCT", channels: 11, kind: "cct", profile: "nanlux-evoke-cct", source: "https://impact-even.com/wp-content/uploads/2023/05/nanlux_evoke1200b_tabledmx.pdf" }]),
  ...fam("Nanlux", ["Dyno 650C", "Dyno 1200C"], [...NANLUX_DYNO,
    { name: "Ultimate DMX 8-bit — CCT", channels: 15, kind: "cctgm", profile: "nanlux-dyno-cct" },
    { name: "Ultimate DMX 8-bit — HSI", channels: 15, kind: "hsi", profile: "nanlux-dyno-hsi" },
    { name: "Ultimate DMX 8-bit — RGBW", channels: 15, kind: "rgbw", profile: "nanlux-dyno-rgbw" },
  ]),
  ...fam("Nanlux", ["TK-140B", "TK-280B", "TK-450B"], NANLUX_DYNO),
  ...fam("Godox", ["Knowled M600D", "VL300", "VL150", "SL300 III", "M1200D"], DIM_STROBE),
  ...fam("Godox", ["Knowled MG1200Bi", "Knowled M600Bi", "Knowled F600Bi", "Knowled P600Bi", "LF308Bi", "LiteFlow"], BI),
  ...fam("Godox", ["Knowled M200R", "LC500R", "F200R", "F400R", "MS300R"], GODOX_RGB),
  ...fam("Godox", ["TL30"], pxModes(8, GODOX_RGB)),
  ...fam("Godox", ["TL60", "TP4R"], pxModes(16, GODOX_RGB)),
  ...fam("Godox", ["TL120", "TP8R"], pxModes(32, GODOX_RGB)),
  ...fam("Creamsource", ["Vortex4"], [...VORTEX.slice(0, -1), m("Pixel RGBW 8-bit (4 px)", 16, "rgbw", 4, [2, 2]), m("Pixel HSI 8-bit (4 px)", 20, "hsi", 4, [2, 2])]),
  ...fam("Creamsource", ["Vortex8"], [...VORTEX.slice(0, -1), m("Pixel RGBW 8-bit (8 px)", 32, "rgbw", 8, [4, 2]), m("Pixel HSI 8-bit (8 px)", 40, "hsi", 8, [4, 2])]),
  ...fam("Creamsource", ["Vortex24"], [...VORTEX.slice(0, -1), m("Pixel RGBW 8-bit (24 px)", 96, "rgbw", 24, [6, 4]), m("Pixel HSI 8-bit (24 px)", 120, "hsi", 24, [6, 4])]),
  ...fam("Creamsource", ["Micro Colour", "SpaceX", "Slyce"], CREAM_MICRO),
  ...fam("Astera", ["Titan Tube"], [
    ...asteraPx(16).map((mode) => {
      const code = mode.name === "3ch RGB" ? 1 : mode.name === "4ch RGBW" ? 2 : mode.name === "5ch RGBAW" ? 3 : mode.name === "6ch Dim RGBAW" ? 6 : mode.name === "Pixel RGB (16 px)" ? 42 : mode.name === "Pixel RGBW (16 px)" ? 43 : mode.name === "Pixel RGBAW (16 px)" ? 44 : undefined;
      const spec = code ? asteraSpec(code) : undefined;
      return code ? { ...mode, name: `${code} — ${mode.name}`, ...(spec ? { astera: spec } : {}) } : mode;
    }),
    { name: "90 — D CCT GM HUE SAT", channels: 5, kind: "full", profile: "astera-hsi", source: "https://astera-led.com/Downloads/Profile/Titan%20Tube%20DMX%20Profiles.pdf" },
    { name: "95 — D CCT GM HUE SAT S", channels: 6, kind: "full", profile: "astera-hsi-strobe", source: "https://astera-led.com/Downloads/Profile/Titan%20Tube%20DMX%20Profiles.pdf" },
    { ...m("18 — Pixel RGB (4 px)", 12, "rgb", 4), astera: asteraSpec(18)! },
    // every other Titan profile, appended so saved mode numbers stay valid
    ...asteraModes([1, 4, 8, 16], [1, 2, 3, 6, 18, 42, 43, 44, 90, 95]),
  ]),
  ...fam("Astera", ["Helios Tube", "AX1 PixelTube"], [...asteraPx(8).map((x) => x).concat(asteraPx(16).slice(-5)), ...asteraModes([1, 4, 8])]),
  ...fam("Astera", ["Hyperion Tube"], [...asteraPx(32), ...asteraModes([1, 4, 8, 16])]),
  ...fam("Astera", ["PixelBrick"], [...asteraPx(4), ...asteraModes([1, 4])]),
  ...fam("Astera", ["AX3 LightDrop", "AX5 TriplePAR", "AX9 PowerPar", "NYX Bulb", "Leoht", "HydraPanel"], [...ASTERA, ...asteraModes([1])]),
  ...fam("Quasar Science", ["Rainbow 2 (2ft)"], pxModes(12, QUASAR)),
  ...fam("Quasar Science", ["Rainbow 2 (4ft)", "Double Rainbow (4ft)"], pxModes(24, QUASAR)),
  ...fam("Quasar Science", ["Rainbow 2 (8ft)", "Double Rainbow (8ft)"], pxModes(48, QUASAR)),
  ...fam("Quasar Science", ["Crossfade X", "Q-LED"], QUASAR),
  ...fam("Kino Flo", ["FreeStyle 21", "FreeStyle 31", "FreeStyle T44", "Celeb 250", "Celeb 450", "Celeb 850", "Select 30", "MIMIK 120", "Diva-Lite LED 30"], KINO),
  ...fam("Litepanels", ["Gemini 2x1", "Gemini 1x1", "Gemini 2x1 Hard", "Astra 6X Bi", "Studio X", "Apollo Bridge"], LITEPANELS),
  ...fam("DMG Lumière", ["SL1 MIX", "MAXI MIX", "MINI MIX", "DASH"], DMG),
  ...fam("LiteGear", ["LiteMat Spectrum 2", "LiteMat Spectrum 4", "LiteMat Spectrum 8"], [...LITEPANELS, m("Pixel RGBW (8 px)", 32, "rgbw", 8, [4, 2])]),
  ...fam("Rotolight", ["AEOS 2 Pro", "Titan X1", "Titan X2", "NEO 3 Pro"], DMG),
  ...fam("Cineo", ["Matchbox", "Lightblade", "HS2"], LITEPANELS),
  ...fam("Chauvet", ["onAir Panel 1 IP", "onAir Panel 2 IP", "Ovation E-260WW", "COLORado Solo Batten"], CHAUVET),
  ...fam("Chauvet", ["Epix Strip IP"], pxModes(20, CHAUVET)),
  ...fam("Prolycht", ["Orion 300 FS", "Orion 675 FS"], APUTURE_COLOR),
  ...fam("Zylight", ["Go-Panel", "F8-200"], APUTURE_MC),
  ...fam("Velvet", ["EVO 2", "Power 2", "Mini 1"], LITEPANELS),
  ...fam("Fiilex", ["Q1000 Color", "P360 Pro Plus"], GODOX_RGB),
  ...fam("Digital Sputnik", ["DS1", "DS3", "DS6"], [...ARRI_SKYPANEL, m("Pixel RGBW (3 px per module)", 18, "rgbw", 3, [1, 3])]),
  ...fam("Generic", ["Dimmer"], DIM),
  ...fam("Generic", ["Bi-colour LED"], BI),
  ...fam("Generic", ["RGB Par"], [m("RGB 3ch", 3, "rgb"), m("Dim RGB 4ch", 4, "rgb")]),
  ...fam("Generic", ["RGBW Par"], [m("RGBW 4ch", 4, "rgbw"), m("Dim RGBW 5ch", 5, "rgbw"), m("Dim RGBW Strobe 6ch", 6, "rgbw")]),
  ...fam("Generic", ["Pixel strip 8 px"], pxModes(8)),
  ...fam("Generic", ["Pixel strip 16 px"], pxModes(16)),
  ...fam("Generic", ["Pixel strip 32 px"], pxModes(32)),
  // Arclight.lt + Cinevera (cine.lt) rental stock not listed above
  ...RENTAL_FIXTURES.flatMap((r) => fam(r.brand, r.models, ({ DIM, DIM_STROBE, BI, APUTURE_COLOR, APUTURE_BI, APUTURE_MC, NANLITE_PAVO, NANLITE_BI, GODOX_RGB, KINO, LITEPANELS, DMG, CHAUVET, QUASAR, CREAM_MICRO, ARRI_SKYPANEL } as Record<string, FixtureMode[]>)[r.modes]!)),
].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);

/** Which local rental house stocks a fixture (search by "arclight" / "cinevera"). */
export const RENTAL_STOCK: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const r of RENTAL_FIXTURES) for (const model of r.models) (out[slug(`${r.brand} ${model}`)] ??= []).push(...r.stock);
  for (const [id, houses] of Object.entries(RENTAL_ALIASES)) (out[id] ??= []).push(...houses);
  return out;
})();

export const BRANDS = Array.from(new Set(FIXTURE_LIBRARY.map((d) => d.brand)));
export const DEF_BY_ID: Record<string, FixtureDef> = Object.fromEntries(FIXTURE_LIBRARY.map((d) => [d.id, d]));
const FALLBACK = DEF_BY_ID["generic-rgbw-par"]!;
export const getDef = (id: string) => DEF_BY_ID[id] ?? FALLBACK;
export const getMode = (f: { defId: string; modeIdx: number }) => {
  const d = getDef(f.defId);
  return d.modes[f.modeIdx] ?? d.modes[0]!;
};

/* ---------------- Effects ---------------- */

export type EffectKind = "none" | "pulse" | "strobe" | "fire" | "candle" | "tv" | "lightning" | "steps";
export type Curve = "linear" | "sine" | "parabolic" | "invparabolic" | "exp";
export type TriggerKind = "lightning" | "flash" | "switch-on" | "switch-off";

export const EFFECTS: { id: EffectKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "pulse", label: "Pulse" },
  { id: "strobe", label: "Strobe" },
  { id: "fire", label: "Fire" },
  { id: "candle", label: "Candle" },
  { id: "tv", label: "TV" },
  { id: "lightning", label: "Lightning" },
  { id: "steps", label: "Steps" },
];
export const CURVES: { id: Curve; label: string }[] = [
  { id: "linear", label: "Linear" },
  { id: "sine", label: "S-curve" },
  { id: "parabolic", label: "Parabola" },
  { id: "invparabolic", label: "Inv. parab." },
  { id: "exp", label: "Exponent" },
];
export const TRIGGERS: { id: TriggerKind; label: string }[] = [
  { id: "lightning", label: "Lightning" },
  { id: "flash", label: "Flash" },
  { id: "switch-on", label: "Switch ON" },
  { id: "switch-off", label: "Switch OFF" },
];

export interface Step {
  level: number; // 0-1
  hold: number; // seconds
  fade: number; // seconds into this step
  kelvin?: number | undefined; // optional colour temperature for this step
  color?: string | undefined; // optional hex colour for this step (wins over kelvin)
  curve?: Curve | undefined; // optional per-step fade curve
}

export interface FxParams {
  kind: EffectKind;
  rate: number; // Hz (cycles / sec) or speed multiplier for steps
  min: number; // 0-1 low level
  max: number; // 0-1 high level
  duty: number; // 0.05-1 on-portion of cycle
  attack: number; // 0-1 fraction of on-portion
  release: number; // 0-1 fraction of on-portion
  curve: Curve;
  random: number; // 0-1 irregularity
  steps: Step[];
}

export const FX_PRESETS: Record<EffectKind, Partial<FxParams>> = {
  none: {},
  pulse: { rate: 0.5, min: 0.1, max: 1, duty: 1, attack: 0.5, release: 0.5, curve: "sine", random: 0 },
  strobe: { rate: 8, min: 0, max: 1, duty: 0.25, attack: 0, release: 0, curve: "linear", random: 0 },
  fire: { rate: 1.2, min: 0.35, max: 1, curve: "sine", random: 0.6 },
  candle: { rate: 0.6, min: 0.6, max: 1, curve: "sine", random: 0.4 },
  tv: { rate: 2, min: 0.2, max: 0.9, curve: "linear", random: 0.7 },
  lightning: { rate: 0.25, min: 0.02, max: 1, curve: "exp", random: 0.6 },
  steps: { rate: 1, min: 0, max: 1, curve: "sine" },
};

export const defaultFx = (): FxParams => ({
  kind: "none",
  rate: 1,
  min: 0,
  max: 1,
  duty: 1,
  attack: 0.5,
  release: 0.5,
  curve: "sine",
  random: 0,
  steps: [
    { level: 1, hold: 0.5, fade: 0.2 },
    { level: 0.3, hold: 0.3, fade: 0.5 },
    { level: 0.7, hold: 0.2, fade: 0.1 },
    { level: 0, hold: 0.8, fade: 0.3 },
  ],
});

/* ---------------- Patched fixture ---------------- */

export interface PatchedFixture {
  uid: string;
  defId: string;
  modeIdx: number;
  name: string;
  universe: number; // 1+
  address: number; // 1-512
  intensity: number; // 0-1
  cct: number; // 0-1 → 2000K-10000K
  gm: number; // -1 (magenta) .. 0 .. +1 (green)
  hue: number; // 0-360
  saturation: number; // 0-1
  crossfade: number; // 0 = CCT, 1 = HSI
  cctOnly: boolean;
  fx: FxParams;
  trigger?: { kind: TriggerKind; at: number } | null;
  on?: boolean; // lamp on/off, independent of effects
  fxPlaying?: boolean; // effect play / stop
  label?: string; // colour tag chosen when patching
  group?: string; // group name
  fan?: FanMode;
  gel?: string; // gel id from the gel library
  /** one pixel of a split pixel fixture, controlled as its own light */
  split?: { from: string; name: string; index: number; of: number; cpp: number };
  /** battery the light runs on (V-mount / Instagrid) for runtime estimates */
  power?: import("./power").PowerSource;
}

export type FanMode = "auto" | "silent" | "low" | "medium" | "high" | "max" | "off";
export const FAN_MODES: FanMode[] = ["auto", "silent", "low", "medium", "high", "max", "off"];

export const kelvin = (cct: number) => Math.round(2000 + cct * 8000);
export const cctFromKelvin = (k: number) => (k - 2000) / 8000;
export const DEFAULT_CCT = cctFromKelvin(5600);

export function createFixture(def: FixtureDef, modeIdx: number, universe: number, address: number, name: string): PatchedFixture {
  const kind = def.modes[modeIdx]?.kind ?? "dim";
  return {
    uid: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    defId: def.id,
    modeIdx,
    name,
    universe,
    address,
    intensity: 0,
    cct: DEFAULT_CCT,
    gm: 0,
    hue: 0,
    saturation: 0,
    crossfade: 0,
    cctOnly: !caps(kind).color,
    fx: defaultFx(),
    trigger: null,
    on: true,
    fxPlaying: true,
  };
}

// Migrate fixtures saved by older versions.
export function normalizeFixture(raw: Record<string, unknown>): PatchedFixture {
  const r = raw as Partial<PatchedFixture> & { effect?: EffectKind; effectSpeed?: number; effectSize?: number };
  const fx = { ...defaultFx(), ...(r.fx ?? {}) };
  if (!r.fx && r.effect && r.effect !== "none") {
    Object.assign(fx, FX_PRESETS[r.effect] ?? {}, { kind: r.effect });
  }
  return {
    uid: r.uid ?? Math.random().toString(36).slice(2),
    defId: r.defId ?? FALLBACK.id,
    modeIdx: r.modeIdx ?? 0,
    name: r.name ?? "Fixture",
    universe: r.universe ?? 1,
    address: r.address ?? 1,
    intensity: r.intensity ?? 0,
    cct: r.cct ?? DEFAULT_CCT,
    gm: r.gm ?? 0,
    hue: r.hue ?? 0,
    saturation: r.saturation ?? 0,
    crossfade: r.crossfade ?? 0,
    cctOnly: r.cctOnly ?? false,
    fx,
    trigger: null,
    on: r.on ?? true,
    fxPlaying: r.fxPlaying ?? true,
    ...(r.label ? { label: r.label } : {}),
    ...(r.group ? { group: r.group } : {}),
    ...(r.fan ? { fan: r.fan } : {}),
    ...(r.gel ? { gel: r.gel } : {}),
    ...(r.split ? { split: r.split } : {}),
  };
}

/* ---------------- Patch helpers ---------------- */

export const footprint = (f: PatchedFixture) => (f.split ? f.split.cpp : getMode(f).channels);

export function overlaps(fixtures: PatchedFixture[], universe: number, address: number, channels: number, ignoreUid?: string) {
  const end = address + channels - 1;
  return fixtures.filter(
    (f) => f.uid !== ignoreUid && f.universe === universe && address <= f.address + footprint(f) - 1 && end >= f.address,
  );
}

export function findFreeAddress(fixtures: PatchedFixture[], universe: number, channels: number, from = 1): number | null {
  let a = Math.max(1, from);
  while (a + channels - 1 <= 512) {
    const hit = overlaps(fixtures, universe, a, channels);
    if (hit.length === 0) return a;
    a = Math.max(...hit.map((f) => f.address + footprint(f)));
  }
  return null;
}

/* ---------------- Math ---------------- */

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) + (hash(i + 1) - hash(i)) * u;
}
const frac = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const seedOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return h / 9973;
};

export function shape(x: number, curve: Curve): number {
  x = clamp01(x);
  switch (curve) {
    case "linear": return x;
    case "sine": return (1 - Math.cos(Math.PI * x)) / 2;
    case "parabolic": return x * x;
    case "invparabolic": return 1 - (1 - x) * (1 - x);
    case "exp": return (Math.pow(2, 8 * x) - 1) / 255;
  }
}

function cycle(p: number, fx: FxParams): number {
  const duty = Math.max(0.001, fx.duty);
  if (p >= duty) return 0;
  const q = p / duty;
  let a = fx.attack, r = fx.release;
  if (a + r > 1) { const s = a + r; a /= s; r /= s; }
  if (a > 0 && q < a) return shape(q / a, fx.curve);
  if (r > 0 && q > 1 - r) return shape((1 - q) / r, fx.curve);
  return 1;
}

/** Raw 0-1 effect value before min/max mapping. */
function rawEffect(fx: FxParams, t: number, seed: number): number {
  const rnd = fx.random;
  switch (fx.kind) {
    case "none": return 1;
    case "pulse":
    case "strobe": {
      const jitter = rnd * noise1(t * fx.rate * 0.5 + seed * 50) * 0.8;
      return cycle(frac(t * fx.rate + seed * rnd + jitter), fx);
    }
    case "fire": {
      const n = noise1(t * fx.rate * 4 + seed * 100) * (1 - rnd * 0.5) + noise1(t * fx.rate * 13 + seed * 40) * rnd * 0.5;
      return shape(n, fx.curve);
    }
    case "candle": {
      const n = noise1(t * fx.rate * 2 + seed * 70) * 0.8 + noise1(t * fx.rate * 9 + seed * 9) * 0.2;
      const gust = noise1(t * 0.3 + seed) > 1 - rnd * 0.3 ? noise1(t * 20) : 1;
      return shape(n * gust, fx.curve);
    }
    case "tv": {
      const cut = Math.floor(t * fx.rate * (1 + rnd * noise1(t + seed * 10)) + seed * 10);
      const base = hash(cut + seed * 31);
      return shape(clamp01(base + (noise1(t * 25 + seed) - 0.5) * rnd * 0.3), fx.curve);
    }
    case "lightning": {
      const slotLen = 1 / Math.max(0.001, fx.rate);
      const slot = Math.floor(t / slotLen);
      if (hash(slot * 3.1 + seed * 17) > 0.35 + (1 - rnd) * 0.6) return 0;
      const start = hash(slot * 7.7 + seed) * slotLen * 0.6;
      const len = 0.15 + hash(slot * 1.3 + seed) * 0.5;
      const dt = t - slot * slotLen - start;
      if (dt < 0 || dt > len) return 0;
      return boltEnvelope(dt / len, slot + seed * 100, fx.curve);
    }
    case "steps": return stepsState(fx, t).level;
  }
}

function boltEnvelope(q: number, seed: number, curve: Curve): number {
  // 2-4 sub-flashes with decaying tails
  const n = 2 + Math.floor(hash(seed) * 3);
  const k = Math.floor(q * n);
  const local = frac(q * n);
  const amp = 1 - k * (0.25 * hash(seed + k));
  return amp * shape(1 - local, curve);
}

/** Returns a level override for triggered events, or null when the trigger is not active. */
export function triggerLevel(trig: PatchedFixture["trigger"], t: number, seed: number): number | null {
  if (!trig) return null;
  const dt = t - trig.at;
  if (dt < 0) return trig.kind === "switch-on" ? 0 : null;
  switch (trig.kind) {
    case "flash":
      return dt > 1.2 ? null : dt < 0.04 ? 1 : Math.exp(-(dt - 0.04) / 0.18);
    case "lightning":
      return dt > 0.9 ? null : boltEnvelope(dt / 0.9, trig.at * 10 + seed * 50, "exp");
    case "switch-on":
      if (dt > 1.1) return 1;
      if (dt < 0.05) return 0;
      return hash(Math.floor(dt * 18) + seed * 13) > 0.45 + dt * 0.4 ? 0.1 : 0.95;
    case "switch-off":
      if (dt > 0.35) return 0;
      return hash(Math.floor(dt * 25) + seed * 7) > 0.5 ? 1 : 0.15;
  }
}

/* ---------------- Colour ---------------- */

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255];
}

export function kelvinToRgb(k: number): [number, number, number] {
  const t = k / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (x: number) => Math.min(255, Math.max(0, x));
  return [c(r), c(g), c(b)];
}

/** Final level (0-1) and base colour (0-255 rgb, unscaled) of a fixture at time t. */
export function fixtureState(f: PatchedFixture, t: number, masterLevel = 1): { v: number; rgb: [number, number, number] } {
  const kind = getMode(f).kind;
  const cp = caps(kind);
  const seed = seedOf(f.uid);
  const playing = f.fx.kind !== "none" && f.fxPlaying !== false;
  let stepRgb: [number, number, number] | null = null;
  let level = 1;
  if (playing) {
    if (f.fx.kind === "steps") {
      const st = stepsState(f.fx, t);
      level = f.fx.min + (f.fx.max - f.fx.min) * st.level;
      stepRgb = st.rgb;
    } else {
      level = f.fx.min + (f.fx.max - f.fx.min) * rawEffect(f.fx, t, seed);
    }
  }
  const trig = triggerLevel(f.trigger, t, seed);
  if (trig !== null) {
    level = f.trigger?.kind === "switch-on" || f.trigger?.kind === "switch-off" ? level * trig : Math.max(level * 0.15, trig);
  }
  const v = f.on === false ? 0 : clamp01(f.intensity * level * masterLevel);

  let [r, g, b] = kelvinToRgb(2000 + f.cct * 8000);
  if (cp.gm) {
    if (f.gm > 0) { r *= 1 - f.gm * 0.3; b *= 1 - f.gm * 0.3; }
    else { g *= 1 + f.gm * 0.4; }
  }
  if (cp.color && !f.cctOnly && f.crossfade > 0) {
    const [hr, hg, hb] = hsvToRgb(f.hue, f.saturation, 1);
    const x = f.crossfade;
    r = r + (hr - r) * x; g = g + (hg - g) * x; b = b + (hb - b) * x;
  }
  if (stepRgb) [r, g, b] = stepRgb;
  return { v, rgb: [r, g, b] };
}

export function fixtureColor(f: PatchedFixture, t: number, masterLevel = 1): string {
  const { v, rgb: [r, g, b] } = fixtureState(f, t, masterLevel);
  return `rgb(${Math.round(r * v)}, ${Math.round(g * v)}, ${Math.round(b * v)})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function stepRgbOf(s: Step): [number, number, number] | null {
  if (s.color) return hexToRgb(s.color);
  if (s.kelvin) return kelvinToRgb(s.kelvin);
  return null;
}

/** Steps effect: level 0-1 plus optional interpolated colour. */
export function stepsState(fx: FxParams, t: number): { level: number; rgb: [number, number, number] | null } {
  const steps = fx.steps.length ? fx.steps : defaultFx().steps;
  const total = steps.reduce((s, x) => s + x.hold + x.fade, 0) || 1;
  let pos = (t * fx.rate) % total;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i]!;
    const prevStep = steps[(i - 1 + steps.length) % steps.length]!;
    const cur = stepRgbOf(st);
    if (pos < st.fade) {
      const k = shape(pos / st.fade, st.curve ?? fx.curve);
      const prevRgb = stepRgbOf(prevStep) ?? cur;
      const rgb = cur && prevRgb ? (prevRgb.map((p, j) => p + (cur[j]! - p) * k) as [number, number, number]) : cur;
      return { level: prevStep.level + (st.level - prevStep.level) * k, rgb };
    }
    pos -= st.fade;
    if (pos < st.hold) return { level: st.level, rgb: cur };
    pos -= st.hold;
  }
  const last = steps[steps.length - 1]!;
  return { level: last.level, rgb: stepRgbOf(last) };
}

/** Preview the normalised effect waveform (0-1) for drawing. */
export function sampleEffect(fx: FxParams, t: number, seed = 0.3) {
  return fx.kind === "none" ? 1 : fx.min + (fx.max - fx.min) * rawEffect(fx, t, seed);
}
