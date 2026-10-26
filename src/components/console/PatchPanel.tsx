import { MAX_UNIVERSE } from "@/lib/dmx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, AlertTriangle, Grid3x3, Star, Unplug, Pencil, FileUp, Wrench, Radar, Trash2, ChevronDown, Zap } from "lucide-react";
import { favoritesFirst, useFavorites } from "@/lib/favorites";
import { DmxMap } from "./DmxMap";
import { NumberField } from "./NumberField";
import { FixtureIconPicker } from "./FixtureIconPicker";
import { FixtureGlyph } from "./FixtureGlyph";
import type { FixtureIcon } from "@/lib/fixture-icons";
import { planPatch } from "@/lib/patch-plan";
import { importGdtfFile, buildMode } from "@/lib/gdtf";
import { addCustomFixture, useCustomFixtures } from "@/lib/custom-fixtures";
import { loadGdtfLibrary, searchGdtfLibrary, installGdtfFixture, type LibraryDef } from "@/lib/gdtf-library";
import { type RdmDevice } from "@/lib/rdm";
import { RdmManager } from "./RdmManager";
import { FixtureBuilder } from "./FixtureBuilder";
import {
  FIXTURE_LIBRARY,
  createFixture,
  findFreeAddress,
  getDef,
  deriveMode,
  isVerifiedDef,
  overlaps,
  type FixtureDef,
  type PatchedFixture,
} from "@/lib/dmx";

const chartTag = (d: Pick<FixtureDef, "modes">) => (isVerifiedDef(d) ? " · ✓ official chart" : " · ⚠ unverified");

/** Pixel count for a mode, including layouts derived at getMode time (Astera names, "Pixel N" modes). */
const pxCount = (def: FixtureDef, i: number) => deriveMode(def, def.modes[i]!).pixels ?? 0;

/** Capability filters for the mode list (chips at the Mode step). */
type CapFilter = "pixels" | "cct" | "gm" | "colour" | "rgbw" | "hsi" | "strobe" | "zoom" | "mover" | "gobo" | "bit8" | "bit16";
const CAP_FILTERS: { id: CapFilter; label: string }[] = [
  { id: "pixels", label: "Pixels" },
  { id: "cct", label: "CCT" },
  { id: "gm", label: "Green/Magenta" },
  { id: "colour", label: "Colour" },
  { id: "rgbw", label: "RGBW" },
  { id: "hsi", label: "HSI" },
  { id: "strobe", label: "Strobe" },
  { id: "zoom", label: "Zoom" },
  { id: "mover", label: "Pan/Tilt" },
  { id: "gobo", label: "Gobo" },
  { id: "bit8", label: "8-bit" },
  { id: "bit16", label: "16-bit" },
];
const modeAttrs = (def: FixtureDef, i: number) => deriveMode(def, def.modes[i]!).channelMap?.map((e) => e.attr) ?? [];
const goboAttr = (attrs: string[]) => attrs.some((a) => a === "Gobo" || a === "Gobo2" || a === "GoboRot");
/** Mode has at least one 16-bit (coarse+fine) channel — from the channel map, else from the mode name. */
function is16(def: FixtureDef, i: number): boolean {
  const mo = deriveMode(def, def.modes[i]!);
  if (mo.channelMap) return mo.channelMap.some((e) => e.fine);
  return /16[\s-]?bit|\bfine\b|\b16\b/i.test(mo.name);
}
const ATTR_LABEL: Record<string, string> = { GM: "Green/Magenta", CCT: "CCT", Hue: "Hue", Saturation: "Saturation", Crossfade: "Colour crossfade" };
/** Human-readable channel list for a mode ("Dimmer", "Dimmer fine", ...). */
function footprintOf(def: FixtureDef, i: number): string[] {
  const mo = deriveMode(def, def.modes[i]!);
  if (!mo.channelMap) return [];
  const px = mo.pixels ?? 0, per = px > 1 ? Math.floor(mo.channelMap.length / px) : 0, lead = px > 1 ? mo.channelMap.length - per * px : 0;
  return mo.channelMap.map((e, k) => {
    const name = `${e.label ?? ATTR_LABEL[e.attr] ?? e.attr}${e.fine ? " fine" : ""}`;
    return per && k >= lead ? `P${Math.floor((k - lead) / per) + 1} ${name}` : name;
  });
}
/** Per-mode capability test — chips filter individual modes by their actual channels, not mode names. */
function modeHasCap(def: FixtureDef, i: number, cap: CapFilter): boolean {
  const mo = def.modes[i]!;
  const attrs = modeAttrs(def, i);
  const hasMap = attrs.length > 0;
  const n = mo.name;
  switch (cap) {
    case "pixels": return pxCount(def, i) > 0;
    case "cct": return hasMap ? attrs.includes("CCT") : mo.kind === "cct" || mo.kind === "cctgm" || mo.kind === "full" || /\bCCT\b/i.test(n);
    case "gm": return hasMap ? attrs.includes("GM") : mo.kind === "cctgm" || mo.kind === "full" || /\bG\/?M\b|\bGM\b|green|magenta|\+\/-\s?green/i.test(n);
    case "colour": return hasMap ? attrs.some((a) => a === "Red" || a === "Hue") : mo.kind === "rgb" || mo.kind === "rgbw" || mo.kind === "hsi" || mo.kind === "full" || /RGB|HS/i.test(n);
    case "rgbw": return hasMap ? attrs.includes("Red") && attrs.includes("White") : mo.kind === "rgbw" || mo.kind === "full" || /RGBW/i.test(n);
    case "hsi": return hasMap ? attrs.includes("Hue") : mo.kind === "hsi" || /\bHS/i.test(n);
    case "strobe": return hasMap ? attrs.includes("Strobe") : /strobe|\bS\b/i.test(n);
    case "zoom": return attrs.includes("Zoom");
    case "mover": return attrs.includes("Pan") || attrs.includes("Tilt");
    case "gobo": return goboAttr(attrs);
    case "bit16": return is16(def, i);
    case "bit8": return !is16(def, i);
  }
}

export const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#ffffff", "#78716c"];

const modeKey = (defId: string, i: number) => `${defId}:${i}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Official manufacturer profile number ("Profile 42 — …"), so modes list in the fixture's own numbering; unnumbered modes go last. */
const profileNo = (name: string) => { const r = /^Profile (\d+)/.exec(name); return r ? +r[1]! : 10000; };

export function PatchPanel({ fixtures, onAdd, onRemove, onUpdate, defaultMap = true, showPatched = true, pixelOnly = false }: {
  pixelOnly?: boolean; defaultMap?: boolean; showPatched?: boolean; fixtures: PatchedFixture[]; onAdd: (fs: PatchedFixture[]) => void; onRemove: (uids: string[]) => void; onUpdate: (uid: string, p: Partial<PatchedFixture>) => void;
}) {
  const [query, setQuery] = useState("");
  const [modeQuery, setModeQuery] = useState("");
  const [unpick, setUnpick] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [def, setDef] = useState<FixtureDef | null>(null);
  const [modeIdx, setModeIdx] = useState<number | null>(null);
  const [mapU, setMapU] = useState(1);
  const [showMap, setShowMap] = useState(defaultMap);
  const baseCaps: CapFilter[] = pixelOnly ? ["pixels"] : [];
  const [caps, setCaps] = useState<CapFilter[]>(baseCaps);
  const isPx = (d: FixtureDef) => !pixelOnly || d.modes.some((_, i) => pxCount(d, i) > 0);
  const toggleCap = (c: CapFilter) => (pixelOnly && c === "pixels") || setCaps((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const fav = useFavorites("fixtures");
  const favModes = useFavorites("modes");
  const favBrands = useFavorites("manufacturers");
  const star = (id: string) => ({ starred: fav.has(id), onStar: () => fav.toggle(id) });
  const universes = Array.from(new Set([1, ...fixtures.map((f) => f.universe)])).sort((a, b) => a - b);

  const q = query.trim().toLowerCase();
  // Patch search/browse shows only the manufacturer GDTF library; the built-in
  // library stays in dmx.ts solely so already-patched fixtures keep working.
  const [gdtfLib, setGdtfLib] = useState<LibraryDef[] | null>(null);
  useEffect(() => { if (!gdtfLib) loadGdtfLibrary().then(setGdtfLib, () => {}); }, [gdtfLib]);
  const gdtfHits = useMemo(() => (gdtfLib && q ? favoritesFirst(searchGdtfLibrary(gdtfLib, q, gdtfLib.length), (d) => fav.has(d.id) || favBrands.has(d.brand)).slice(0, 60) : []), [gdtfLib, q, fav.list, favBrands.list]);
  const gdtfBrands = useMemo(() => (gdtfLib ? Array.from(new Set(gdtfLib.map((d) => d.brand))).sort((a, b) => a.localeCompare(b)) : []), [gdtfLib]);
  const [gdtfBusy, setGdtfBusy] = useState(false);
  const pickGdtf = async (d: LibraryDef) => { setGdtfBusy(true); try { const nd = await installGdtfFixture(d); setBrand(nd.brand); setDef(nd); setModeIdx(null); setQuery(""); setCaps(baseCaps); } finally { setGdtfBusy(false); } };
  const availableDefs = [...(gdtfLib ?? []), ...FIXTURE_LIBRARY.filter((d) => d.modes.some((m) => !m.legacy) && !(gdtfLib ?? []).some((g) => g.id === d.id))];
  // Library filters: verification state, pixel/non-pixel and exact pixel count.
  const [verF, setVerF] = useState<"all" | "ok" | "no">("all");
  const [pxF, setPxF] = useState<"all" | "px" | "none">(pixelOnly ? "px" : "all");
  const [pxN, setPxN] = useState<number | null>(null);
  const pxMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const d of gdtfLib ?? []) { try { m.set(d.id, [...new Set(d.modes.map((_, i) => pxCount(d, i)).filter((n) => n > 0))].sort((a, b) => a - b)); } catch { m.set(d.id, []); } }
    return m;
  }, [gdtfLib]);
  const pxOptions = useMemo(() => [...new Set([...pxMap.values()].flat())].sort((a, b) => a - b), [pxMap]);
  const passF = (d: FixtureDef) => {
    if (verF !== "all" && isVerifiedDef(d) !== (verF === "ok")) return false;
    const px = pxMap.get(d.id) ?? [];
    if (pxF === "px" && !px.length) return false;
    if (pxF === "none" && px.length) return false;
    if (pxN !== null && !px.includes(pxN)) return false;
    return true;
  };
  const filtersOn = verF !== "all" || pxF !== (pixelOnly ? "px" : "all") || pxN !== null;
  const chip = (on: boolean) => `rounded-md px-2 py-1 text-[11px] font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"}`;
  const chooseDef = async (d: FixtureDef, index: number | null = null) => {
    const bundled = gdtfLib?.find((g) => g.id === d.id);
    const installed = bundled ? await installGdtfFixture(bundled) : d;
    setBrand(installed.brand); setDef(installed); setModeIdx(index); setCaps(baseCaps);
  };
  const favPairs = favModes.list.map((k) => {
    const [id, i] = [k.slice(0, k.lastIndexOf(":")), +k.slice(k.lastIndexOf(":") + 1)];
    const d = availableDefs.find((x) => x.id === id);
    return d && d.modes[i] ? { d, i, k } : null;
  }).filter((x): x is { d: FixtureDef; i: number; k: string } => !!x);

  const reset = () => { setBrand(null); setDef(null); setModeIdx(null); setModeQuery(""); setCaps(baseCaps); };
  const back = () => (modeIdx !== null ? setModeIdx(null) : def ? (setDef(null), setModeQuery("")) : setBrand(null));
  const crumbs = [brand, def?.model, modeIdx !== null ? def?.modes[modeIdx]?.name : null].filter(Boolean);
  const mq = modeQuery.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Patch</h2>
        <button onClick={() => setShowMap((v) => !v)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${showMap ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><Grid3x3 className="h-3.5 w-3.5" />DMX map</button>
      </div>
      {showMap && modeIdx === null && (
        <div className="space-y-2 rounded-lg bg-surface-elevated/50 p-2">
          <div className="flex flex-wrap gap-1">
            {universes.map((u) => (
              <button key={u} onClick={() => setMapU(u)} className={`rounded px-2 py-1 font-mono text-[11px] ${mapU === u ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>U{u}</button>
            ))}
            <NumberField integer min={1} max={MAX_UNIVERSE} value={mapU} onChange={(v) => v && setMapU(v)} className="w-14 rounded border border-input bg-surface px-1 text-[11px]" aria-label="Universe" />
          </div>
          <DmxMap fixtures={fixtures} universe={mapU} />
        </div>
      )}
      {crumbs.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={back} className="rounded-md bg-surface-elevated p-2 text-primary" aria-label="Back"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={reset} className="min-w-0 truncate text-left text-xs text-muted-foreground">{crumbs.join(" › ")}</button>
        </div>
      )}

      {!def && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brand, model" className="w-full pl-9 pr-3 rounded-md border border-input bg-surface-elevated py-2 text-sm text-foreground outline-none focus:border-primary" />
          </div>
          <div className="flex flex-wrap items-center gap-1" aria-label="Fixture filters">
            {([["all", "All"], ["ok", "✓ Verified"], ["no", "⚠ Unverified"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setVerF(k)} className={chip(verF === k)}>{l}</button>)}
            <span className="mx-1 h-4 w-px bg-border" />
            {([["all", "Any"], ["px", "Pixel"], ["none", "No pixels"]] as const).filter(([k]) => !pixelOnly || k === "px").map(([k, l]) => <button key={k} type="button" onClick={() => { setPxF(k); if (k === "none") setPxN(null); }} className={chip(pxF === k)}>{l}</button>)}
            {pxF !== "none" && (
              <select value={pxN ?? ""} onChange={(e) => { const v = e.target.value ? +e.target.value : null; setPxN(v); if (v !== null) setPxF("px"); }} aria-label="Pixel count" className="rounded-md border border-input bg-surface-elevated px-2 py-1 text-[11px]">
                <option value="">Pixels: any</option>
                {pxOptions.map((n) => <option key={n} value={n}>{n} px</option>)}
              </select>
            )}
            {filtersOn && <button type="button" onClick={() => { setVerF("all"); setPxF(pixelOnly ? "px" : "all"); setPxN(null); }} className="px-1 text-[11px] text-primary underline">Clear</button>}
          </div>
        </div>
      )}

      {!def && <MoreSources fixtures={fixtures} onAdd={onAdd} onPick={(d) => { setBrand(d.brand); setDef(d); setModeIdx(0); }} />}
      {!def && q ? (
        <List>
          {gdtfHits.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Manufacturer GDTF{gdtfBusy ? " · loading…" : ""}</p>}
          {gdtfHits.filter((d) => isPx(d) && passF(d)).map((d) => (
            <Row key={`g-${d.id}`} {...star(d.id)} onClick={() => void pickGdtf(d)} title={d.model} sub={`${d.brand} · ${d.modes.length} modes${d.cctRange ? ` · ${d.cctRange[0]}–${d.cctRange[1]} K` : ""}${chartTag(d)}`} />
          ))}
          {gdtfHits.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{gdtfLib ? "No fixtures found" : "Loading fixture library…"}</p>}
        </List>
      ) : !brand ? (
        <List>
          {favPairs.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-glow">★ Favourite fixture + mode</p>}
          {favPairs.filter(({ d, i }) => !pixelOnly || pxCount(d, i) > 0).map(({ d, i, k }) => (
            <Row key={`fm-${k}`} starred onStar={() => favModes.toggle(k)} onClick={() => void chooseDef(d, i)} title={`${d.brand} ${d.model}`} sub={`${d.modes[i]!.name} · ${d.modes[i]!.channels} ch`} />
          ))}
          {fav.list.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-glow">★ Favourite fixtures</p>}
          {availableDefs.filter((d) => fav.has(d.id) && isPx(d) && passF(d)).map((d) => (
            <Row key={`fav-${d.id}`} {...star(d.id)} onClick={() => void chooseDef(d)} title={`${d.brand} ${d.model}`} sub={`${d.modes.length} modes${chartTag(d)}`} />
          ))}
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manufacturers{gdtfLib ? ` · ${gdtfLib.length} fixtures` : " · loading…"}</p>
          {favoritesFirst(gdtfBrands, (b) => favBrands.has(b)).map((b) => ({ b, n: (gdtfLib ?? []).filter((d) => d.brand === b && passF(d)).length })).filter(({ n }) => n > 0).map(({ b, n }) => (
            <Row key={b} starred={favBrands.has(b)} onStar={() => favBrands.toggle(b)} onClick={() => setBrand(b)} title={b} sub={`${n} models`} />
          ))}
        </List>
      ) : !def ? (
        <List>
          {favoritesFirst((gdtfLib ?? []).filter((d) => d.brand === brand && passF(d)), (d) => fav.has(d.id)).map((d) => (
            <Row key={d.id} {...star(d.id)} onClick={() => void pickGdtf(d)} title={d.model} sub={`${d.modes.length} modes${d.cctRange ? ` · ${d.cctRange[0]}–${d.cctRange[1]} K` : ""}${chartTag(d)}`} />
          ))}
        </List>
      ) : modeIdx === null ? (
        <List>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={modeQuery} onChange={(e) => setModeQuery(e.target.value)} placeholder="Search mode" className="w-full pl-9 pr-3 rounded-md border border-input bg-surface-elevated py-2 text-sm text-foreground outline-none focus:border-primary" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CAP_FILTERS.filter((c) => caps.includes(c.id) || def.modes.some((_, i) => modeHasCap(def, i, c.id))).map((c) => (
              <button key={c.id} onClick={() => toggleCap(c.id)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${caps.includes(c.id) ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"}`}>{c.label}</button>
            ))}
          </div>
          {def.modes.map((mo, i) => ({ mo, i, n: profileNo(mo.name) })).filter(({ mo, i }) => !mo.legacy && caps.every((c) => modeHasCap(def, i, c))).sort((a, b) => Number(favModes.has(modeKey(def.id, b.i))) - Number(favModes.has(modeKey(def.id, a.i))) || a.n - b.n || a.i - b.i).filter(({ mo }) => !mq || `${mo.name} ${mo.channels}ch ${mo.kind} ${mo.pixels ? "pixel" : ""}`.toLowerCase().includes(mq)).map(({ mo, i }) => (
            <Row key={mo.name} starred={favModes.has(modeKey(def.id, i))} onStar={() => favModes.toggle(modeKey(def.id, i))} onClick={() => setModeIdx(i)} title={`${mo.name}${pxCount(def, i) ? ` (${pxCount(def, i)} px)` : ""}`} sub={`${mo.channels} ch · ${mo.kind.toUpperCase()}${pxCount(def, i) ? ` · ${pxCount(def, i)} px` : ""}`} footprint={footprintOf(def, i).length ? footprintOf(def, i) : undefined} />
          ))}
        </List>
      ) : (
        <PatchConfig fixtures={fixtures} def={def} modeIdx={modeIdx} onAdd={(fs) => { onAdd(fs); setModeIdx(null); }} />
      )}

      {showPatched && fixtures.length > 0 && (
        <div className={`space-y-2 rounded-lg bg-surface-elevated/50 p-2 ${defaultMap ? "" : "order-first"}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-auto text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Patched ({fixtures.length})</span>
            <button onClick={() => setUnpick(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-2 py-1 text-[11px] font-semibold">Select all</button>
            <button onClick={() => setUnpick([])} disabled={!unpick.length} className="rounded-md bg-surface-elevated px-2 py-1 text-[11px] font-semibold disabled:opacity-40">Deselect</button>
            <button
              onClick={() => {
                if (unpick.length === 0) return;
                const names = fixtures.filter((f) => unpick.includes(f.uid)).map((f) => f.name);
                if (window.confirm(`Unpatch ${names.length === 1 ? `"${names[0]}"` : `${names.length} fixtures`}? This cannot be undone.`)) {
                  onRemove(unpick);
                  setUnpick([]);
                }
              }}
              disabled={unpick.length === 0}
              className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-[11px] font-semibold text-destructive-foreground disabled:opacity-40"
            >
              <Unplug className="h-3.5 w-3.5" />Unpatch{unpick.length > 0 ? ` (${unpick.length})` : ""}
            </button>
          </div>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {fixtures.map((f) => {
              const on = unpick.includes(f.uid);
              const d = getDef(f.defId);
              const ch = d.modes[f.modeIdx]?.channels ?? 1;
              const clash = overlaps(fixtures, f.universe, f.address, ch, f.uid);
              return (
                <div key={f.uid} className={`rounded-md ${on ? "bg-destructive/20 ring-1 ring-destructive" : "bg-surface-elevated"}`}>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                    <Checkbox checked={on} onCheckedChange={() => setUnpick((u) => (on ? u.filter((x) => x !== f.uid) : [...u, f.uid]))} aria-label={`Pick ${f.name}`} />
                    {f.label && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.label }} />}
                    <FixtureGlyph model={d.model} icon={f.icon} colour="var(--color-primary)" className="h-7 w-9 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                    <span className={`shrink-0 font-mono text-[10px] ${clash.length ? "text-destructive" : "text-muted-foreground"}`}>U{f.universe}.{f.address} · {ch}ch</span>
                    <button onClick={() => setEditing(editing === f.uid ? null : f.uid)} className={`rounded p-1 ${editing === f.uid ? "text-primary" : "text-muted-foreground"}`} aria-label={`Edit ${f.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                  {editing === f.uid && (
                    <div className="space-y-2 border-t border-border p-2">
                      <Field label="Name"><input value={f.name} onChange={(e) => onUpdate(f.uid, { name: e.target.value })} className={inputCls} /></Field>
                      <FixtureIconPicker model={d.model} value={f.icon} onChange={(icon) => onUpdate(f.uid, { icon })} />
                      <Field label="Mode">
                        <select value={f.modeIdx} onChange={(e) => onUpdate(f.uid, { modeIdx: +e.target.value })} className={inputCls}>
                          {d.modes.map((m, i) => <option key={m.name} value={i}>{m.name}{pxCount(d, i) ? ` (${pxCount(d, i)} px)` : ""} · {m.channels} ch</option>)}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Universe"><NumberField integer min={1} max={MAX_UNIVERSE} value={f.universe} onChange={(v) => v && onUpdate(f.uid, { universe: v })} className={inputCls} /></Field>
                        <Field label="Address"><NumberField integer min={1} max={512} value={f.address} onChange={(v) => v && onUpdate(f.uid, { address: Math.min(v, 513 - ch) })} className={inputCls} /></Field>
                      </div>
                      {clash.length > 0 && <p className="flex gap-1.5 text-[11px] text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Overlaps {clash.map((c) => c.name).join(", ")}</p>}
                      <DmxMap fixtures={fixtures} universe={f.universe} highlight={f.uid} onPick={(a) => onUpdate(f.uid, { address: Math.min(a, 513 - ch) })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PatchConfig({ fixtures, def, modeIdx, onAdd }: { fixtures: PatchedFixture[]; def: FixtureDef; modeIdx: number; onAdd: (fs: PatchedFixture[]) => void }) {
  const ch = def.modes[modeIdx]!.channels;
  const [universe, setUniverse] = useState(1);
  const [address, setAddress] = useState<number>(() => findFreeAddress(fixtures, 1, ch) ?? 1);
  const [qty, setQty] = useState(1);
  const [offset, setOffset] = useState(0);
  const [baseName, setBaseName] = useState(def.model);
  const [label, setLabel] = useState<string | null>(null);
  const [icon, setIcon] = useState<FixtureIcon>("auto");

  const changeUniverse = (u: number) => {
    setUniverse(u);
    setAddress(findFreeAddress(fixtures, u, ch) ?? 1);
  };

  const existing = fixtures.filter((f) => f.defId === def.id).length;
  const strict = planPatch(fixtures, universe, address, ch, qty, offset, false);
  const spread = strict.overflows ? planPatch(fixtures, universe, address, ch, qty, offset, true) : strict;
  const shown = strict.overflows ? spread : strict;
  const problem = strict.overflows ? spread.problem : strict.problem;
  const build = (slots: typeof strict.slots) => slots.map((s, i) => {
    const nf = createFixture(def, modeIdx, s.universe, s.address, qty === 1 && existing === 0 ? baseName : `${baseName} ${existing + i + 1}`);
    return { ...nf, icon, ...(label ? { label } : {}) };
  });
  const patch = () => {
    if (strict.overflows) {
      const us = Array.from(new Set(spread.slots.map((s) => s.universe)));
      if (!window.confirm(`Not all ${qty} fixtures fit in universe ${universe}. Continue into universe ${us.slice(1).join(", ")}, starting the next fixture at a fresh address and leaving the leftover channels empty?`)) return;
      onAdd(build(spread.slots));
    } else onAdd(build(strict.slots));
  };
  const planned = shown.slots.filter((s) => s.universe === universe).map((s) => ({ address: s.address, channels: ch }));
  const used = fixtures.filter((f) => f.universe === universe).length;

  return (
    <div className="space-y-3 rounded-lg bg-surface-elevated p-3">
      <Field label="Name"><input value={baseName} onChange={(e) => setBaseName(e.target.value)} className={inputCls} /></Field>
      <FixtureIconPicker model={def.model} value={icon} onChange={setIcon} />
      <div>
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colour tag (optional)</span>
        <div className="flex flex-wrap gap-1.5">
          {LABEL_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setLabel(label === c ? null : c)} aria-label={`Tag ${c}`}
              className={`h-7 w-7 rounded-full border-2 ${label === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Universe"><NumberField integer min={1} max={MAX_UNIVERSE} value={universe} onChange={(v) => v && changeUniverse(v)} className={inputCls} /></Field>
        <Field label="Start address"><NumberField integer min={1} max={512} value={address} onChange={(v) => v && setAddress(v)} className={inputCls} /></Field>
        <Field label="Quantity"><NumberField integer min={1} max={256} value={qty} onChange={(v) => v && setQty(v)} className={inputCls} /></Field>
        <Field label="Offset (gap ch)"><NumberField integer min={0} max={100} value={offset} onChange={(v) => setOffset(v ?? 0)} className={inputCls} /></Field>
      </div>
      <DmxMap fixtures={fixtures} universe={universe} planned={planned} onPick={setAddress} />
      <p className="text-[11px] text-muted-foreground">
        {ch} ch each · {shown.slots.slice(0, 6).map((s) => `U${s.universe}.${s.address}`).join(", ")}{shown.slots.length > 6 ? "…" : ""} · {used} fixtures already in U{universe}
      </p>
      {strict.overflows && !problem && <p className="flex items-start gap-2 text-xs text-amber-glow"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Doesn't fit in U{universe} — you'll be asked to continue into the next universe.</p>}
      {problem && <p className="flex items-start gap-2 text-xs text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{problem}</p>}
      <div className="flex gap-2">
        <button onClick={() => setAddress(findFreeAddress(fixtures, universe, ch) ?? 1)} className="flex-1 rounded-md bg-surface py-2.5 text-xs font-semibold">Next free</button>
        <button disabled={!!problem} onClick={patch} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          Patch {qty > 1 ? `${qty} fixtures` : "fixture"}
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function MoreSources({ fixtures, onAdd, onPick }: { fixtures: PatchedFixture[]; onAdd: (fs: PatchedFixture[]) => void; onPick: (d: FixtureDef) => void }) {
  const [open, setOpen] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [gdtfMsg, setGdtfMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const custom = useCustomFixtures();
  const [bundledIds, setBundledIds] = useState<Set<string>>(new Set());
  useEffect(() => { void loadGdtfLibrary().then((items) => setBundledIds(new Set(items.map((d) => d.id))), () => {}); }, []);
  const userFixtures = custom.list.filter((d) => !bundledIds.has(d.id) && !/\bdxj\b/i.test(`${d.id} ${d.brand} ${d.model}`));

  const handleGdtfFile = async (file: File) => {
    setGdtfMsg("Importing…");
    try {
      const def = await importGdtfFile(file);
      if (!def) { setGdtfMsg("Could not read a GDTF fixture from this file."); return; }
      addCustomFixture(def);
      setGdtfMsg(`Imported "${def.brand} ${def.model}" (${def.modes.length} mode${def.modes.length === 1 ? "" : "s"}).`);
    } catch {
      setGdtfMsg("Import failed — invalid .gdtf file.");
    }
  };

  const addRdmDevice = (dev: RdmDevice, rdmUniverse: number) => {
    const nameHit = (s: string) => s.toLowerCase().trim();
    let d = FIXTURE_LIBRARY.find((x) => nameHit(x.model) === nameHit(dev.model) || nameHit(`${x.brand} ${x.model}`) === nameHit(dev.model));
    if (!d) {
      const fp = Math.max(1, dev.footprint || 1);
      const entries = [{ attr: "Dimmer" as const }, ...Array.from({ length: Math.max(0, fp - 1) }, () => ({ attr: "Spare" as const }))];
      d = {
        id: `custom-rdm-${slug(`${dev.manufacturer} ${dev.model} ${dev.uid}`)}`,
        brand: dev.manufacturer || "RDM",
        model: dev.model || "RDM device",
        modes: [buildMode("DMX", entries)],
      };
      addCustomFixture(d);
    }
    const modeIdx = Math.max(0, d.modes.findIndex((mo) => mo.channels === dev.footprint));
    const nf = createFixture(d, modeIdx, rdmUniverse, Math.max(1, dev.address || 1), `${d.brand} ${d.model}`);
    onAdd([nf]);
  };

  return (
    <div className="rounded-lg bg-surface-elevated/50">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        More sources
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 p-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            <input ref={fileRef} type="file" accept=".gdtf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleGdtfFile(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded-md bg-surface px-2 py-1.5 text-[11px] font-semibold"><FileUp className="h-3.5 w-3.5" />Import GDTF</button>
            <button onClick={() => setBuilder(true)} className="flex items-center gap-1 rounded-md bg-surface px-2 py-1.5 text-[11px] font-semibold"><Wrench className="h-3.5 w-3.5" />Fixture builder</button>
            <button onClick={() => onPick(getDef("generic-dimmer"))} className="flex items-center gap-1 rounded-md bg-surface px-2 py-1.5 text-[11px] font-semibold"><Zap className="h-3.5 w-3.5" />Patch dimmer</button>
          </div>
          {gdtfMsg && <p className="text-[11px] text-muted-foreground">{gdtfMsg}</p>}
          <GdtfLibrarySearch onPick={onPick} />

          <RdmManager onAdd={(d, u) => addRdmDevice(d, u)} />

          {userFixtures.length > 0 && (
            <div className="space-y-1 rounded-md bg-surface p-2">
              <span className="text-[11px] font-semibold">Custom fixtures</span>
              {userFixtures.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded bg-surface-elevated px-2 py-1 text-[11px]">
                  <span className="min-w-0 flex-1 truncate">{d.brand} {d.model}</span>
                  <button
                    onClick={() => { if (window.confirm(`Delete custom fixture "${d.brand} ${d.model}"? This cannot be undone.`)) custom.remove(d.id); }}
                    className="shrink-0 rounded p-1 text-destructive"
                    aria-label={`Delete ${d.model}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {builder && <FixtureBuilder onClose={() => setBuilder(false)} onCreated={() => setBuilder(false)} />}
    </div>
  );
}

function Row({ title, sub, onClick, starred, onStar, footprint }: { title: string; sub: string; onClick: () => void; starred?: boolean; onStar?: () => void; footprint?: string[] | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-surface-elevated">
    <div className="flex w-full items-center">
      {onStar && <Button variant="ghost" size="icon" onClick={onStar} title={`Favourite ${title}`} aria-label={`Favourite ${title}`} aria-pressed={!!starred}><Star className={`h-4 w-4 ${starred ? "fill-amber-glow text-amber-glow" : "text-muted-foreground"}`} /></Button>}
      <Button variant="ghost" onClick={onClick} className="h-auto min-w-0 flex-1 justify-between px-3 py-2.5 text-left text-sm active:scale-[0.98]">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block whitespace-normal text-[11px] text-muted-foreground">{sub}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
      </Button>
      {footprint && <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="shrink-0 px-2 text-[11px] text-muted-foreground">DMX {open ? "▴" : "▾"}</Button>}
    </div>
    {open && footprint && (
      <ol className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-3 pb-2.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        {footprint.map((f, i) => <li key={i}><span className="text-foreground">{i + 1}</span> {f}</li>)}
      </ol>
    )}
    </div>
  );
}

function GdtfLibrarySearch({ onPick }: { onPick: (d: FixtureDef) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<LibraryDef[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const hits = useMemo(() => (list ? searchGdtfLibrary(list, q) : []), [list, q]);
  const open = () => { if (!list) loadGdtfLibrary().then(setList, () => setErr("Library could not be loaded.")); };
  return (
    <div className="space-y-1.5 rounded-md bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input value={q} onFocus={open} onChange={(e) => setQ(e.target.value)} placeholder={list ? `Search ${list.length} GDTF fixtures…` : "Search GDTF library…"} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" aria-label="Search GDTF library" />
      </div>
      {err && <p className="text-[11px] text-destructive">{err}</p>}
      {q && list && hits.length === 0 && <p className="text-[11px] text-muted-foreground">No match.</p>}
      {hits.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {hits.map((d) => (
            <button key={d.id} disabled={!!busy} onClick={async () => { setBusy(d.id); try { onPick(await installGdtfFixture(d)); setQ(""); } finally { setBusy(null); } }} className="flex w-full items-center gap-2 rounded bg-surface-elevated px-2 py-1 text-left text-[11px] disabled:opacity-50">
              {d.icon ? <img src={`/gdtf-library/icons/${d.icon}`} alt="" loading="lazy" className="h-6 w-6 shrink-0 object-contain" /> : <span className="h-6 w-6 shrink-0" />}
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{d.brand}</span> {d.model}</span>
              <span className="shrink-0 text-muted-foreground">{busy === d.id ? "…" : `${d.modes.length} modes`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
