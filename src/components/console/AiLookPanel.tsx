import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateLookFn } from "@/lib/ai-look.functions";
import { FX_PRESETS, caps, cctFromKelvin, getDef, getMode, type EffectKind, type PatchedFixture } from "@/lib/dmx";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const EXAMPLES = ["Warm candle-lit dinner, low key", "Moonlit night exterior with a lightning storm", "Neon cyberpunk alley, magenta and cyan", "Bright clean daylight interview"];

export function AiLookPanel({ fixtures, onApply }: { fixtures: PatchedFixture[]; onApply: (fs: PatchedFixture[]) => void }) {
  const generate = useServerFn(generateLookFn);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const run = async () => {
    if (prompt.trim().length < 3 || busy) return;
    setBusy(true); setError(null); setSummary(null);
    try {
      const res = await generate({
        data: {
          prompt: prompt.trim(),
          fixtures: fixtures.map((f) => {
            const c = caps(getMode(f).kind);
            const d = getDef(f.defId);
            return { uid: f.uid, name: f.name, fixture: `${d.brand} ${d.model} (${getMode(f).name})`, ...c };
          }),
        },
      });
      if (!res.ok) { setError(res.error); return; }
      const byUid = new Map(res.look.fixtures.map((x) => [x.uid, x]));
      onApply(
        fixtures.map((f) => {
          const s = byUid.get(f.uid);
          if (!s) return f;
          const kind = s.effect as EffectKind;
          const fx = kind === "none" ? { ...f.fx, kind } : {
            ...f.fx, ...FX_PRESETS[kind], kind,
            ...(s.effectRate != null ? { rate: clamp(s.effectRate, 0.05, 10) } : {}),
            ...(s.effectLow != null ? { min: clamp(s.effectLow / 100, 0, 1) } : {}),
            ...(s.effectHigh != null ? { max: clamp(s.effectHigh / 100, 0, 1) } : {}),
          };
          return {
            ...f,
            intensity: clamp(s.intensity / 100, 0, 1),
            cct: s.kelvin != null ? clamp(cctFromKelvin(s.kelvin), 0, 1) : f.cct,
            gm: s.gm != null ? clamp(s.gm, -1, 1) : f.gm,
            hue: s.hue != null ? ((s.hue % 360) + 360) % 360 : f.hue,
            saturation: s.saturation != null ? clamp(s.saturation / 100, 0, 1) : f.saturation,
            crossfade: s.crossfade != null ? clamp(s.crossfade / 100, 0, 1) : f.crossfade,
            cctOnly: s.crossfade != null && s.crossfade > 0 ? false : f.cctOnly,
            fx,
            trigger: null,
          };
        }),
      );
      setSummary(res.look.summary);
    } catch {
      setError("Could not reach the AI. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-4 w-4 text-amber-glow" /> AI look
      </h2>
      {fixtures.length === 0 ? (
        <p className="text-sm text-muted-foreground">Patch some lights first, then describe the look you want.</p>
      ) : (
        <>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={1000} placeholder="Describe the lighting look…" className="w-full rounded-lg border border-input bg-surface-elevated p-3 text-sm outline-none focus:border-primary" />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setPrompt(e)} className="rounded-full bg-surface-elevated px-3 py-1 text-[11px] text-muted-foreground">{e}</button>
            ))}
          </div>
          <button onClick={run} disabled={busy || prompt.trim().length < 3} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-glow py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Generating…" : `Generate for ${fixtures.length} lights`}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {summary && <p className="rounded-md bg-surface-elevated p-3 text-xs">{summary} <span className="text-muted-foreground">Settings applied — tap any light to fine-tune.</span></p>}
        </>
      )}
    </div>
  );
}
