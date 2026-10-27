import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AUDIO_TARGETS, VIDEO_AUDIO_TARGETS, audioRunning, defaultAudioSettings, levels, listInputs, listOutputs, loadAudioFile, setAudioSettings, startAudio, stopAudio, type AudioReact, type AudioSettings, type Band } from "@/lib/audio-react";
import type { PixelLayer } from "@/lib/pixels";

import { t as tr } from "@/lib/i18n";
const KEY = "nox-audio-settings";
const BANDS: Band[] = ["bass", "mid", "high", "level"];

/** Sound popover for the selected PIXEL effect: source, gain/threshold/attack/release, live meter, per-action band and amount. */
export function SoundReact({ layer, onLayer }: { layer: PixelLayer; onLayer: (p: Partial<PixelLayer>) => void }) {
  const [s, setS] = useState<AudioSettings>(defaultAudioSettings);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [meter, setMeter] = useState({ bass: 0, mid: 0, high: 0, level: 0, beat: false });
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setS({ ...defaultAudioSettings(), ...JSON.parse(r) }); } catch { /* ignore */ } setOn(audioRunning()); }, []);
  useEffect(() => {
    if (!on) return;
    let id = 0; const tick = () => { setMeter(levels()); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, [on]);
  const upd = (p: Partial<AudioSettings>) => { const n = { ...s, ...p }; setS(n); setAudioSettings(n); localStorage.setItem(KEY, JSON.stringify(n)); return n; };
  const listen = async (n = s) => {
    try { await startAudio(n); setOn(true); setErr(null); setInputs(await listInputs()); setOutputs(await listOutputs()); }
    catch (e) { setOn(false); setErr(e instanceof Error ? e.message : tr("Could not open audio")); }
  };
  const a: AudioReact = layer.audio ?? { enabled: false };
  const setA = (p: Partial<AudioReact>) => onLayer({ audio: { ...a, ...p } });
  const field = "rounded bg-surface-elevated px-1 py-0.5";
  const slider = (label: string, k: "gain" | "threshold" | "attack" | "release", min: number, max: number, step: number, fmt: (v: number) => string) => (
    <label className="flex items-center gap-1.5"><span className="w-16">{label}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={s[k]} onChange={(e) => upd({ [k]: +e.target.value })} className="flex-1" />
      <span className="w-12 text-right font-mono">{fmt(s[k])}</span></label>
  );
  return (
    <Popover>
      <PopoverTrigger asChild><Button size="sm" variant={a.enabled && on ? "default" : "secondary"} aria-label={tr("Sound reactive")}><AudioLines />{tr("Sound")}{a.enabled && on ? tr(" ●") : tr("")}</Button></PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 p-3 text-xs">
        <div className="flex items-center gap-1.5">
          <select aria-label={tr("Sound source")} value={s.source} onChange={(e) => { const n = upd({ source: e.target.value as AudioSettings["source"] }); if (on) void listen(n); }} className={`flex-1 ${field}`}>
            <option value="device">{tr("Device audio (what's playing)")}</option><option value="file">{tr("Audio file (WAV…)")}</option><option value="input">{tr("Sound card input")}</option><option value="mic">{tr("Microphone")}</option><option value="timeline">{tr("TIMELINE audio")}</option>
          </select>
          <Button size="sm" variant={on ? "destructive" : "default"} onClick={() => { if (on) { stopAudio(); setOn(false); } else void listen(); }}>{on ? tr("Stop") : tr("Listen")}</Button>
        </div>
        {s.source === "input" && (
          <select aria-label={tr("Input device")} value={s.deviceId ?? ""} onChange={(e) => { const n = upd({ deviceId: e.target.value || undefined }); if (on) void listen(n); }} className={`w-full ${field}`}>
            <option value="">{tr("Default input")}</option>
            {inputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>)}
          </select>
        )}
        {s.source === "file" && (
          <label className={`flex w-full cursor-pointer items-center gap-1.5 ${field}`}>
            <span className="font-semibold">{tr("Choose file")}</span><span className="truncate text-muted-foreground">{fileName ?? "WAV, AIFF, FLAC, MP3"}</span>
            <input type="file" accept="audio/*,.wav,.aif,.aiff,.flac" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFileName(loadAudioFile(f)); void listen(); } }} />
          </label>
        )}
        {(s.source === "file" || s.source === "timeline") && (
          <select aria-label={tr("Output device")} value={s.outputId ?? ""} onFocus={async () => setOutputs(await listOutputs())} onChange={(e) => { const n = upd({ outputId: e.target.value || undefined }); if (on) void listen(n); }} className={`w-full ${field}`}>
            <option value="">{tr("Default output")}</option>
            {outputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${i + 1}`}</option>)}
          </select>
        )}
        {err && <p className="text-destructive">{err}</p>}
        <div className="grid grid-cols-4 gap-1" aria-label={tr("Sound meter")}>
          {BANDS.map((b) => <div key={b} className="text-center"><div className="relative h-10 overflow-hidden rounded bg-surface-elevated"><div className={`absolute inset-x-0 bottom-0 ${b === "bass" && meter.beat ? "bg-destructive" : "bg-primary"}`} style={{ height: `${Math.round(meter[b] * 100)}%` }} /></div><span className="capitalize text-muted-foreground">{b}</span></div>)}
        </div>
        {slider("Gain", "gain", 0.25, 8, 0.25, (v) => `×${v}`)}
        {slider("Threshold", "threshold", 0, 0.6, 0.01, (v) => `${Math.round(v * 100)}%`)}
        {slider("Attack", "attack", 0, 0.5, 0.01, (v) => `${Math.round(v * 1000)}ms`)}
        {slider("Release", "release", 0.02, 2, 0.02, (v) => `${Math.round(v * 1000)}ms`)}
        <label className="flex items-center gap-1.5 border-t border-border pt-2 font-semibold">
          <input type="checkbox" checked={a.enabled} onChange={(e) => setA({ enabled: e.target.checked })} />{tr("This effect reacts to sound")}</label>
        {[...AUDIO_TARGETS, ...(layer.kind === "video" ? VIDEO_AUDIO_TARGETS : [])].map(([k, label, band]) => {
          const t = a[k] ?? { on: false, band, amount: 0.7 };
          return (
            <div key={k} className={`flex items-center gap-1.5 ${a.enabled ? "" : "opacity-50"}`}>
              <input type="checkbox" aria-label={label} checked={t.on} onChange={(e) => setA({ [k]: { ...t, on: e.target.checked } })} />
              <span className="w-24">{label}</span>
              <select aria-label={`${label} band`} value={t.band} onChange={(e) => setA({ [k]: { ...t, band: e.target.value as Band } })} className={field}>
                {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <input type="range" aria-label={`${label} amount`} min={0} max={1} step={0.05} value={t.amount} onChange={(e) => setA({ [k]: { ...t, amount: +e.target.value } })} className="min-w-0 flex-1" />
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground">{tr("Sound is analysed raw on this device — no compression, echo cancelling or auto gain. WAV/AIFF/FLAC play lossless to the chosen output; nothing is re-encoded or sent out.")}</p>
      </PopoverContent>
    </Popover>
  );
}
