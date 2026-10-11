// Battery runtime estimates for lights running on V-mount / Instagrid / other packs.
import type { PatchedFixture } from "./dmx";

export type PowerKind = "mains" | "vmount" | "instagrid" | "other";
export interface PowerSource {
  kind: PowerKind;
  kwh: number; // capacity
  charge: number; // 0-1 charge when set
  watts: number; // light's full-power draw
  usedWh: number; // energy drawn since `charge` was set
}

export const BATTERY_PRESETS: { kind: PowerKind; label: string; kwh: number }[] = [
  { kind: "vmount", label: "V-mount 98 Wh", kwh: 0.098 },
  { kind: "vmount", label: "V-mount 150 Wh", kwh: 0.15 },
  { kind: "vmount", label: "V-mount 230 Wh", kwh: 0.23 },
  { kind: "vmount", label: "V-mount 290 Wh", kwh: 0.29 },
  { kind: "vmount", label: "2× V-mount 290 Wh", kwh: 0.58 },
  { kind: "instagrid", label: "Instagrid ONE", kwh: 1.07 },
  { kind: "instagrid", label: "Instagrid ONE max", kwh: 2.1 },
];

/** Draw factor: LEDs pull roughly proportional to output. */
export const drawFactor = (f: PatchedFixture, level: number) => (f.on === false ? 0 : Math.max(0.02, f.intensity * level));

export function batteryStatus(p: PowerSource, f: PatchedFixture, level: number) {
  const cap = p.kwh * 1000;
  const left = Math.max(0, cap * p.charge - p.usedWh);
  const pct = cap > 0 ? left / cap : 0;
  const w = p.watts * drawFactor(f, level);
  const hours = w > 0 ? left / w : Infinity;
  return { pct, hours, watts: w };
}

export const fmtHours = (h: number) => (!Number.isFinite(h) ? "—" : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`);

// Manufacturer max power draw (W) by model name. First match wins, so list specific names first.
const WATTS: [RegExp, number][] = [
  [/S30-C/, 250], [/S60-C/, 450], [/S120-C/, 800], [/S360-C/, 1600], [/SkyPanel X/, 1250], [/Orbiter/, 500],
  [/L5-C/, 115], [/L7-C/, 220], [/L10-C/, 450], [/M18/, 1800], [/M40/, 4000], [/M90/, 9000], [/ARRIMAX/, 18000], [/Studio Fresnel/, 1000],
  [/600c Pro/, 720], [/300c/, 350], [/Nova P300c/, 360], [/Nova P600c/, 720], [/STORM 1200x/, 1400], [/STORM 1000c/, 1300], [/STORM 80c/, 100], [/LS 1200x/, 1400],
  [/PB3/, 30], [/PB6/, 60], [/PB12/, 120], [/MT Pro/, 6], [/MC Pro/, 15], [/^MC$/, 5], [/B7c/, 7], [/Ace 25c/, 25],
  [/LS 600d/, 720], [/LS 1200d/, 1400], [/LS 300d/, 350], [/CS15/, 1700], [/LS 600x/, 720], [/XT26/, 2900], [/XT52/, 5800], [/200x/, 200], [/F22/, 200],
  [/Forza 60/, 88], [/Forza 150/, 170], [/Forza 300/, 350], [/Forza 500/, 580], [/Forza 720/, 800], [/FC-500/, 500], [/FS-300/, 350], [/FS-150/, 170],
  [/PavoTube II 6C/, 10], [/PavoTube II 15/, 20], [/PavoTube II 30/, 40], [/T8-7X/, 10], [/PavoSlim 60/, 60], [/PavoSlim 120/, 120], [/PavoSlim 240/, 240], [/PavoBulb/, 10], [/PavoLink/, 15],
  [/Evoke 900/, 1000], [/Evoke 1200/, 1300], [/Evoke 2400/, 2600], [/Evoke 150/, 170], [/Dyno 650/, 700], [/Dyno 1200/, 1300], [/TK-140/, 150], [/TK-280/, 300], [/TK-450/, 500],
  [/M600|F600|P600/, 650], [/MG1200|M1200/, 1300], [/VL300|SL300/, 330], [/VL150/, 160], [/LF308/, 30], [/LiteFlow/, 50], [/M200R|F200R/, 200], [/LC500R/, 40], [/F400R/, 400], [/MS300R/, 300],
  [/TL30/, 10], [/TL60/, 20], [/TL120/, 40], [/TP4R/, 20], [/TP8R/, 40],
  [/Vortex4/, 350], [/Vortex8/, 650], [/Vortex24/, 1800], [/Micro Colour/, 120], [/SpaceX/, 1200], [/Slyce/, 120],
  [/Titan Tube/, 72], [/Helios|AX1/, 36], [/Hyperion/, 144], [/PixelBrick/, 15], [/AX3/, 15], [/AX5/, 50], [/AX9/, 75], [/NYX/, 10], [/Leoht/, 15], [/HydraPanel/, 15],
  [/Rainbow 2 \(2ft\)/, 25], [/\(4ft\)/, 50], [/\(8ft\)/, 100], [/Crossfade X/, 50], [/Q-LED/, 50],
  [/FreeStyle 21/, 150], [/FreeStyle 31/, 210], [/T44/, 330], [/Celeb 250/, 150], [/Celeb 450/, 300], [/Celeb 850/, 550], [/Select 30/, 125], [/MIMIK/, 400], [/Diva/, 120],
  [/Gemini 2x1/, 650], [/Gemini 1x1/, 200], [/Astra/, 100], [/Studio X/, 300], [/Apollo/, 450],
  [/SL1 MIX/, 200], [/MAXI MIX/, 400], [/MINI MIX/, 32], [/DASH/, 25],
  [/Spectrum 2/, 50], [/Spectrum 4/, 100], [/Spectrum 8/, 200], [/AEOS/, 100], [/Titan X1/, 350], [/Titan X2/, 650], [/NEO/, 25],
  [/Matchbox/, 30], [/Lightblade/, 50], [/HS2/, 500], [/onAir Panel 1/, 120], [/onAir Panel 2/, 240], [/E-260/, 260], [/COLORado/, 120], [/Epix/, 30],
  [/Orion 300/, 350], [/Orion 675/, 750], [/Go-Panel/, 100], [/F8-200/, 200], [/EVO 2/, 400], [/Power 2/, 400], [/Mini 1/, 100], [/Q1000/, 450], [/P360/, 90],
  [/DS1/, 220], [/DS3/, 660], [/DS6/, 1320], [/Pixel strip 8/, 10], [/Pixel strip 16/, 20], [/Pixel strip 32/, 40], [/RGB/, 100], [/Bi-colour/, 100],
];
export function fixtureWatts(model: string): number {
  for (const [re, w] of WATTS) if (re.test(model)) return w;
  return 300;
}
