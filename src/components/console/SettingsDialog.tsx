import { useEffect, useState } from "react";
import { Bluetooth, BatteryMedium, Maximize, Music, Trash2, Tv, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MidiMap } from "@/lib/midi";
import { APP_VERSION } from "@/lib/app-version";

export interface BtDevice { id: string; name: string; battery: number | null }
export interface MidiTarget { id: string; label: string }

export function SettingsDialog({ open, onOpenChange, onSetups, bt, connectBt, midi, setMidi, targets, learning, setLearning, lastMsg, midiDevices, midiError, onNanoKontrol }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSetups: () => void;
  bt: BtDevice[]; connectBt: () => void;
  midi: { enabled: boolean; maps: MidiMap[] }; setMidi: (m: { enabled: boolean; maps: MidiMap[] }) => void;
  targets: MidiTarget[]; learning: string | null; setLearning: (t: string | null) => void;
  lastMsg: string | null; midiDevices: string[]; midiError: string | null; onNanoKontrol?: () => void;
}) {
  const [fs, setFs] = useState(false);
  useEffect(() => { const h = () => setFs(!!document.fullscreenElement); document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});
  const mapFor = (t: string) => midi.maps.filter((m) => m.target === t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Settings</DialogTitle><p className="font-mono text-xs text-muted-foreground">NOX v{APP_VERSION}</p></DialogHeader>
        <div className="space-y-5 text-xs">
          <Button variant="secondary" className="w-full" onClick={() => { onOpenChange(false); onSetups(); }}><FolderOpen />Project setups</Button>
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground"><Tv className="h-4 w-4" />Tablet & screen</h3>
            <button onClick={toggleFs} className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-elevated py-3 font-semibold"><Maximize className="h-4 w-4" />{fs ? "Exit full screen" : "Full screen console"}</button>
            <p className="text-muted-foreground">The console runs straight on the tablet — open this page there and use "Add to Home Screen". To show it on a monitor too, mirror the tablet with AirPlay (iPad: Control Centre → Screen Mirroring) or Miracast/Cast (Android: Quick settings → Cast/Smart View).</p>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground"><Bluetooth className="h-4 w-4" />Bluetooth devices</h3>
            <button onClick={connectBt} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground"><Bluetooth className="h-4 w-4" />Connect device (AsteraBox, battery…)</button>
            {bt.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2">
                <span className="font-semibold">{d.name}</span>
                <span className="flex items-center gap-1 font-mono"><BatteryMedium className="h-4 w-4" />{d.battery == null ? "no battery info" : `${d.battery}%`}</span>
              </div>
            ))}
            <p className="text-muted-foreground">Works in Chrome / Edge on Android, Windows and Mac. iPad Safari doesn't allow Bluetooth from websites. Battery % shows for devices that share the standard battery level — some brands keep it in their own app.</p>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground"><Music className="h-4 w-4" />MIDI controller</h3>
            <label className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-2 font-semibold">
              Enable MIDI
              <input type="checkbox" checked={midi.enabled} onChange={(e) => setMidi({ ...midi, enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
            </label>
            {midiError && <p className="text-destructive">{midiError}</p>}
            {onNanoKontrol && <button onClick={onNanoKontrol} className="w-full rounded-lg bg-surface-elevated py-2 font-semibold">Load Korg nanoKONTROL2 layout (faders 1–6, master, GO / Back / Blackout)</button>}
            <p className="text-muted-foreground">Keyboard / Stream Deck: Space = GO, B = Back.</p>
            {midi.enabled && <p className="text-muted-foreground">Devices: {midiDevices.length ? midiDevices.join(", ") : "none found — plug in a controller"}{lastMsg ? ` · last: ${lastMsg}` : ""}</p>}
            {midi.enabled && (
              <div className="space-y-1">
                <p className="text-muted-foreground">Tap LEARN, then move a fader or press a button on the controller.</p>
                {targets.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md bg-surface-elevated px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    {mapFor(t.id).map((m) => (
                      <span key={m.key} className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">{m.key}
                        <button onClick={() => setMidi({ ...midi, maps: midi.maps.filter((x) => x !== m) })} aria-label="Remove mapping"><Trash2 className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <button onClick={() => setLearning(learning === t.id ? null : t.id)} className={`rounded px-2 py-1 text-[10px] font-bold ${learning === t.id ? "animate-pulse bg-amber-glow text-primary-foreground" : "bg-background"}`}>{learning === t.id ? "MOVE…" : "LEARN"}</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
