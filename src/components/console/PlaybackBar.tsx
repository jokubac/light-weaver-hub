import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ListOrdered, Plus, Settings2, Trash2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberField } from "@/components/console/NumberField";
import type { PatchedFixture } from "@/lib/dmx";
import type { BankFader, Cue, FaderSnap, Look } from "@/lib/store";
import { BANK_SIZE, BANK_PAGES, BANK_TOTAL, FADER_PAGE_SIZES, perPageOf, bankPages, sortCues, faderMembers, snapBank, releaseBank, moveLinked } from "@/lib/playback";
import { fmtTc, parseTc } from "@/lib/show-control";
import { TimecodeSettings, type TcConfig } from "@/components/console/TimecodeSettings";

import { t as tr } from "@/lib/i18n";
export interface PlaybackProps {
  fixtures: PatchedFixture[]; selected: string[]; groups: string[]; looks: Look[];
  bank: BankFader[]; setBank: (b: BankFader[]) => void;
  flash: string | null; setFlash: (id: string | null) => void;
  solo: string | null; setSolo: (id: string | null) => void;
  cues: Cue[]; setCues: (c: Cue[]) => void;
  activeCue: string | null; fadeK: number | null;
  onGo: () => void; onBack: () => void; onGoto: (id: string) => void;
  onRecordCue: (name: string, after?: number) => void; onUpdateCueStates: (id: string) => void;
  progCount?: number; onProgClear?: () => void; onProgUpdate?: () => void;
  tcOn?: boolean; onTc?: () => void; tcNow?: number | null;
  tcCfg?: TcConfig; setTcCfg?: (c: TcConfig) => void; tcStart?: number | undefined; setTcStart?: (v: number | undefined) => void;
  /** full-page FADERS window: tall faders filling the screen */
  full?: boolean;
  /** live output (after bank/park) for the light dots */
  output?: PatchedFixture[];
  master?: number; onMaster?: (v: number) => void;
  snaps?: FaderSnap[]; setSnaps?: (s: FaderSnap[]) => void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

type Btn = NonNullable<BankFader["buttons"]>[number];
type Param = NonNullable<BankFader["param"]>;
const TOTAL = BANK_TOTAL;
/** grid columns for the full window at each faders-per-page */
const GRID: Record<number, string> = { 4: "grid-cols-2 lg:grid-cols-4", 8: "grid-cols-4 lg:grid-cols-8", 16: "grid-cols-4 lg:grid-cols-8", 24: "grid-cols-6 lg:grid-cols-8", 32: "grid-cols-4 lg:grid-cols-8" };
/** smallest fader height at each faders-per-page */
const MIN_H: Record<number, string> = { 4: "min-h-[320px]", 8: "min-h-[300px]", 16: "min-h-[200px]", 24: "min-h-[150px]", 32: "min-h-[128px]" };

const PARAMS: [Param, string][] = [["intensity", "Intensity"], ["cct", "CCT"], ["hue", "Hue"], ["saturation", "Saturation"], ["fxSpeed", "Effect speed"], ["fxSize", "Effect depth"]];
const BTNS: [Btn, string][] = [["flash", "FLASH"], ["solo", "SOLO"], ["onoff", "ON/OFF"], ["full", "FULL"], ["zero", "ZERO"]];
const COLORS: NonNullable<BankFader["color"]>[] = ["primary", "success", "warning", "destructive", "accent", "muted"];
const swatch: Record<NonNullable<BankFader["color"]>, string> = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", accent: "bg-accent", muted: "bg-muted-foreground" };
const ring: Record<NonNullable<BankFader["color"]>, string> = { primary: "border-primary", success: "border-success", warning: "border-warning", destructive: "border-destructive", accent: "border-accent", muted: "border-muted-foreground" };
const defaultBtns = (fd: BankFader): Btn[] => fd.buttons ?? (fd.kind === "master" ? ["full", "zero"] : ["flash", "solo"]);
const paramLabel = (fd: BankFader) => fd.kind === "master" ? tr("Master") : fd.kind === "look" ? tr("Look") : tr(PARAMS.find(([k]) => k === (fd.param ?? "intensity"))![1]);
const readout = (fd: BankFader, v: number) => fd.param === "hue" ? `${Math.round(v * 360)}°` : `${Math.round(v * 100)}`;

export function PlaybackBar(p: PlaybackProps) {
  const [edit, setEdit] = useState<number | null>(null);
  const [cuesOpen, setCuesOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [perPageFull, setPerPageFull] = useState<number>(() => (typeof window !== "undefined" ? perPageOf(Number(localStorage.getItem("nox-fader-per-page"))) : 8));
  const perPage = p.full ? perPageFull : BANK_SIZE;
  const dense = p.full && perPage >= 24;
  const allPages = bankPages(perPage);

  const pages = p.full ? (allPages <= 8 ? allPages : Math.min(allPages, Math.ceil(Math.max(p.bank.length, 1) / perPage) + 1)) : BANK_PAGES;

  const pg = Math.min(page, pages - 1);
  const base = pg * perPage;
  const sorted = sortCues(p.cues);
  const idx = sorted.findIndex((c) => c.id === p.activeCue);
  const cur = sorted[idx];
  const next = sorted[idx + 1];
  const slots = Array.from({ length: perPage }, (_, i) => p.bank[base + i]);
  const out = p.output ?? p.fixtures;
  const lastId = p.bank.reduce<BankFader | null>((m, x) => (x?.touched && (!m || (x.touched ?? 0) > (m.touched ?? 0)) ? x : m), null)?.id;

  const setSlot = (i: number, fd: BankFader | null) => {
    const arr = Array.from({ length: TOTAL }, (_, k) => p.bank[k]);
    arr[i] = fd ?? undefined;
    let last = arr.length - 1; while (last >= 0 && !arr[last]) last--;
    p.setBank(arr.slice(0, last + 1).map((x, k) => x ?? { id: `empty-${k}`, name: "", kind: "fixtures", uids: [], level: 1 }));
  };
  const patchFd = (i: number, patch: Partial<BankFader>) => { const fd = p.bank[i]; if (fd) p.setBank(p.bank.map((x, k) => (k === i ? { ...x, ...patch } : x))); };
  const [linkMode, setLinkMode] = useState(false);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [snapFade, setSnapFade] = useState(2);
  const [fading, setFading] = useState<string | null>(null);
  const pRef = useRef(p); pRef.current = p;
  const raf = useRef<number | null>(null);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  const setLevel = (i: number, level: number) => {
    const fd = p.bank[i]; if (!fd) return;
    if (fd.kind === "master") p.onMaster?.(level);
    p.setBank(moveLinked(p.bank, i, level, linked));
  };
  const saveSnap = () => {
    const levels: Record<string, number> = {};
    p.bank.forEach((fd) => { if (fd?.name && fd.kind !== "master") levels[fd.id] = fd.level; });
    const list = p.snaps ?? [];
    p.setSnaps?.([...list, { id: newId(), name: `Snap ${list.length + 1}`, levels }]);
  };
  const recallSnap = (snap: FaderSnap) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const from: Record<string, number> = {}; p.bank.forEach((fd) => { if (fd) from[fd.id] = fd.level; });
    const t0 = performance.now(); const dur = snapFade * 1000;
    setFading(snap.id);
    const step = () => {
      const k = dur <= 0 ? 1 : (performance.now() - t0) / dur;
      pRef.current.setBank(snapBank(pRef.current.bank, snap, from, k));
      if (k < 1) raf.current = requestAnimationFrame(step); else { raf.current = null; setFading(null); }
    };
    step();
  };
  const levelOf = (fd: BankFader) => (fd.kind === "master" && p.master != null ? p.master : p.flash === fd.id ? 1 : fd.level);
  const setPer = (n: number) => { setPerPageFull(n); setPage(0); localStorage.setItem("nox-fader-per-page", String(n)); };

  const button = (i: number, fd: BankFader, b: Btn) => {
    const cls = (on: boolean, onCls = "bg-primary text-primary-foreground") => `flex-1 rounded font-bold select-none ${p.full ? (dense ? "py-1 text-[10px]" : "py-1.5 text-xs") : "px-1 py-0.5 text-[9px]"} ${on ? onCls : "bg-background"}`;
    const label = tr(BTNS.find(([k]) => k === b)![1]);
    if (b === "flash") return <button key={b} onPointerDown={() => p.setFlash(fd.id)} onPointerUp={() => p.setFlash(null)} onPointerLeave={() => p.flash === fd.id && p.setFlash(null)} onContextMenu={(e) => e.preventDefault()} className={cls(p.flash === fd.id, "bg-amber-glow text-primary-foreground")}>{label}</button>;
    if (b === "solo") return <button key={b} onClick={() => p.setSolo(p.solo === fd.id ? null : fd.id)} aria-pressed={p.solo === fd.id} className={cls(p.solo === fd.id)}>{label}</button>;
    if (b === "onoff") return <button key={b} onClick={() => patchFd(i, { off: !fd.off, touched: Date.now() })} aria-pressed={!fd.off} className={cls(!fd.off, "bg-success text-primary-foreground")}>{fd.off ? tr("OFF") : tr("ON")}</button>;
    return <button key={b} onClick={() => setLevel(i, b === "full" ? 1 : 0)} className={cls(false)}>{label}</button>;
  };

  return (
    <div aria-label={tr("Faders")} className={p.full ? "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-4" : "flex shrink-0 items-stretch gap-2 overflow-x-auto border-t border-border bg-surface px-3 py-2"}>
      <div className={p.full ? "flex shrink-0 flex-wrap items-stretch gap-2 rounded-xl bg-surface p-2" : "contents"}>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="secondary" size="icon" aria-label={tr("Back one cue")} title={tr("Back (B)")} onClick={p.onBack} disabled={!sorted.length}><ChevronLeft /></Button>
        <button onClick={p.onGo} disabled={!sorted.length} aria-label={tr("GO")} title={tr("GO (Space)")}
          className="relative flex h-12 w-20 flex-col items-center justify-center overflow-hidden rounded-lg bg-success text-lg font-black leading-none tracking-wider text-primary-foreground shadow-md active:scale-95 disabled:opacity-40">{tr("GO")}{p.fadeK != null && p.fadeK < 1 && cur
            ? <span className="mt-0.5 font-mono text-[10px] font-bold tracking-normal">{(cur.fade * (1 - p.fadeK)).toFixed(1)}{tr("s")}</span>
            : next && <span className="mt-0.5 font-mono text-[10px] font-semibold tracking-normal opacity-80">{next.fade}{tr("s")}</span>}
          {p.fadeK != null && p.fadeK < 1 && <span className="absolute bottom-0 left-0 h-1 bg-background/60" style={{ width: `${p.fadeK * 100}%` }} />}
        </button>
        <button onClick={() => setCuesOpen(true)} className="w-28 rounded-lg bg-surface-elevated px-2 py-1 text-left text-[10px] leading-tight" title={tr("Open cue list")}>
          <div className="truncate font-semibold">{cur ? `Q${cur.number} ${cur.name}` : sorted.length ? tr("Ready") : tr("No cues")}</div>
          <div className="truncate text-muted-foreground">{next ? `Next: Q${next.number} ${next.name}` : sorted.length ? tr("End of list") : tr("Tap to add cues")}</div>
        </button>
        <Button variant="ghost" size="icon" aria-label={tr("Cue list")} onClick={() => setCuesOpen(true)}><ListOrdered /></Button>
        <div className="flex flex-col gap-1">
          <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${p.progCount ? "bg-warning/25 text-warning" : "bg-surface-elevated text-muted-foreground"}`}
            title={cur ? "PROGRAMMER — lights changed since this cue was stored" : "Go to a cue to compare live vs stored"}>{tr("PROG")}{p.progCount ?? 0}
            {!!p.progCount && <>
              <button onClick={p.onProgUpdate} className="rounded bg-background/40 px-1" title={`Store the changes into Q${cur?.number}`}>{tr("Update")}</button>
              <button onClick={p.onProgClear} className="rounded bg-background/40 px-1" title={tr("Throw away changes, back to the stored cue")}>{tr("Clear")}</button>
            </>}
          </div>
          {p.tcCfg && p.setTcCfg && p.setTcStart
            ? <TimecodeSettings on={!!p.tcOn} onToggle={() => p.onTc?.()} now={p.tcNow} cfg={p.tcCfg} setCfg={p.setTcCfg} tcStart={p.tcStart} setTcStart={p.setTcStart} />
            : <button onClick={p.onTc} aria-pressed={!!p.tcOn} className={`rounded-md px-1.5 py-0.5 text-left font-mono text-[10px] font-bold ${p.tcOn ? "bg-primary/25 text-primary" : "bg-surface-elevated text-muted-foreground"}`}>{tr("TC")}{p.tcOn ? (p.tcNow != null ? fmtTc(p.tcNow) : tr("waiting…")) : tr("off")}</button>}
        </div>
      </div>
      <div className="w-px shrink-0 bg-border" />
      <div aria-label={tr("Fader banks")} className={`grid shrink-0 content-start gap-1 overflow-y-auto ${pages > 8 ? "max-h-16 grid-cols-4" : pages > 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {Array.from({ length: pages }, (_, b) => {
          const used = p.bank.slice(b * perPage, (b + 1) * perPage).some((x) => x && x.name);
          return (
            <button key={b} onClick={() => setPage(b)} aria-pressed={pg === b} title={`Bank ${b + 1}: faders ${b * perPage + 1}–${(b + 1) * perPage}`}
              className={`w-9 rounded-md text-[10px] font-bold ${pg === b ? "bg-primary text-primary-foreground" : used ? "bg-primary/25" : "bg-surface-elevated text-muted-foreground"}`}>{tr("B")}{b + 1}</button>
          );
        })}
      </div>
      {p.full && <>
        <div className="w-px shrink-0 bg-border" />
        <div className="flex items-center gap-1 text-[10px] font-bold" aria-label={tr("Faders per page")}>
          <span className="mr-1 text-muted-foreground">{tr("Per page")}</span>
          {FADER_PAGE_SIZES.map((n) => <button key={n} onClick={() => setPer(n)} aria-pressed={perPage === n} className={`rounded-md px-2 py-1.5 ${perPage === n ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"}`}>{n}</button>)}
        </div>
        <div className="w-px shrink-0 bg-border" />
        <button onClick={() => { setLinkMode((v) => !v); }} aria-pressed={linkMode} title={tr("Tap fader names to link them; linked faders move together")}
          className={`rounded-md px-2.5 text-[10px] font-bold ${linkMode ? "bg-primary text-primary-foreground" : "bg-surface-elevated text-muted-foreground"}`}>{tr("LINK")}{linked.size ? ` ${linked.size}` : ""}</button>
        {linked.size > 0 && <button onClick={() => setLinked(new Set())} className="rounded-md bg-surface-elevated px-2 text-[10px] font-bold text-muted-foreground">{tr("Unlink")}</button>}
        <button onClick={() => { p.setBank(releaseBank(p.bank)); p.setFlash(null); p.setSolo(null); }} title={tr("Intensity faders back to full, colour and look faders released")}
          className="rounded-md bg-surface-elevated px-2.5 text-[10px] font-bold text-destructive">{tr("RELEASE ALL")}</button>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">{tr("Last moved wins")}</div>
      </>}
      </div>
      {p.full && (
        <div aria-label={tr("Fader snapshots")} className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-bold uppercase tracking-wide text-muted-foreground">{tr("Snapshots")}</span>
          {(p.snaps ?? []).map((sn) => (
            <span key={sn.id} className={`flex items-center overflow-hidden rounded-md ${fading === sn.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>
              <button onClick={() => recallSnap(sn)} className="px-2.5 py-1.5 font-bold" title={tr("Fade all faders to these positions")}>{sn.name}</button>
              <button onClick={() => p.setSnaps?.((p.snaps ?? []).filter((x) => x.id !== sn.id))} aria-label={`Delete ${sn.name}`} className="px-1.5 py-1.5 opacity-60 hover:opacity-100">×</button>
            </span>
          ))}
          <button onClick={saveSnap} className="flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1.5 font-bold text-muted-foreground"><Plus className="h-3 w-3" />{tr("Save positions")}</button>
          <label className="ml-2 flex items-center gap-1 text-muted-foreground">{tr("Fade")}
            <input type="number" min={0} max={30} step={0.5} value={snapFade} onChange={(e) => setSnapFade(Math.max(0, +e.target.value || 0))} className="w-14 rounded-md border border-input bg-surface-elevated px-1.5 py-1 text-foreground" />{tr("s")}
          </label>
        </div>
      )}
      <div className={p.full ? `grid min-h-0 flex-1 overflow-auto ${dense ? "gap-2" : "gap-3"} ${GRID[perPage] ?? "grid-cols-3 lg:grid-cols-6"}` : "contents"}>
      {slots.map((fd, j) => {
        const i = base + j;
        const empty = !fd || (!fd.name && fd.kind === "fixtures" && !fd.uids?.length);
        const members = fd && !empty ? p.fixtures.filter((f) => faderMembers(fd, p.fixtures, p.looks).has(f.uid)) : [];
        const lv = fd ? levelOf(fd) : 0;
        const live = !empty && fd!.id === lastId;
        const color = fd?.color ?? "primary";
        return (
          <div key={i} className={`relative flex flex-col overflow-hidden border-2 ${live ? ring[color] : "border-transparent"} bg-surface-elevated ${p.full ? `${MIN_H[perPage] ?? "min-h-[170px]"} ${dense ? "gap-1.5 rounded-lg p-1.5" : "gap-2 rounded-xl p-2.5"}` : "w-32 shrink-0 gap-1 rounded-lg px-2 py-1"} ${fd?.off ? "opacity-60" : ""}`}>
            {!empty && <span className={`absolute inset-x-0 top-0 h-1 ${swatch[color]}`} />}
            <div className={`flex items-center gap-1 ${p.full ? (dense ? "text-xs" : "text-sm") : "text-[10px]"}`}>
              <span className="font-mono text-muted-foreground">{i + 1}</span>
              {dense && live && <span className="shrink-0 rounded bg-primary px-1 text-[8px] font-black text-primary-foreground">{tr("LIVE")}</span>}

              {linkMode && !empty && fd!.kind !== "master" ? (
                <button onClick={() => setLinked((x) => { const n = new Set(x); if (n.has(fd!.id)) n.delete(fd!.id); else n.add(fd!.id); return n; })} aria-pressed={linked.has(fd!.id)}
                  className={`min-w-0 flex-1 truncate rounded px-1 text-left font-semibold ${linked.has(fd!.id) ? "bg-primary text-primary-foreground" : "bg-background"}`}>{fd!.name}</button>
              ) : <span className="min-w-0 flex-1 truncate font-semibold">{empty ? tr("Empty") : fd!.name}{!empty && linked.has(fd!.id) && <span className="ml-1 text-[9px] text-primary">🔗</span>}</span>}
              {dense && !empty && <span className="shrink-0 font-mono font-bold">{readout(fd!, lv)}</span>}
              <button onClick={() => setEdit(i)} aria-label={`Set up fader ${i + 1}`}><Settings2 className="h-3.5 w-3.5" /></button>

            </div>
            {empty ? (
              <button onClick={() => setEdit(i)} className={`rounded-md border border-dashed border-border text-muted-foreground ${p.full ? "flex-1 text-sm" : "py-1 text-[10px]"}`}>{tr("Assign")}</button>
            ) : (
              <>
                {p.full && !dense && <div className="flex items-center justify-between text-[10px]">
                  <span className="rounded bg-background px-1.5 py-0.5 font-bold uppercase tracking-wide text-muted-foreground">{paramLabel(fd!)}</span>
                  {live && <span className="font-bold text-primary">{tr("LIVE")}</span>}
                </div>}
                {p.full ? (
                  <div className="flex min-h-0 flex-1 items-stretch justify-center gap-2">
                    <VFader label={`Fader ${i + 1} ${fd!.name}`} value={lv} onChange={(v) => setLevel(i, v)} fill={swatch[color]} dense={!!dense} />
                    <div aria-hidden className="relative w-2 overflow-hidden rounded-full bg-background">
                      <div className={`absolute inset-x-0 bottom-0 ${swatch[color]} transition-[height] duration-75`} style={{ height: `${(fd!.off ? 0 : lv) * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <input aria-label={`Fader ${i + 1} ${fd!.name}`} type="range" min={0} max={1} step={0.01} value={lv} onChange={(e) => setLevel(i, +e.target.value)} />
                )}
                {p.full && !dense && <div className="text-center font-mono text-lg font-bold leading-none">{readout(fd!, lv)}</div>}
                {p.full && !dense && fd!.kind !== "master" && (

                  <div title={members.map((m) => m.name).join(", ")} className="space-y-1">
                    <div className="flex flex-wrap gap-0.5">
                      {members.slice(0, 16).map((m) => { const o = out.find((x) => x.uid === m.uid); const v = o && o.on !== false ? o.intensity : 0; return <span key={m.uid} className="h-2 w-2 rounded-full bg-primary" style={{ opacity: 0.15 + v * 0.85 }} />; })}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{members.length} {tr("lights")}{members.length ? ` · ${members.slice(0, 3).map((m) => m.name).join(", ")}` : ""}</div>
                  </div>
                )}
                <div className="flex gap-1">
                  {defaultBtns(fd!).slice(0, 2).map((b) => button(i, fd!, b))}
                  {!p.full && <span className="w-7 text-right font-mono text-[9px] leading-5">{readout(fd!, lv)}</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
      </div>
      {edit != null && <FaderSetup i={edit} fd={p.bank[edit]} {...p} onClose={() => setEdit(null)} onSave={(fd) => { setSlot(edit, fd); setEdit(null); }} />}
      <CueDialog open={cuesOpen} onOpenChange={setCuesOpen} {...p} />
    </div>
  );
}

/** Tall touch fader: drag anywhere on the track; arrow keys nudge. */
function VFader({ label, value, onChange, fill, dense }: { label: string; value: number; onChange: (v: number) => void; fill: string; dense?: boolean }) {
  const at = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); onChange(Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))); };
  const pad = dense ? 3 : 8;                       // track inset top/bottom
  const hh = dense ? 10 : 16;                      // handle height
  const span = `calc(100% - ${pad * 2}px)`;
  return (
    <div role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} tabIndex={0}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e); }}
      onKeyDown={(e) => { const d = e.key === "ArrowUp" ? 0.01 : e.key === "ArrowDown" ? -0.01 : e.key === "PageUp" ? 0.1 : e.key === "PageDown" ? -0.1 : 0; if (d) { e.preventDefault(); onChange(Math.min(1, Math.max(0, value + d))); } }}
      className="relative w-12 cursor-ns-resize touch-none rounded-lg bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="absolute rounded-full bg-border" style={{ left: 18, right: 18, top: pad, bottom: pad }} />
      <div className={`absolute rounded-full ${fill}`} style={{ left: 18, right: 18, bottom: pad, height: `calc(${span} * ${value})` }} />
      <div className="absolute inset-x-1 -translate-y-1/2 rounded-md border border-border bg-surface-elevated shadow-md" style={{ height: hh, top: `calc(${pad}px + ${span} * ${1 - value})` }} />
    </div>
  );
}


function FaderSetup({ i, fd, groups, looks, selected, fixtures, onClose, onSave }: PlaybackProps & { i: number; fd?: BankFader | undefined; onClose: () => void; onSave: (fd: BankFader | null) => void }) {
  const [kind, setKind] = useState<BankFader["kind"]>(fd?.kind ?? (groups.length ? "group" : "fixtures"));
  const [ref, setRef] = useState(fd?.ref ?? (kind === "group" ? groups[0] ?? "" : looks[0]?.id ?? ""));
  const [name, setName] = useState(fd?.name ?? "");
  const [param, setParam] = useState<Param>(fd?.param ?? "intensity");
  const [btns, setBtns] = useState<Btn[]>(fd ? defaultBtns(fd).slice(0, 2) : ["flash", "solo"]);
  const [color, setColor] = useState<NonNullable<BankFader["color"]>>(fd?.color ?? "primary");
  const uids = fd?.kind === "fixtures" && fd.uids?.length && !selected.length ? fd.uids : selected;
  const opt = (a: boolean) => `flex-1 rounded-md py-2 text-xs font-semibold ${a ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  const save = () => {
    const auto = kind === "group" ? ref : kind === "look" ? looks.find((l) => l.id === ref)?.name ?? "Look" : kind === "master" ? "Master" : `${uids.length} lights`;
    const keep = fd?.kind === kind && (fd.param ?? "intensity") === param;
    onSave({ id: fd?.id && !fd.id.startsWith("empty") ? fd.id : newId(), name: name.trim() || auto, kind, ...(kind === "fixtures" ? { uids } : kind === "master" ? {} : { ref }),
      ...(kind === "group" || kind === "fixtures" ? { param } : {}), buttons: btns, color,
      level: keep ? fd!.level : kind === "look" || (param !== "intensity" && kind !== "master") ? 0 : 1, ...(keep && fd?.touched ? { touched: fd.touched } : {}) });
  };
  const sel = "w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tr("Fader")} {i + 1}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-4 gap-1.5">
            <button className={opt(kind === "group")} onClick={() => { setKind("group"); setRef(groups[0] ?? ""); }}>{tr("Group")}</button>
            <button className={opt(kind === "look")} onClick={() => { setKind("look"); setRef(looks[0]?.id ?? ""); }}>{tr("Look")}</button>
            <button className={opt(kind === "fixtures")} onClick={() => setKind("fixtures")}>{tr("Selected")}</button>
            <button className={opt(kind === "master")} onClick={() => { setKind("master"); if (btns.join() === "flash,solo") setBtns(["full", "zero"]); }}>{tr("Master")}</button>
          </div>
          {kind === "group" && (groups.length ? (
            <select value={ref} onChange={(e) => setRef(e.target.value)} className={sel}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
          ) : <p className="text-muted-foreground">{tr("No groups yet — create one in the Groups rail.")}</p>)}
          {kind === "look" && (looks.length ? (
            <select value={ref} onChange={(e) => setRef(e.target.value)} className={sel}>{looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          ) : <p className="text-muted-foreground">{tr("No looks saved yet.")}</p>)}
          {kind === "fixtures" && <p className="text-muted-foreground">{uids.length ? `${uids.length} lights: ${fixtures.filter((f) => uids.includes(f.uid)).map((f) => f.name).slice(0, 6).join(", ")}` : tr("Select lights on the console first.")}</p>}
          {(kind === "group" || kind === "fixtures") && (
            <label className="block space-y-1"><span className="font-semibold">{tr("Fader controls")}</span>
              <select value={param} onChange={(e) => setParam(e.target.value as Param)} className={sel}>{PARAMS.map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select>
            </label>
          )}
          <p className="text-muted-foreground">{kind === "look" ? tr("Pushing the fader fades the look in over what's on stage.") : kind === "master" ? tr("Works like the MASTER slider at the top.") : param === "intensity" ? tr("The fader scales these lights' intensity (100% = as set on the console).") : tr("Once moved, the fader sets this value on its lights. If two faders control the same thing, the last one moved wins.")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((n) => (
              <label key={n} className="space-y-1"><span className="font-semibold">{tr("Button")} {n + 1}</span>
                <select value={btns[n] ?? ""} onChange={(e) => { const v = [...btns]; v[n] = e.target.value as Btn; setBtns(v.filter(Boolean)); }} className={sel}>
                  {BTNS.map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2"><span className="font-semibold">{tr("Colour")}</span>
            {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={`h-6 w-6 rounded-full ${swatch[c]} ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`} />)}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Name, e.g. Key, Fill, Police")} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <div className="flex gap-2">
            {fd && <Button variant="destructive" onClick={() => onSave(null)}><Trash2 />{tr("Clear")}</Button>}
            <Button className="flex-1" onClick={save} disabled={(kind === "group" || kind === "look") ? !ref : kind === "fixtures" ? !uids.length : false}>{tr("Save")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CueDialog({ open, onOpenChange, cues, setCues, activeCue, onGoto, onRecordCue, onUpdateCueStates, fixtures, selected }: PlaybackProps & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const sorted = sortCues(cues);
  const [name, setName] = useState("");
  const upd = (id: string, patch: Partial<Cue>) => setCues(cues.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tr("Cue list")}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tr("Each cue stores")}{selected.length ? `the ${selected.length} selected lights` : `all ${fixtures.length} lights`}{tr(". GO fades to the next cue. Insert adds a point cue (e.g. 2.5).")}</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onRecordCue(name.trim()); setName(""); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Cue name, e.g. Setup")} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <Button type="submit"><Plus />{tr("Record cue")}</Button>
        </form>
        <div className="space-y-1.5">
          {sorted.map((c) => (
            <div key={c.id} className={`grid grid-cols-[4rem_1fr_6.5rem_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${c.id === activeCue ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-elevated"}`}>
              <NumberField aria-label={tr("Cue number")} value={c.number} min={0} step={0.1} onChange={(v) => v != null && upd(c.id, { number: v })} className="w-full rounded border border-input bg-background px-1.5 py-1 font-mono" />
              <div className="min-w-0 space-y-1">
                <input value={c.name} onChange={(e) => upd(c.id, { name: e.target.value })} className="w-full font-semibold rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                <input value={c.note ?? ""} onChange={(e) => upd(c.id, { note: e.target.value })} placeholder={tr("Note — e.g. actor enters, lamp on")} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <label className="text-[10px] text-muted-foreground">{tr("Fade s")}<NumberField aria-label={tr("Fade seconds")} value={c.fade} min={0} step={0.5} onChange={(v) => v != null && upd(c.id, { fade: v })} className="w-full rounded border border-input bg-background px-1.5 py-1 font-mono text-foreground" />
                <button onClick={() => upd(c.id, { mode: c.mode === "cueonly" ? "track" : "cueonly" })} aria-pressed={c.mode === "cueonly"}
                  title={tr("Track: values stay for the next cues. Cue only: values go back when the next cue runs.")}
                  className={`mt-1 w-full rounded px-1 py-0.5 font-bold ${c.mode === "cueonly" ? "bg-warning/30 text-warning" : "bg-background text-foreground"}`}>{c.mode === "cueonly" ? tr("Cue only") : tr("Track")}</button>
                <input key={c.tc ?? "none"} defaultValue={c.tc != null ? fmtTc(c.tc) : ""} placeholder={tr("TC hh:mm:ss:ff")} aria-label={tr("Timecode")}
                  onBlur={(e) => upd(c.id, { tc: parseTc(e.target.value) })} className="mt-1 w-full rounded border border-input bg-background px-1 py-0.5 font-mono text-foreground" />
              </label>
              <div className="flex gap-1">
                <Button size="icon" variant="secondary" aria-label={`Go to cue ${c.number}`} title={tr("Go to this cue")} onClick={() => onGoto(c.id)}><Play /></Button>
                <Button size="icon" variant="secondary" aria-label={tr("Update cue from stage")} title={tr("Update from current lights")} onClick={() => { if (confirm(`Overwrite Q${c.number} with the current lights?`)) onUpdateCueStates(c.id); }}><RefreshCw /></Button>
                <Button size="icon" variant="secondary" aria-label={tr("Insert cue after")} title={tr("Insert point cue after")} onClick={() => onRecordCue(name.trim(), c.number)}><Plus /></Button>
                <Button size="icon" variant="secondary" aria-label={tr("Delete cue")} onClick={() => { if (confirm(`Delete Q${c.number} ${c.name}?`)) setCues(cues.filter((x) => x.id !== c.id)); }}><Trash2 className="text-destructive" /></Button>
              </div>
            </div>
          ))}
          {!sorted.length && <p className="py-6 text-center text-sm text-muted-foreground">{tr("No cues yet. Set the lights, then Record cue.")}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
