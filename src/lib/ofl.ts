// Loads Open Fixture Library profiles on demand and converts them to channelMap FixtureDefs.
import type { ChannelAttr, FixtureDef } from "./dmx";
import { buildMode } from "./gdtf";

const RAW = "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/fixtures";

type Cap = { type?: string; color?: string; colors?: string[] };
type OflChannel = { capability?: Cap; capabilities?: Cap[]; fineChannelAliases?: string[] };
type OflFixture = { name: string; availableChannels?: Record<string, OflChannel>; modes?: { name: string; shortName?: string; channels: (string | null | object)[] }[]; physical?: { power?: number } };

function attrOf(name: string, ch: OflChannel): ChannelAttr {
  const cap = ch.capability ?? ch.capabilities?.[0] ?? {};
  const t = cap.type ?? "";
  if (t === "Intensity") return "Dimmer";
  if (t === "ColorTemperature") return "CCT";
  if (t === "ShutterStrobe" || t === "StrobeSpeed") return "Strobe";
  if (t === "ColorIntensity") {
    const c = (cap.color ?? "").toLowerCase();
    const map: Record<string, ChannelAttr> = { red: "Red", green: "Green", blue: "Blue", white: "White", "warm white": "White", "cold white": "White", amber: "Amber" };
    return map[c] ?? "Spare";
  }
  const n = name.toLowerCase();
  if (/^hue/.test(n)) return "Hue";
  if (/^sat/.test(n)) return "Saturation";
  if (/green.?magenta|^g\/?m|tint/.test(n)) return "GM";
  if (/crossfade/.test(n)) return "Crossfade";
  return "Spare";
}

/** Fetches an OFL fixture by "manufacturer/fixture" key; modes with matrix inserts are skipped. */
export async function loadOflFixture(key: string, brand: string): Promise<FixtureDef> {
  const res = await fetch(`${RAW}/${key}.json`);
  if (!res.ok) throw new Error("Could not download this fixture profile.");
  const f = (await res.json()) as OflFixture;
  const lookup = new Map<string, { attr: ChannelAttr; fine?: boolean }>();
  for (const [name, ch] of Object.entries(f.availableChannels ?? {})) {
    const attr = attrOf(name, ch);
    lookup.set(name, { attr });
    (ch.fineChannelAliases ?? []).forEach((a, i) => lookup.set(a, i === 0 ? { attr, fine: true } : { attr: "Spare" }));
  }
  const modes = (f.modes ?? [])
    .filter((m) => m.channels.every((c) => c === null || typeof c === "string"))
    .map((m) => buildMode(m.name, m.channels.map((c) => (typeof c === "string" ? lookup.get(c) ?? { attr: "Spare" as const } : { attr: "Spare" as const }))));
  if (!modes.length) throw new Error("This fixture only has pixel-matrix modes, which are not supported yet.");
  return { id: `ofl-${key.replace(/[^a-z0-9]+/gi, "-")}`, brand, model: f.name, modes, ...(f.physical?.power ? { watts: f.physical.power } : {}) } as FixtureDef;
}
