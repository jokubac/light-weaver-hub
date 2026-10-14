// Astera Titan-family DMX profiles (FP1 Titan Tube / AX2 doc "DMX Profiles for Titan Tube, AX2-100").
// Every profile number with its per-pixel channel layout, so output can write exact channels.
// Source: https://astera-led.com/Downloads/Profile/Titan%20Tube%20DMX%20Profiles.pdf
import type { FixtureMode, ModeKind } from "./dmx";

export type AsteraCell = "RGB" | "RGBW" | "RGBAW" | "DRGB" | "DRGBW" | "DRGBAW" | "RGBDOT" | "IND" | "CRO" | "HSI" | "C16" | "H16" | "XY";
/** 0 no strobe · 1 one strobe channel at the end · 2 strobe per pixel (inside each pixel) · 3 strobe per pixel, all at the end */
export type AsteraStrobe = 0 | 1 | 2 | 3;
export interface AsteraSpec { code: number; cell: AsteraCell; px: number; strobe: AsteraStrobe; tokens?: string[] }

/** [profile number, cell layout, pixel count, strobe placement] */
const TABLE: [number, AsteraCell, number, AsteraStrobe][] = [[1,"RGB",1,0],[2,"RGBW",1,0],[3,"RGBAW",1,0],[4,"DRGB",1,0],[5,"DRGBW",1,0],[6,"DRGBAW",1,0],[7,"IND",1,0],[8,"RGB",1,1],[9,"RGBW",1,1],[10,"RGBAW",1,1],[11,"DRGB",1,1],[12,"DRGBW",1,1],[13,"DRGBAW",1,1],[14,"IND",1,1],[17,"RGBDOT",4,0],[18,"RGB",4,0],[19,"RGBW",4,0],[20,"RGBAW",4,0],[21,"DRGB",4,0],[22,"DRGBW",4,0],[23,"DRGBAW",4,0],[24,"IND",4,0],[25,"RGBDOT",4,1],[26,"RGB",4,1],[27,"RGBW",4,1],[28,"RGBAW",4,1],[29,"DRGB",4,1],[30,"DRGBW",4,1],[31,"DRGBAW",4,1],[32,"IND",4,1],[33,"RGB",4,2],[34,"RGB",4,3],[35,"RGBW",4,2],[36,"RGBAW",4,2],[37,"DRGB",4,2],[38,"DRGBW",4,2],[39,"DRGBAW",4,2],[40,"IND",4,2],[41,"RGBDOT",16,0],[42,"RGB",16,0],[43,"RGBW",16,0],[44,"RGBAW",16,0],[45,"DRGB",16,0],[46,"DRGBW",16,0],[47,"DRGBAW",16,0],[48,"IND",16,0],[49,"RGBDOT",16,1],[50,"RGB",16,1],[51,"RGBW",16,1],[52,"RGBAW",16,1],[53,"DRGB",16,1],[54,"DRGBW",16,1],[55,"DRGBAW",16,1],[56,"IND",16,1],[57,"RGB",16,2],[58,"RGB",16,3],[59,"RGBW",16,2],[60,"RGBAW",16,2],[61,"DRGB",16,2],[62,"DRGBW",16,2],[63,"DRGBAW",16,2],[64,"IND",16,2],[65,"RGBDOT",8,0],[66,"RGB",8,0],[67,"RGBW",8,0],[68,"RGBAW",8,0],[69,"DRGB",8,0],[70,"DRGBW",8,0],[71,"DRGBAW",8,0],[72,"IND",8,0],[73,"RGBDOT",8,1],[74,"RGB",8,1],[75,"RGBW",8,1],[76,"RGBAW",8,1],[77,"DRGB",8,1],[78,"DRGBW",8,1],[79,"DRGBAW",8,1],[80,"IND",8,1],[81,"RGB",8,2],[82,"RGB",8,3],[83,"RGBW",8,2],[84,"RGBAW",8,2],[85,"DRGB",8,2],[86,"DRGBW",8,2],[87,"DRGBAW",8,2],[88,"IND",8,2],[89,"CRO",1,0],[90,"HSI",1,0],[91,"C16",1,0],[92,"H16",1,0],[93,"XY",1,0],[94,"CRO",1,1],[95,"HSI",1,1],[96,"H16",1,1],[97,"XY",1,1],[98,"CRO",4,0],[99,"HSI",4,0],[100,"C16",4,0],[101,"H16",4,0],[102,"XY",4,0],[103,"CRO",4,1],[104,"HSI",4,1],[105,"H16",4,1],[106,"XY",4,1],[107,"CRO",4,2],[108,"HSI",4,2],[109,"H16",4,2],[110,"XY",4,2],[111,"CRO",16,0],[112,"HSI",16,0],[113,"C16",16,0],[114,"H16",16,0],[115,"XY",16,0],[116,"CRO",16,1],[117,"HSI",16,1],[118,"H16",16,1],[119,"XY",16,1],[120,"CRO",16,2],[121,"HSI",16,2],[122,"H16",16,2],[123,"XY",16,2],[124,"CRO",8,0],[125,"HSI",8,0],[126,"C16",8,0],[127,"H16",8,0],[128,"XY",8,0],[129,"CRO",8,1],[130,"HSI",8,1],[131,"H16",8,1],[132,"XY",8,1],[133,"CRO",8,2],[134,"HSI",8,2],[135,"H16",8,2],[136,"XY",8,2],[137,"C16",1,1],[138,"C16",4,1],[139,"C16",4,2],[140,"C16",16,1],[141,"C16",16,2],[142,"C16",8,1],[143,"C16",8,2]];

/** Tokens written for one pixel, in DMX order. */
export const CELL_TOKENS: Record<AsteraCell, string[]> = {
  RGB: ["R", "G", "B"], RGBW: ["R", "G", "B", "W"], RGBAW: ["R", "G", "B", "A", "W"],
  DRGB: ["D", "R", "G", "B"], DRGBW: ["D", "R", "G", "B", "W"], DRGBAW: ["D", "R", "G", "B", "A", "W"],
  RGBDOT: ["R", "G", "B", "."], IND: ["R", "G", "B", "CCT", "D", "IND"],
  CRO: ["D", "CCT", "GM", "CRO", "R", "G", "B"], HSI: ["D", "CCT", "GM", "HUE", "SAT"],
  C16: ["D16", "D16b", "CCT", "GM", "CRO", "R", "G", "B"], H16: ["D16", "D16b", "CCT", "GM", "HUE16", "HUE16b", "SAT"],
  XY: ["D16", "D16b", "X16", "X16b", "Y16", "Y16b"],
};

const LABEL: Record<AsteraCell, string> = {
  RGB: "RGB", RGBW: "RGBW", RGBAW: "RGBAW", DRGB: "DIM RGB", DRGBW: "DIM RGBW", DRGBAW: "DIM RGBAW", RGBDOT: "RGB.RGB.",
  IND: "RGB CCT DIM IND", CRO: "D CCT GM CRO RGB", HSI: "D CCT GM HUE SAT", C16: "D16 CCT GM C RGB", H16: "D16 CCT GM H SAT", XY: "D16 X Y",
};
const KIND: Record<AsteraCell, ModeKind> = {
  RGB: "rgb", RGBW: "rgbw", RGBAW: "rgbw", DRGB: "rgb", DRGBW: "rgbw", DRGBAW: "rgbw", RGBDOT: "rgb", IND: "full", CRO: "full", HSI: "full", C16: "full", H16: "full", XY: "full",
};

/** Channel tokens for the whole fixture in DMX order (pixel blocks, then any tail strobes). */
export function asteraTokens(s: AsteraSpec): { token: string; px: number }[] {
  const out: { token: string; px: number }[] = [];
  for (let p = 0; p < s.px; p++) {
    for (const token of s.tokens ?? CELL_TOKENS[s.cell]) out.push({ token, px: p });
    if (s.strobe === 2 && s.cell !== "RGBDOT") out.push({ token: "S", px: p });
  }
  if (s.cell === "RGBDOT") { out.pop(); if (s.strobe) out.push({ token: "S", px: -1 }); }
  else if (s.strobe === 1) out.push({ token: "S", px: -1 });
  else if (s.strobe === 3) for (let p = 0; p < s.px; p++) out.push({ token: "S", px: p });
  return out;
}

export const asteraChannels = (s: AsteraSpec) => asteraTokens(s).length;
export const ASTERA_SPECS: AsteraSpec[] = TABLE.map(([code, cell, px, strobe]) => ({ code, cell, px, strobe }));
export const asteraSpec = (code: number) => ASTERA_SPECS.find((s) => s.code === code);

const STROBE_LABEL = ["", " S", " S", " SS"];
export function asteraMode(s: AsteraSpec): FixtureMode {
  return {
    name: `Profile ${s.code} — ${LABEL[s.cell]}${STROBE_LABEL[s.strobe]} (${s.px} px${s.strobe === 2 || s.strobe === 3 ? ", strobe per px" : ""})`,
    channels: asteraChannels(s), kind: KIND[s.cell],
    ...(s.px > 1 ? { pixels: s.px } : {}),
    astera: s,
    source: "https://astera-led.com/Downloads/Profile/Titan%20Tube%20DMX%20Profiles.pdf",
  };
}

/** All profiles available for a fixture with the given pixel counts, ordered by profile number. */
export const asteraModes = (pxCounts: number[], skip: number[] = []) =>
  ASTERA_SPECS.filter((s) => pxCounts.includes(s.px) && !skip.includes(s.code)).sort((a, b) => a.code - b.code).map(asteraMode);

const WORD: Record<string, string[]> = {
  D: ["D"], DIM: ["D"], D16: ["D16", "D16b"], CCT: ["CCT"], GM: ["GM"], C: ["CRO"], CRO: ["CRO"],
  RGB: ["R", "G", "B"], RGBW: ["R", "G", "B", "W"], RGBAW: ["R", "G", "B", "A", "W"],
  HUE: ["HUE"], H: ["HUE16", "HUE16b"], SAT: ["SAT"], XY: ["X16", "X16b", "Y16", "Y16b"], X: ["X16", "X16b"], Y: ["Y16", "Y16b"],
};
/** Reads an Astera GDTF mode name such as "193: D16 CCT GM C CRO XY S" into an exact per-pixel layout. */
export function asteraSpecFromName(name: string, channels: number): AsteraSpec | undefined {
  const m = /^\s*(\d+):\s*([A-Z0-9 ]+)/.exec(name);
  if (!m) return undefined;
  const words = m[2]!.trim().split(/\s+/);
  const strobe = words[words.length - 1] === "S";
  if (strobe) words.pop();
  const tokens: string[] = [];
  for (const w of words) {
    const t = WORD[w];
    if (!t) return undefined;
    if (t[0] === "CRO" && tokens[tokens.length - 1] === "CRO") continue;
    tokens.push(...t);
  }
  if (!tokens.length) return undefined;
  const fit = (cell: number, tail: number) => ((channels - tail) % cell === 0 ? (channels - tail) / cell : 0);
  let px = fit(tokens.length, strobe ? 1 : 0), st: AsteraStrobe = strobe ? 1 : 0;
  if (px < 2 && strobe) { px = fit(tokens.length + 1, 0); st = 2; }
  if (px < 2) return undefined;
  return { code: Number(m[1]), cell: "XY", px, strobe: st, tokens };
}
