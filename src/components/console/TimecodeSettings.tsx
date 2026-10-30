import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TC_RATES, nominalFps, type TcRate } from "@/lib/ltc";
import { fmtTc, parseTc } from "@/lib/show-control";
import { t as tr } from "@/lib/i18n";

export interface TcConfig { source: "mtc" | "ltc"; rate: TcRate; deviceId?: string | undefined; chase: boolean }

export function TimecodeSettings(p: {
  on: boolean; onToggle: () => void; now: number | null | undefined;
  cfg: TcConfig; setCfg: (c: TcConfig) => void;
  tcStart: number | undefined; setTcStart: (v: number | undefined) => void;
}) {
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [open, setOpen] = useState(false);
  const fps = nominalFps(p.cfg.rate);
  useEffect(() => {
    if (!open || p.cfg.source !== "ltc") return;
    void navigator.mediaDevices?.enumerateDevices().then((d) => setInputs(d.filter((x) => x.kind === "audioinput"))).catch(() => {});
  }, [open, p.cfg.source, p.on]);
  const sel = "w-full rounded border border-input bg-background px-1.5 py-1 text-xs text-foreground";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-pressed={p.on} title={tr("Timecode — sync cues and the sequence with sound and camera")}
          className={`rounded-md px-1.5 py-0.5 text-left font-mono text-[10px] font-bold ${p.on ? "bg-primary/25 text-primary" : "bg-surface-elevated text-muted-foreground"}`}>
          {tr("TC")}{p.on ? (p.now != null ? fmtTc(p.now, fps) : tr("waiting…")) : tr("off")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 text-xs" align="start">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{tr("Timecode")}</span>
          <Button size="sm" variant={p.on ? "default" : "outline"} onClick={p.onToggle}>{p.on ? tr("On") : tr("Off")}</Button>
        </div>
        <div className="font-mono text-lg">{p.on && p.now != null ? fmtTc(p.now, fps) : "--:--:--:--"}</div>
        <label className="block space-y-1"><span className="text-muted-foreground">{tr("Source")}</span>
          <select className={sel} value={p.cfg.source} onChange={(e) => p.setCfg({ ...p.cfg, source: e.target.value as TcConfig["source"] })}>
            <option value="ltc">{tr("Audio LTC (Tentacle, recorder, camera)")}</option>
            <option value="mtc">{tr("MIDI timecode (MTC)")}</option>
          </select>
        </label>
        {p.cfg.source === "ltc" && (
          <label className="block space-y-1"><span className="text-muted-foreground">{tr("Audio input")}</span>
            <select className={sel} value={p.cfg.deviceId ?? ""} onChange={(e) => p.setCfg({ ...p.cfg, deviceId: e.target.value || undefined })}>
              <option value="">{tr("Default input")}</option>
              {inputs.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${tr("Input")} ${i + 1}`}</option>)}
            </select>
          </label>
        )}
        <label className="block space-y-1"><span className="text-muted-foreground">{tr("Frame rate")}</span>
          <select className={sel} value={p.cfg.rate} onChange={(e) => p.setCfg({ ...p.cfg, rate: Number(e.target.value) as TcRate })}>
            {TC_RATES.map((r) => <option key={r.v} value={r.v}>{r.label} fps</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><Checkbox checked={p.cfg.chase} onCheckedChange={(v) => p.setCfg({ ...p.cfg, chase: v === true })} />{tr("Sequence follows timecode")}</label>
        {p.cfg.chase && (
          <label className="block space-y-1"><span className="text-muted-foreground">{tr("Sequence starts at")}</span>
            <div className="flex gap-1">
              <input key={`${p.tcStart ?? "none"}-${fps}`} defaultValue={fmtTc(p.tcStart ?? 0, fps)} placeholder="hh:mm:ss:ff" aria-label={tr("Sequence starts at")}
                onBlur={(e) => p.setTcStart(parseTc(e.target.value, fps))} className={`${sel} font-mono`} />
              <Button size="sm" variant="outline" disabled={p.now == null} onClick={() => p.now != null && p.setTcStart(Math.floor(p.now * fps) / fps)}>{tr("Use current")}</Button>
            </div>
          </label>
        )}
        <p className="text-[10px] text-muted-foreground">{tr("Connect the timecode output with a cable to a line or mic input. Cues with a timecode fire automatically.")}</p>
      </PopoverContent>
    </Popover>
  );
}
