import { useState } from "react";
import { ChevronLeft, ListOrdered, Plus, Settings2, Trash2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberField } from "@/components/console/NumberField";
import type { PatchedFixture } from "@/lib/dmx";
import type { BankFader, Cue, Look } from "@/lib/store";
import { BANK_SIZE, BANK_PAGES, sortCues } from "@/lib/playback";
import { fmtTc, parseTc } from "@/lib/show-control";

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
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function PlaybackBar(p: PlaybackProps) {
  const [edit, setEdit] = useState<number | null>(null);
  const [cuesOpen, setCuesOpen] = useState(false);
  const [page, setPage] = useState(0);
  const base = page * BANK_SIZE;
  const sorted = sortCues(p.cues);
  const idx = sorted.findIndex((c) => c.id === p.activeCue);
  const cur = sorted[idx];
  const next = sorted[idx + 1];
  const slots = Array.from({ length: BANK_SIZE }, (_, i) => p.bank[base + i]);

  const setSlot = (i: number, fd: BankFader | null) => {
    const arr = Array.from({ length: BANK_SIZE * BANK_PAGES }, (_, k) => p.bank[k]);
    arr[i] = fd ?? undefined;
    // keep the array dense up to the last used slot
    let last = arr.length - 1; while (last >= 0 && !arr[last]) last--;
    p.setBank(arr.slice(0, last + 1).map((x, k) => x ?? { id: `empty-${k}`, name: "", kind: "fixtures", uids: [], level: 1 }));
  };
  const setLevel = (i: number, level: number) => { const fd = p.bank[i]; if (fd) p.setBank(p.bank.map((x, k) => (k === i ? { ...x, level } : x))); };

  return (
    <div aria-label={tr("Faders")} className="flex shrink-0 items-stretch gap-2 overflow-x-auto border-t border-border bg-surface px-3 py-2">
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
          <button onClick={p.onTc} aria-pressed={!!p.tcOn} title={tr("Follow MIDI timecode (MTC) — cues with a timecode fire automatically")}
            className={`rounded-md px-1.5 py-0.5 text-left font-mono text-[10px] font-bold ${p.tcOn ? "bg-primary/25 text-primary" : "bg-surface-elevated text-muted-foreground"}`}>{tr("TC")}{p.tcOn ? (p.tcNow != null ? fmtTc(p.tcNow) : tr("waiting…")) : tr("off")}
          </button>
        </div>
      </div>
      <div className="w-px shrink-0 bg-border" />
      <div aria-label={tr("Fader banks")} className="grid shrink-0 grid-cols-2 gap-1">
        {Array.from({ length: BANK_PAGES }, (_, b) => {
          const used = p.bank.slice(b * BANK_SIZE, (b + 1) * BANK_SIZE).some((x) => x && x.name);
          return (
            <button key={b} onClick={() => setPage(b)} aria-pressed={page === b} title={`Bank ${b + 1}: faders ${b * BANK_SIZE + 1}–${(b + 1) * BANK_SIZE}`}
              className={`w-9 rounded-md text-[10px] font-bold ${page === b ? "bg-primary text-primary-foreground" : used ? "bg-primary/25" : "bg-surface-elevated text-muted-foreground"}`}>{tr("B")}{b + 1}</button>
          );
        })}
      </div>
      {slots.map((fd, j) => {
        const i = base + j;
        const empty = !fd || (!fd.name && fd.kind === "fixtures" && !fd.uids?.length);
        return (
          <div key={i} className="flex w-32 shrink-0 flex-col gap-1 rounded-lg bg-surface-elevated px-2 py-1">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="font-mono text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{empty ? tr("Empty") : fd!.name}</span>
              <button onClick={() => setEdit(i)} aria-label={`Set up fader ${i + 1}`}><Settings2 className="h-3.5 w-3.5" /></button>
            </div>
            {empty ? (
              <button onClick={() => setEdit(i)} className="rounded-md border border-dashed border-border py-1 text-[10px] text-muted-foreground">{tr("Assign")}</button>
            ) : (
              <>
                <input aria-label={`Fader ${i + 1} ${fd!.name}`} type="range" min={0} max={1} step={0.01} value={p.flash === fd!.id ? 1 : fd!.level} onChange={(e) => setLevel(i, +e.target.value)} />
                <div className="flex gap-1">
                  <button onPointerDown={() => p.setFlash(fd!.id)} onPointerUp={() => p.setFlash(null)} onPointerLeave={() => p.flash === fd!.id && p.setFlash(null)} onContextMenu={(e) => e.preventDefault()}
                    className={`flex-1 rounded px-1 py-0.5 text-[9px] font-bold select-none ${p.flash === fd!.id ? "bg-amber-glow text-primary-foreground" : "bg-background"}`}>{tr("FLASH")}</button>
                  <button onClick={() => p.setSolo(p.solo === fd!.id ? null : fd!.id)} aria-pressed={p.solo === fd!.id}
                    className={`flex-1 rounded px-1 py-0.5 text-[9px] font-bold ${p.solo === fd!.id ? "bg-primary text-primary-foreground" : "bg-background"}`}>{tr("SOLO")}</button>
                  <span className="w-7 text-right font-mono text-[9px] leading-5">{Math.round(fd!.level * 100)}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
      {edit != null && <FaderSetup i={edit} fd={p.bank[edit]} {...p} onClose={() => setEdit(null)} onSave={(fd) => { setSlot(edit, fd); setEdit(null); }} />}
      <CueDialog open={cuesOpen} onOpenChange={setCuesOpen} {...p} />
    </div>
  );
}

function FaderSetup({ i, fd, groups, looks, selected, fixtures, onClose, onSave }: PlaybackProps & { i: number; fd?: BankFader | undefined; onClose: () => void; onSave: (fd: BankFader | null) => void }) {
  const [kind, setKind] = useState<BankFader["kind"]>(fd?.kind ?? (groups.length ? "group" : "fixtures"));
  const [ref, setRef] = useState(fd?.ref ?? (kind === "group" ? groups[0] ?? "" : looks[0]?.id ?? ""));
  const [name, setName] = useState(fd?.name ?? "");
  const uids = fd?.kind === "fixtures" && fd.uids?.length && !selected.length ? fd.uids : selected;
  const opt = (a: boolean) => `flex-1 rounded-md py-2 text-xs font-semibold ${a ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`;
  const save = () => {
    const auto = kind === "group" ? ref : kind === "look" ? looks.find((l) => l.id === ref)?.name ?? "Look" : `${uids.length} lights`;
    onSave({ id: fd?.id && !fd.id.startsWith("empty") ? fd.id : newId(), name: name.trim() || auto, kind, ...(kind === "fixtures" ? { uids } : { ref }), level: fd?.kind === kind ? fd.level : kind === "look" ? 0 : 1 });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tr("Fader")}{i + 1}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="flex gap-1.5">
            <button className={opt(kind === "group")} onClick={() => { setKind("group"); setRef(groups[0] ?? ""); }}>{tr("Group")}</button>
            <button className={opt(kind === "look")} onClick={() => { setKind("look"); setRef(looks[0]?.id ?? ""); }}>{tr("Look")}</button>
            <button className={opt(kind === "fixtures")} onClick={() => setKind("fixtures")}>{tr("Selected")}</button>
          </div>
          {kind === "group" && (groups.length ? (
            <select value={ref} onChange={(e) => setRef(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm">{groups.map((g) => <option key={g}>{g}</option>)}</select>
          ) : <p className="text-muted-foreground">{tr("No groups yet — create one in the Groups rail.")}</p>)}
          {kind === "look" && (looks.length ? (
            <select value={ref} onChange={(e) => setRef(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm">{looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          ) : <p className="text-muted-foreground">{tr("No looks saved yet.")}</p>)}
          {kind === "fixtures" && <p className="text-muted-foreground">{uids.length ? `${uids.length} lights: ${fixtures.filter((f) => uids.includes(f.uid)).map((f) => f.name).slice(0, 6).join(", ")}` : tr("Select lights on the console first.")}</p>}
          <p className="text-muted-foreground">{kind === "look" ? tr("Pushing the fader fades the look in over what's on stage.") : tr("The fader scales these lights' intensity (100% = as set on the console).")}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Name, e.g. Key, Fill, Police")} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <div className="flex gap-2">
            {fd && <Button variant="destructive" onClick={() => onSave(null)}><Trash2 />{tr("Clear")}</Button>}
            <Button className="flex-1" onClick={save} disabled={(kind !== "fixtures" && !ref) || (kind === "fixtures" && !uids.length)}>{tr("Save")}</Button>
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
