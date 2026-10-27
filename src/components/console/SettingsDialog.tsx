import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { Music, Trash2, FolderOpen, Keyboard, Plus, ChevronDown, Languages } from "lucide-react";
import { MACRO_ACTIONS, type Macro, type MacroAction } from "@/lib/macros";
import { TRIGGERS } from "@/lib/dmx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isIosApp, pairBluetoothMidi, type MidiMap } from "@/lib/midi";
import { APP_VERSION } from "@/lib/app-version";
import { LANGS, getLang, setLang, isRtl } from "@/lib/i18n";

import { t as tr } from "@/lib/i18n";
export interface BtDevice { id: string; name: string; battery: number | null }
export interface MidiTarget { id: string; label: string }

export function SettingsDialog({ open, onOpenChange, onSetups, midi, setMidi, targets, learning, setLearning, lastMsg, midiDevices, midiError, onNanoKontrol, macros, setMacros, macroLearn, setMacroLearn }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSetups: () => void;
  midi: { enabled: boolean; maps: MidiMap[] }; setMidi: (m: { enabled: boolean; maps: MidiMap[] }) => void;
  targets: MidiTarget[]; learning: string | null; setLearning: (t: string | null) => void;
  lastMsg: string | null; midiDevices: string[]; midiError: string | null; onNanoKontrol?: () => void;
  macros: Macro[]; setMacros: (m: Macro[]) => void; macroLearn: string | null; setMacroLearn: (id: string | null) => void;
}) {
  const [ios, setIos] = useState(false);
  const [lang, setLangLocal] = useState(getLang());
  useEffect(() => setIos(isIosApp()), []);
  const mapFor = (t: string) => midi.maps.filter((m) => m.target === t);
  const upd = (id: string, p: Partial<Macro>) => setMacros(macros.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const learnMacro = (id: string) => {
    const on = macroLearn !== id;
    setMacroLearn(on ? id : null);
    if (midi.enabled) setLearning(on ? `macro:${id}` : null);
  };
  // a captured MIDI button ends macro learning too
  useEffect(() => { if (macroLearn && learning === null && midi.maps.some((m) => m.target === `macro:${macroLearn}`)) setMacroLearn(null); }, [learning, midi.maps, macroLearn, setMacroLearn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{tr("Settings")}</DialogTitle><p className="font-mono text-xs text-muted-foreground">NOX v{APP_VERSION}</p></DialogHeader>
        <div className="space-y-5 text-xs">
          <label className="flex items-center justify-between gap-2 rounded-md bg-surface-elevated px-3 py-2 font-semibold">
            <span className="flex items-center gap-1.5"><Languages className="h-4 w-4" />{tr("Language")}</span>
            <select value={lang} dir="ltr" onChange={(e) => { const v = e.target.value; setLang(v); setLangLocal(v); }} className="max-w-[60%] rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <Button variant="secondary" className="w-full" onClick={() => { onOpenChange(false); onSetups(); }}><FolderOpen />{tr("Project setups")}</Button>

          <Collapsible className="space-y-2">
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-surface-elevated px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1.5"><Music className="h-4 w-4" />{tr("MIDI controller")}</span>
              <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
            <label className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-2 font-semibold">{tr("Enable MIDI")}<Checkbox checked={midi.enabled} onCheckedChange={(c) => setMidi({ ...midi, enabled: c === true })} />
            </label>
            {ios && <button onClick={() => void pairBluetoothMidi().catch(() => {})} className="w-full rounded-lg bg-surface-elevated py-2 font-semibold">{tr("Pair Bluetooth MIDI controller")}</button>}
            {midiError && <p className="text-destructive">{midiError}</p>}
            {onNanoKontrol && <button onClick={onNanoKontrol} className="w-full rounded-lg bg-surface-elevated py-2 font-semibold">{tr("Load Korg nanoKONTROL2 layout (faders 1–6, master, GO / Back / Blackout)")}</button>}
            <p className="text-muted-foreground">{tr("Keyboard / Stream Deck: Space = GO, B = Back.")}</p>
            {midi.enabled && <p className="text-muted-foreground">{tr("Devices:")}{midiDevices.length ? midiDevices.join(", ") : tr("none found — plug in a controller")}{lastMsg ? ` · last: ${lastMsg}` : tr("")}</p>}
            {midi.enabled && (
              <div className="space-y-1">
                <p className="text-muted-foreground">{tr("Tap LEARN, then move a fader or press a button on the controller.")}</p>
                {targets.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md bg-surface-elevated px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    {mapFor(t.id).map((m) => (
                      <span key={m.key} className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">{m.key}
                        <button onClick={() => setMidi({ ...midi, maps: midi.maps.filter((x) => x !== m) })} aria-label={tr("Remove mapping")}><Trash2 className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <button onClick={() => setLearning(learning === t.id ? null : t.id)} className={`rounded px-2 py-1 text-[10px] font-bold ${learning === t.id ? "animate-pulse bg-amber-glow text-primary-foreground" : "bg-background"}`}>{learning === t.id ? tr("MOVE…") : tr("LEARN")}</button>
                  </div>
                ))}
              </div>
            )}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible className="space-y-2">
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-surface-elevated px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1.5"><Keyboard className="h-4 w-4" />{tr("Macro pad")}</span>
              <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
            <p className="text-muted-foreground">{tr("Choose what each macro does, tap LEARN, then press the button or turn the knob on your macro pad (keyboard-type pads and MIDI buttons both work). Works on the selected lights.")}</p>
            {macros.map((m, i) => {
              const a = MACRO_ACTIONS.find((x) => x.id === m.action);
              const midiKeys = mapFor(`macro:${m.id}`);
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md bg-surface-elevated px-2 py-1.5">
                  <span className="w-6 font-mono text-muted-foreground">{i + 1}</span>
                  <select aria-label={`Macro ${i + 1} action`} value={m.action} onChange={(e) => { const na = MACRO_ACTIONS.find((x) => x.id === e.target.value); upd(m.id, { action: e.target.value as MacroAction, amount: na?.def ?? m.amount }); }}
                    className="rounded border border-input bg-background px-1.5 py-1">
                    {MACRO_ACTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                  {a?.unit && <label className="flex items-center gap-1"><input aria-label={`Macro ${i + 1} amount`} type="number" value={m.amount} onChange={(e) => upd(m.id, { amount: Number(e.target.value) || 0 })} className="w-16 font-mono rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />{a.unit}</label>}
                  {a?.pick === "trigger" && <select aria-label={`Macro ${i + 1} trigger`} value={m.param ?? "lightning"} onChange={(e) => upd(m.id, { param: e.target.value })}
                    className="rounded border border-input bg-background px-1.5 py-1">{TRIGGERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>}
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{[m.key, ...midiKeys.map((k) => k.key)].filter(Boolean).join(" · ") || "not set"}</span>
                  <button onClick={() => learnMacro(m.id)} className={`rounded px-2 py-1 text-[10px] font-bold ${macroLearn === m.id ? "animate-pulse bg-amber-glow text-primary-foreground" : "bg-background"}`}>{macroLearn === m.id ? tr("PRESS…") : tr("LEARN")}</button>
                  <button aria-label={`Remove macro ${i + 1}`} onClick={() => { setMacros(macros.filter((x) => x.id !== m.id)); if (midiKeys.length) setMidi({ ...midi, maps: midi.maps.filter((x) => x.target !== `macro:${m.id}`) }); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
            <Button variant="secondary" className="w-full" onClick={() => setMacros([...macros, { id: Math.random().toString(36).slice(2, 9), key: null, action: "int_up", amount: 5 }])}><Plus />{tr("Add macro")}</Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
