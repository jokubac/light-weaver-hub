// GDTF (General Device Type Format) import: parse the description.xml inside a .gdtf
// (which is a ZIP) into a FixtureDef compatible with the console's library.
// GDTF spec: https://gdtf-share.com — we only read what the console needs to drive DMX.
import { unzipSync, strFromU8 } from "fflate";
import type { ChannelAttr, ChannelMapEntry, FixtureDef, FixtureMode, ModeKind } from "./dmx";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Canonical per-channel token used by the generic channelMap fallback (alias of dmx.ts's ChannelAttr). */
export type GdtfAttr = ChannelAttr;
export type GdtfChannelMapEntry = ChannelMapEntry;

/** Maps a GDTF LogicalChannel "Attribute" name (or Feature) to our canonical token. */
function mapAttribute(raw: string): GdtfAttr | null {
  const a = raw.trim();
  if (/^Dimmer$/i.test(a)) return "Dimmer";
  if (/^(CTC|ColorTemperature|CTO|ColorCorrection)$/i.test(a)) return "CCT";
  if (/^(Tint|ColorMacroGM|CTB)$/i.test(a)) return "GM";
  if (/^HSB_Hue$/i.test(a)) return "Hue";
  if (/^HSB_Saturation$/i.test(a)) return "Saturation";
  if (/^ColorAdd_R(ed)?$/i.test(a) || /^ColorRGB_Red$/i.test(a)) return "Red";
  if (/^ColorAdd_G(reen)?$/i.test(a) || /^ColorRGB_Green$/i.test(a)) return "Green";
  if (/^ColorAdd_B(lue)?$/i.test(a) || /^ColorRGB_Blue$/i.test(a)) return "Blue";
  if (/^ColorAdd_W(hite)?$/i.test(a)) return "White";
  if (/^ColorAdd_A(mber)?$/i.test(a)) return "Amber";
  if (/^(Crossfade|HSB_Crossfade|CTO_Crossfade)$/i.test(a)) return "Crossfade";
  if (/^(Shutter1?|Strobe|Shutter1Strobe)$/i.test(a)) return "Strobe";
  if (/^Pan$/i.test(a)) return "Pan";
  if (/^Tilt$/i.test(a)) return "Tilt";
  if (/^Gobo1$/i.test(a)) return "Gobo";
  if (/^Gobo1(Pos|PosRotate|WheelSpin)?Rotate$|^Gobo1Pos$/i.test(a)) return "GoboRot";
  if (/^Gobo2$/i.test(a)) return "Gobo2";
  if (/^Prism1$/i.test(a)) return "Prism";
  if (/^Prism1Pos(Rotate)?$/i.test(a)) return "PrismRot";
  if (/^Zoom$/i.test(a)) return "Zoom";
  if (/^Focus1?$/i.test(a)) return "Focus";
  if (/^Iris$/i.test(a)) return "Iris";
  if (/^Frost1?$/i.test(a)) return "Frost";
  const blade = /^Blade([1-4])(A|B|Rot)$/i.exec(a);
  if (blade) return `Blade${blade[1]}${blade[2]!.length === 3 ? "Rot" : blade[2]!.toUpperCase()}` as GdtfAttr;
  if (/^ShaperRot$/i.test(a)) return "ShaperRot";
  return null;
}

/** GDTF DMX value "n/bytes" → 0-1 */
export function dmxFraction(raw: string | null | undefined): number | undefined {
  const m = /^\s*(\d+)\s*\/\s*([1-4])\s*$/.exec(raw ?? "");
  if (!m) return undefined;
  const max = 256 ** Number(m[2]) - 1;
  return Math.max(0, Math.min(1, Number(m[1]) / max));
}

interface RawChannel {
  attr: GdtfAttr;
  bytes: number; // 1 or 2
  firstOffset: number;
  offsets: number[];
  physicalRange?: [number, number];
  home?: number;
  slots?: { name: string; v: number }[];
}

/** The DMX order our encode() already writes for each kind — used to recognise an exact match. */
const KIND_SEQUENCES: { kind: ModeKind; seq: GdtfAttr[] }[] = [
  { kind: "full", seq: ["Dimmer", "CCT", "GM", "Crossfade", "Hue", "Saturation"] },
  { kind: "hsi", seq: ["Dimmer", "Hue", "Saturation", "CCT"] },
  { kind: "rgbw", seq: ["Dimmer", "Red", "Green", "Blue", "White"] },
  { kind: "cctgm", seq: ["Dimmer", "CCT", "GM"] },
  { kind: "cct", seq: ["Dimmer", "CCT"] },
  { kind: "rgb", seq: ["Red", "Green", "Blue"] },
  { kind: "dim", seq: ["Dimmer"] },
];

function attrAt(el: Element, ...names: string[]): string {
  for (const n of names) {
    const v = el.getAttribute(n);
    if (v != null) return v;
  }
  return "";
}

const SLOT_ATTRS = new Set<GdtfAttr>(["Strobe", "Gobo", "Gobo2", "GoboRot", "Prism", "PrismRot", "Frost"]);

/** Named positions from a channel's chart (gobo names, shutter Open/Closed/Strobe…), in DMX order. */
function readSlots(ch: Element): { name: string; v: number }[] {
  const out: { name: string; v: number }[] = []; const seen = new Set<string>();
  const add = (name: string, raw: string | null) => {
    const v = dmxFraction(raw); const n = name.trim();
    if (v === undefined || !n || seen.has(n.toLowerCase()) || out.length >= 32) return;
    seen.add(n.toLowerCase()); out.push({ name: n.slice(0, 24), v: +v.toFixed(4) });
  };
  for (const fn of Array.from(ch.querySelectorAll("ChannelFunction"))) {
    const sets = Array.from(fn.querySelectorAll("ChannelSet")).filter((s) => (s.getAttribute("Name") ?? "").trim());
    if (sets.length) sets.forEach((s) => add(s.getAttribute("Name")!, s.getAttribute("DMXFrom")));
    else add(fn.getAttribute("Name") ?? "", fn.getAttribute("DMXFrom"));
  }
  return out.sort((a, b) => a.v - b.v);
}

/** Parses one DMXMode element into a FixtureMode (or null if it has no usable channels). */
function parseMode(modeEl: Element, doc: Document): FixtureMode | null {
  const name = attrAt(modeEl, "Name") || "Mode";
  const channelsRoot = modeEl.querySelector("DMXChannels") ?? modeEl;
  const channelEls = Array.from(channelsRoot.querySelectorAll("DMXChannel"));
  const raws: RawChannel[] = [];
  let footprint = 0;
  // pixel modes define one template channel per geometry; GeometryReferences repeat it at each pixel's DMX offset
  const modeGeo = attrAt(modeEl, "Geometry");
  const geoByName = new Map<string, Element>();
  for (const g of Array.from(doc.querySelectorAll("Geometries *"))) { const n = g.getAttribute("Name"); if (n && g.tagName !== "GeometryReference" && !geoByName.has(n)) geoByName.set(n, g); }
  const geoRoot = modeGeo ? geoByName.get(modeGeo) : undefined;
  const allRefs = geoRoot ? Array.from(geoRoot.querySelectorAll("GeometryReference")) : [];
  const refsFor = (geometry: string, dmxBreak: string): number[] => {
    if (!geometry || !allRefs.length) return [];
    // a channel on a child of a template geometry repeats with every reference to that template
    const names = new Set<string>([geometry]);
    let el: Element | null | undefined = geoByName.get(geometry);
    while (el && el.tagName !== "Geometries") { const n = el.getAttribute("Name"); if (n) names.add(n); el = el.parentElement; }
    return allRefs
      .filter((r) => names.has(r.getAttribute("Geometry") ?? ""))
      .map((r) => {
        const b = Array.from(r.querySelectorAll("Break")).find((x) => (x.getAttribute("DMXBreak") ?? "1") === dmxBreak) ?? r.querySelector("Break");
        return parseInt(b?.getAttribute("DMXOffset") ?? "", 10);
      })
      .filter((n) => Number.isInteger(n) && n >= 1);
  };
  for (const ch of channelEls) {
    const offsetRaw = attrAt(ch, "Offset");
    if (!offsetRaw || offsetRaw === "None" || offsetRaw === "-1") continue;
    const base = offsetRaw.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => Number.isInteger(x) && x >= 1);
    if (base.length === 0) continue;
    const refs = refsFor(attrAt(ch, "Geometry"), attrAt(ch, "DMXBreak") || "1");
    const sets = refs.length ? refs.map((r) => base.map((o) => o + r - 1)) : [base];
    for (const offsetsAll of sets) {
    const offsets = offsetsAll.filter((x) => x <= 512);
    if (offsets.length === 0) continue;
    footprint = Math.max(footprint, ...offsets);
    // attribute lives on the (first) LogicalChannel's Attribute, falling back to InitialFunction
    const logical = ch.querySelector("LogicalChannel");
    const attrName = logical ? attrAt(logical, "Attribute") : attrAt(ch, "Attribute");
    const mapped = attrName ? mapAttribute(attrName) : null;
    const fn = logical?.querySelector("ChannelFunction");
    const from = Number(fn?.getAttribute("PhysicalFrom"));
    const to = Number(fn?.getAttribute("PhysicalTo"));
    const physicalRange: [number, number] | undefined = mapped === "CCT" && from >= 1000 && to >= 1000 && from !== to ? [from, to] : undefined;
    const home = dmxFraction(ch.getAttribute("Default")) ?? dmxFraction(fn?.getAttribute("Default"));
    const slots = mapped && SLOT_ATTRS.has(mapped) ? readSlots(ch) : undefined;
    raws.push({
      attr: mapped ?? "Spare", bytes: Math.min(2, offsets.length), firstOffset: Math.min(...offsets), offsets,
      ...(!mapped && attrName ? { label: attrName } : {}),
      ...(physicalRange ? { physicalRange } : {}), ...(home ? { home } : {}), ...(slots?.length ? { slots } : {}),
    });    }
  }
  if (raws.length === 0) return null;
  raws.sort((a, b) => a.firstOffset - b.firstOffset);

  const wide = raws.some((r) => r.bytes === 2);
  const totalChannels = footprint;
  const bareSeq = raws.map((r) => r.attr);
  const contiguous = raws.every((r, i) => r.firstOffset === i + 1) && totalChannels === raws.length;
  const match = KIND_SEQUENCES.find((k) => contiguous && !raws.some((r) => r.physicalRange || r.home) && k.seq.length === bareSeq.length && k.seq.every((a, i) => a === bareSeq[i]) && !wide);
  if (match) {
    return { name, channels: totalChannels, kind: match.kind, source: "gdtf" };
  }
  // generic fallback: one channelMap entry per DMX byte, in order
  const channelMap: ChannelMapEntry[] = Array.from({ length: totalChannels }, () => ({ attr: "Spare" }));
  for (const r of raws) {
    r.offsets.slice(0, 2).forEach((offset, index) => {
      const fine = index === 1;
      const n = r.home !== undefined ? Math.round(r.home * (r.offsets.length > 1 ? 65535 : 255)) : 0;
      const home = r.home === undefined ? undefined : r.offsets.length > 1 ? (fine ? (n & 255) / 255 : (n >> 8) / 255) : r.home;
      channelMap[offset - 1] = {
        attr: r.attr, ...(fine ? { fine: true } : {}), ...(r.label ? { label: r.label } : {}), ...(r.physicalRange ? { physicalRange: r.physicalRange } : {}),
        ...(home ? { home: +home.toFixed(4) } : {}), ...(!fine && r.slots ? { slots: r.slots } : {}),
      };
    });
  }
  return { name: wide ? `${name} (16-bit)` : name, channels: totalChannels, kind: "full", source: "gdtf", channelMap } as FixtureMode;
}

/** Builds a FixtureMode from an ordered list of channel attributes (used by GDTF import and the manual Fixture Builder). */
export function buildMode(name: string, entries: { attr: ChannelAttr; fine?: boolean }[]): FixtureMode {
  const wide = entries.some((e) => e.fine);
  const totalChannels = entries.length;
  const bareSeq = entries.filter((e) => !e.fine).map((e) => e.attr);
  const match = !wide && KIND_SEQUENCES.find((k) => k.seq.length === bareSeq.length && k.seq.every((a, i) => a === bareSeq[i]));
  if (match) return { name, channels: totalChannels, kind: match.kind, source: "custom" };
  return { name, channels: totalChannels, kind: "full", source: "custom", channelMap: entries.map((e) => ({ attr: e.attr, ...(e.fine ? { fine: true } : {}) })) };
}

/** Parses a description.xml string into a FixtureDef. Pure function — no zip/file I/O, for easy testing. */
export function parseDescriptionXml(xml: string): FixtureDef | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const fixtureType = doc.querySelector("FixtureType");
  if (!fixtureType) return null;
  const manufacturer = attrAt(fixtureType, "Manufacturer") || "Unknown";
  const model = attrAt(fixtureType, "Name") || attrAt(fixtureType, "ShortName") || "GDTF fixture";
  const modeEls = Array.from(doc.querySelectorAll("DMXModes > DMXMode"));
  const modes = modeEls.map((el) => parseMode(el, doc)).filter((x): x is FixtureMode => !!x);
  if (modes.length === 0) return null;
  return { id: `gdtf-${slug(`${manufacturer} ${model}`)}`, brand: manufacturer, model, modes, ...readPhysical(doc, modes) };
}

/** Power draw, CCT range and light-source type from the GDTF physical description + channel functions. */
export function readPhysical(doc: Document, modes: FixtureMode[]): Pick<FixtureDef, "watts" | "cctRange" | "lightType"> {
  const out: Pick<FixtureDef, "watts" | "cctRange" | "lightType"> = {};
  // Power: Properties/PowerConsumption Value (W), or Connector/PowerConsumption
  const powers = Array.from(doc.querySelectorAll("PowerConsumption")).map((el) => parseFloat(attrAt(el, "Value", "PowerConsumption"))).filter((v) => v > 0);
  const legacy = Array.from(doc.querySelectorAll("Properties > *, Geometry")).map((el) => parseFloat(attrAt(el, "PowerConsumption"))).filter((v) => v > 0);
  const w = Math.max(0, ...powers, ...legacy);
  if (w > 0) out.watts = Math.round(w);
  // CCT: physical range of CTC / ColorTemperature channel functions
  // Prefer plain "CCT"/"CCT Range" functions (FX like Candle/Fire use other ranges) and take the
  // most common range, so manufacturer data such as ARRI 2800–10000 K comes out exact.
  const counts = new Map<string, number>(); const ks: number[] = [];
  for (const fn of Array.from(doc.querySelectorAll("ChannelFunction"))) {
    const attribute = attrAt(fn, "Attribute") || (fn.parentElement ? attrAt(fn.parentElement, "Attribute") : "");
    if (!/^(CTC|ColorTemperature)$/i.test(attribute)) continue;
    const from = parseFloat(attrAt(fn, "PhysicalFrom")), to = parseFloat(attrAt(fn, "PhysicalTo"));
    if (!(from >= 1000 && to >= 1000 && from <= 20000 && to <= 20000 && from !== to)) continue;
    if (/fx|candle|fire|flicker|explosion|lightning|tv|strobe|effect/i.test(attrAt(fn, "Name"))) continue;
    const k = `${Math.round(Math.min(from, to))}-${Math.round(Math.max(from, to))}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || (+b[0].split("-")[1]! - +b[0].split("-")[0]!) - (+a[0].split("-")[1]! - +a[0].split("-")[0]!))[0];
  if (best) { const [a, b] = best[0].split("-").map(Number); out.cctRange = [a!, b!]; ks.push(a!, b!); }
  else {
    for (const em of Array.from(doc.querySelectorAll("Emitter"))) { const k = parseFloat(attrAt(em, "ColorTemperature")); if (k >= 1000 && k <= 20000) ks.push(k); }
    if (ks.length) out.cctRange = [Math.round(Math.min(...ks)), Math.round(Math.max(...ks))];
  }
  // Type: Beam LampType + emitters / channel layout
  const lamp = Array.from(doc.querySelectorAll("Beam")).map((b) => attrAt(b, "LampType")).find(Boolean) ?? "";
  const colour = modes.some((m) => m.kind === "rgb" || m.kind === "rgbw" || m.kind === "hsi" || m.kind === "full");
  const bi = !colour && modes.some((m) => m.kind === "cct" || m.kind === "cctgm") || (!colour && ks.length > 0);
  if (/tungsten|halogen|incandescent/i.test(lamp)) out.lightType = "Tungsten";
  else if (/discharge|hmi/i.test(lamp)) out.lightType = "HMI";
  else if (/fluor/i.test(lamp)) out.lightType = "Fluorescent";
  else out.lightType = colour ? "LED colour" : bi ? "Bi-colour LED" : "LED";
  return out;
}

/** Finds and decodes description.xml inside an unzipped GDTF archive. */
export function findDescriptionXml(entries: Record<string, Uint8Array>): string | null {
  const key = Object.keys(entries).find((k) => /(^|\/)description\.xml$/i.test(k));
  return key ? strFromU8(entries[key]!) : null;
}

/** Reads a .gdtf File (zip) in the browser and returns the parsed FixtureDef, or null if unparsable. */
export async function importGdtfFile(file: File): Promise<FixtureDef | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);
  const xml = findDescriptionXml(entries);
  if (!xml) return null;
  return parseDescriptionXml(xml);
}
