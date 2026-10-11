import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, AlertTriangle, Grid3x3 } from "lucide-react";
import { DmxMap } from "./DmxMap";
import {
  BRANDS,
  FIXTURE_LIBRARY,
  createFixture,
  findFreeAddress,
  overlaps,
  type FixtureDef,
  type PatchedFixture,
} from "@/lib/dmx";

export function PatchPanel({ fixtures, onAdd }: { fixtures: PatchedFixture[]; onAdd: (fs: PatchedFixture[]) => void }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [def, setDef] = useState<FixtureDef | null>(null);
  const [modeIdx, setModeIdx] = useState<number | null>(null);
  const [mapU, setMapU] = useState(1);
  const [showMap, setShowMap] = useState(true);
  const universes = Array.from(new Set([1, ...fixtures.map((f) => f.universe)])).sort((a, b) => a - b);

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(
    () => (q ? FIXTURE_LIBRARY.filter((d) => `${d.brand} ${d.model}${d.modes.some((x) => x.pixels) ? " pixel" : ""}`.toLowerCase().includes(q)).slice(0, 60) : []),
    [q],
  );

  const reset = () => { setBrand(null); setDef(null); setModeIdx(null); };
  const back = () => (modeIdx !== null ? setModeIdx(null) : def ? setDef(null) : setBrand(null));

  const crumbs = [brand, def?.model, modeIdx !== null ? def?.modes[modeIdx]?.name : null].filter(Boolean);

  return (
    <div className="space-y-3">
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
            <input type="number" min={1} max={64} value={mapU} onChange={(e) => setMapU(Math.max(1, Math.min(64, +e.target.value || 1)))} className="w-14 rounded border border-input bg-surface px-1 text-[11px]" aria-label="Universe" />
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search brand or model…" className="w-full rounded-lg border border-input bg-surface-elevated py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
      )}

      {!def && q ? (
        <List>
          {searchHits.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No fixtures found</p>}
          {searchHits.length > 0 && <p className="text-[10px] text-muted-foreground">{searchHits.length} results · {FIXTURE_LIBRARY.length} fixtures in library</p>}
          {searchHits.map((d) => (
            <Row key={d.id} onClick={() => { setBrand(d.brand); setDef(d); setQuery(""); }} title={d.model} sub={`${d.brand} · ${d.modes.length} modes${d.modes.some((x) => x.pixels) ? " · pixel" : ""}`} />
          ))}
        </List>
      ) : !brand ? (
        <List>
          {BRANDS.map((b) => (
            <Row key={b} onClick={() => setBrand(b)} title={b} sub={`${FIXTURE_LIBRARY.filter((d) => d.brand === b).length} models`} />
          ))}
        </List>
      ) : !def ? (
        <List>
          {FIXTURE_LIBRARY.filter((d) => d.brand === brand).map((d) => (
            <Row key={d.id} onClick={() => setDef(d)} title={d.model} sub={`${d.modes.length} modes${d.modes.some((x) => x.pixels) ? " · pixel" : ""}`} />
          ))}
        </List>
      ) : modeIdx === null ? (
        <List>
          {def.modes.map((mo, i) => (
            <Row key={mo.name} onClick={() => setModeIdx(i)} title={mo.name} sub={`${mo.channels} ch · ${mo.kind.toUpperCase()}${mo.pixels ? ` · ${mo.pixels} px` : ""}`} />
          ))}
        </List>
      ) : (
        <PatchConfig fixtures={fixtures} def={def} modeIdx={modeIdx} onAdd={(fs) => { onAdd(fs); setModeIdx(null); }} />
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

  const changeUniverse = (u: number) => {
    const uu = Math.max(1, Math.min(64, u || 1));
    setUniverse(uu);
    setAddress(findFreeAddress(fixtures, uu, ch) ?? 1);
  };

  const existing = fixtures.filter((f) => f.defId === def.id).length;
  const planned = Array.from({ length: qty }, (_, i) => address + i * (ch + offset));
  const temp: PatchedFixture[] = [];
  let problem: string | null = null;
  for (const [i, a] of planned.entries()) {
    if (a + ch - 1 > 512) { problem = `Fixture ${i + 1} would run past channel 512.`; break; }
    const hit = overlaps(fixtures, universe, a, ch);
    if (hit.length) { problem = `Address ${a} overlaps "${hit[0]!.name}" (U${universe}.${hit[0]!.address}).`; break; }
    temp.push(createFixture(def, modeIdx, universe, a, qty === 1 && existing === 0 ? baseName : `${baseName} ${existing + i + 1}`));
  }

  const used = fixtures.filter((f) => f.universe === universe).length;

  return (
    <div className="space-y-3 rounded-lg bg-surface-elevated p-3">
      <Field label="Name"><input value={baseName} onChange={(e) => setBaseName(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Universe"><input type="number" min={1} max={64} value={universe} onChange={(e) => changeUniverse(+e.target.value)} className={inputCls} /></Field>
        <Field label="Start address"><input type="number" min={1} max={512} value={address} onChange={(e) => setAddress(Math.max(1, Math.min(512, +e.target.value || 1)))} className={inputCls} /></Field>
        <Field label="Quantity"><input type="number" min={1} max={64} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(64, +e.target.value || 1)))} className={inputCls} /></Field>
        <Field label="Offset (gap ch)"><input type="number" min={0} max={100} value={offset} onChange={(e) => setOffset(Math.max(0, +e.target.value || 0))} className={inputCls} /></Field>
      </div>
      <DmxMap fixtures={fixtures} universe={universe} planned={planned.map((a) => ({ address: a, channels: ch }))} />
      <p className="text-[11px] text-muted-foreground">
        {ch} ch each · addresses {planned.slice(0, 6).join(", ")}{planned.length > 6 ? "…" : ""} · {used} fixtures already in U{universe}
      </p>
      {problem && (
        <p className="flex items-start gap-2 text-xs text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{problem}</p>
      )}
      <div className="flex gap-2">
        <button onClick={() => setAddress(findFreeAddress(fixtures, universe, ch) ?? 1)} className="flex-1 rounded-md bg-surface py-2.5 text-xs font-semibold">Next free</button>
        <button disabled={!!problem} onClick={() => onAdd(temp)} className="flex-[2] rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
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

function Row({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2.5 text-left text-sm active:scale-[0.98]">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
    </button>
  );
}
