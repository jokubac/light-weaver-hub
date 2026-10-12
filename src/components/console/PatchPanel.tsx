import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, AlertTriangle, Grid3x3, Star, Unplug, Pencil, FileUp, Wrench, Radar, Trash2, ChevronDown, Zap } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { DmxMap } from "./DmxMap";
import { NumberField } from "./NumberField";
import { FixtureIconPicker } from "./FixtureIconPicker";
import { FixtureGlyph } from "./FixtureGlyph";
import type { FixtureIcon } from "@/lib/fixture-icons";
import { planPatch } from "@/lib/patch-plan";
import { importGdtfFile, buildMode } from "@/lib/gdtf";
import { OFL_INDEX } from "@/lib/ofl-index";
import { loadOflFixture } from "@/lib/ofl";
import { addCustomFixture, useCustomFixtures } from "@/lib/custom-fixtures";
import { scanRdm, type RdmDevice } from "@/lib/rdm";
import { loadConnection } from "@/lib/store";
import { FixtureBuilder } from "./FixtureBuilder";
import {
  BRANDS,
  FIXTURE_LIBRARY, RENTAL_STOCK,
  createFixture,
  findFreeAddress,
  getDef,
  overlaps,
  type FixtureDef,
  type PatchedFixture,
} from "@/lib/dmx";

export const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#ffffff", "#78716c"];

const modeKey = (defId: string, i: number) => `${defId}:${i}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Official manufacturer profile number ("Profile 42 — …"), so modes list in the fixture's own numbering; unnumbered modes go last. */
const profileNo = (name: string) => { const r = /^Profile (\d+)/.exec(name); return r ? +r[1]! : 10000; };

export function PatchPanel({ fixtures, onAdd, onRemove, onUpdate, defaultMap = true, showPatched = true }: {
  defaultMap?: boolean; showPatched?: boolean; fixtures: PatchedFixture[]; onAdd: (fs: PatchedFixture[]) => void; onRemove: (uids: string[]) => void; onUpdate: (uid: string, p: Partial<PatchedFixture>) => void;
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
  const fav = useFavorites("fixtures");
  const favModes = useFavorites("modes");
  const star = (id: string) => ({ starred: fav.has(id), onStar: () => fav.toggle(id) });
  const universes = Array.from(new Set([1, ...fixtures.map((f) => f.universe)])).sort((a, b) => a - b);

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(
    () => (q ? FIXTURE_LIBRARY.filter((d) => `${d.brand} ${d.model}${d.modes.some((x) => x.pixels) ? " pixel" : ""} ${(RENTAL_STOCK[d.id] ?? []).join(" ")}`.toLowerCase().includes(q)).slice(0, 120) : []),
    [q],
  );
  const oflHits = useMemo(() => {
    if (!q) return [];
    const have = new Set(FIXTURE_LIBRARY.map((d) => `${d.brand} ${d.model}`.toLowerCase()));
    return OFL_INDEX.filter(([, b, m]) => `${b} ${m}`.toLowerCase().includes(q) && !have.has(`${b} ${m}`.toLowerCase())).slice(0, 80);
  }, [q]);
  const [oflBusy, setOflBusy] = useState(false);
  const [oflError, setOflError] = useState<string | null>(null);
  const pickOfl = async (key: string, b: string) => {
    setOflBusy(true); setOflError(null);
    try { const d = await loadOflFixture(key, b); addCustomFixture(d); setBrand(d.brand); setDef(d); setQuery(""); }
    catch (e) { setOflError(e instanceof Error ? e.message : "Download failed — check your internet connection."); }
    finally { setOflBusy(false); }
  };
  const favPairs = favModes.list.map((k) => {
    const [id, i] = [k.slice(0, k.lastIndexOf(":")), +k.slice(k.lastIndexOf(":") + 1)];
    const d = FIXTURE_LIBRARY.find((x) => x.id === id);
    return d && d.modes[i] ? { d, i, k } : null;
  }).filter((x): x is { d: FixtureDef; i: number; k: string } => !!x);

  const reset = () => { setBrand(null); setDef(null); setModeIdx(null); setModeQuery(""); };
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
            <NumberField integer min={1} max={128} value={mapU} onChange={(v) => v && setMapU(v)} className="w-14 rounded border border-input bg-surface px-1 text-[11px]" aria-label="Universe" />
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brand, model" className="w-full rounded-lg border border-input bg-surface-elevated py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
      )}

      {!def && <MoreSources fixtures={fixtures} onAdd={onAdd} onPick={(d) => { setBrand(d.brand); setDef(d); setModeIdx(0); }} />}
      {!def && q ? (
        <List>
          {searchHits.length === 0 && oflHits.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No fixtures found</p>}
          {searchHits.length > 0 && <p className="text-[10px] text-muted-foreground">{searchHits.length} results · {FIXTURE_LIBRARY.length + OFL_INDEX.length} fixtures in library</p>}
          {searchHits.map((d) => (
            <Row key={d.id} {...star(d.id)} onClick={() => { setBrand(d.brand); setDef(d); setQuery(""); }} title={d.model} sub={`${d.brand} · ${d.modes.length} modes${d.modes.some((x) => x.pixels) ? " · pixel" : ""}`} />
          ))}
          {oflHits.length > 0 && <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open Fixture Library{oflBusy ? " · loading…" : ""}</p>}
          {oflError && <p className="text-[11px] text-destructive">{oflError}</p>}
          {oflHits.map(([key, b, model, n]) => (
            <Row key={key} onClick={() => void pickOfl(key, b)} title={model} sub={`${b} · ${n} modes · downloads profile`} />
          ))}
        </List>
      ) : !brand ? (
        <List>
          {favPairs.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-glow">★ Favourite fixture + mode</p>}
          {favPairs.map(({ d, i, k }) => (
            <Row key={`fm-${k}`} starred onStar={() => favModes.toggle(k)} onClick={() => { setBrand(d.brand); setDef(d); setModeIdx(i); }} title={`${d.brand} ${d.model}`} sub={`${d.modes[i]!.name} · ${d.modes[i]!.channels} ch`} />
          ))}
          {fav.list.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-glow">★ Favourite fixtures</p>}
          {FIXTURE_LIBRARY.filter((d) => fav.has(d.id)).map((d) => (
            <Row key={`fav-${d.id}`} {...star(d.id)} onClick={() => { setBrand(d.brand); setDef(d); }} title={`${d.brand} ${d.model}`} sub={`${d.modes.length} modes`} />
          ))}
          {(fav.list.length > 0 || favPairs.length > 0) && <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manufacturers</p>}
          {BRANDS.map((b) => (
            <Row key={b} onClick={() => setBrand(b)} title={b} sub={`${FIXTURE_LIBRARY.filter((d) => d.brand === b).length} models`} />
          ))}
        </List>
      ) : !def ? (
        <List>
          {FIXTURE_LIBRARY.filter((d) => d.brand === brand).map((d) => (
            <Row key={d.id} {...star(d.id)} onClick={() => setDef(d)} title={d.model} sub={`${d.modes.length} modes${d.modes.some((x) => x.pixels) ? " · pixel" : ""}`} />
          ))}
        </List>
      ) : modeIdx === null ? (
        <List>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={modeQuery} onChange={(e) => setModeQuery(e.target.value)} placeholder="Search mode" className="w-full rounded-lg border border-input bg-surface-elevated py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          {def.modes.map((mo, i) => ({ mo, i, n: profileNo(mo.name) })).sort((a, b) => a.n - b.n || a.i - b.i).filter(({ mo }) => !mq || `${mo.name} ${mo.channels}ch ${mo.kind} ${mo.pixels ? "pixel" : ""}`.toLowerCase().includes(mq)).map(({ mo, i }) => (
            <Row key={mo.name} starred={favModes.has(modeKey(def.id, i))} onStar={() => favModes.toggle(modeKey(def.id, i))} onClick={() => setModeIdx(i)} title={mo.name} sub={`${mo.channels} ch · ${mo.kind.toUpperCase()}${mo.pixels ? ` · ${mo.pixels} px` : ""}`} />
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
                    <button onClick={() => setUnpick((u) => (on ? u.filter((x) => x !== f.uid) : [...u, f.uid]))} aria-label={`Pick ${f.name}`}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? "border-destructive bg-destructive text-destructive-foreground" : "border-input"}`}>{on ? "✓" : ""}</button>
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
                          {d.modes.map((m, i) => <option key={m.name} value={i}>{m.name} · {m.channels} ch</option>)}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Universe"><NumberField integer min={1} max={128} value={f.universe} onChange={(v) => v && onUpdate(f.uid, { universe: v })} className={inputCls} /></Field>
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
        <Field label="Universe"><NumberField integer min={1} max={128} value={universe} onChange={(v) => v && changeUniverse(v)} className={inputCls} /></Field>
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

const inputCls = "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

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
  const [rdmUniverse, setRdmUniverse] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [rdmDevices, setRdmDevices] = useState<RdmDevice[] | null>(null);
  const [rdmError, setRdmError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const custom = useCustomFixtures();

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

  const runScan = async () => {
    const conn = loadConnection();
    if (!conn.node?.ip) { setRdmError("Connect to a node first (see CONNECT)."); setRdmDevices(null); return; }
    setScanning(true); setRdmError(null); setRdmDevices(null);
    try {
      const devs = await scanRdm(conn.bridge, conn.node.ip, rdmUniverse);
      setRdmDevices(devs);
      if (devs.length === 0) setRdmError("No RDM devices found.");
    } catch (e) {
      setRdmError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const addRdmDevice = (dev: RdmDevice) => {
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

          <div className="space-y-1.5 rounded-md bg-surface p-2">
            <div className="flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold">RDM scan</span>
              <NumberField integer min={1} max={128} value={rdmUniverse} onChange={(v) => v && setRdmUniverse(v)} className="ml-auto w-14 rounded border border-input bg-surface-elevated px-1 text-[11px]" aria-label="Universe" />
              <button onClick={() => void runScan()} disabled={scanning} className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40">{scanning ? "Scanning…" : "Scan"}</button>
            </div>
            {rdmError && <p className="text-[11px] text-destructive">{rdmError}</p>}
            {rdmDevices && rdmDevices.length > 0 && (
              <div className="space-y-1">
                {rdmDevices.map((d) => (
                  <div key={d.uid} className="flex items-center gap-2 rounded bg-surface-elevated px-2 py-1 text-[11px]">
                    <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{d.manufacturer} {d.model}</span> · U{rdmUniverse}.{d.address} · {d.footprint}ch</span>
                    <button onClick={() => addRdmDevice(d)} className="shrink-0 rounded bg-primary px-2 py-1 font-semibold text-primary-foreground">Add</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {custom.list.length > 0 && (
            <div className="space-y-1 rounded-md bg-surface p-2">
              <span className="text-[11px] font-semibold">Custom fixtures</span>
              {custom.list.map((d) => (
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

function Row({ title, sub, onClick, starred, onStar }: { title: string; sub: string; onClick: () => void; starred?: boolean; onStar?: () => void }) {
  return (
    <div className="flex w-full items-center rounded-lg bg-surface-elevated">
      {onStar && <button onClick={onStar} className="py-2.5 pl-3" aria-label="Favourite"><Star className={`h-4 w-4 ${starred ? "fill-amber-glow text-amber-glow" : "text-muted-foreground"}`} /></button>}
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-left text-sm active:scale-[0.98]">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block text-[11px] text-muted-foreground">{sub}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
      </button>
    </div>
  );
}
