import { useState } from "react";
import { Camera, Play } from "lucide-react";
import { ItemMenu } from "./ItemMenu";
import type { PatchedFixture } from "@/lib/dmx";
import { uid, type Look, type LookState } from "@/lib/store";

export const snapshot = (f: PatchedFixture): LookState => ({
  intensity: f.intensity, cct: f.cct, gm: f.gm, hue: f.hue, saturation: f.saturation, crossfade: f.crossfade,
  cctOnly: f.cctOnly, fx: structuredClone(f.fx), on: f.on ?? true, fxPlaying: f.fxPlaying ?? true,
  ...(f.fan ? { fan: f.fan } : {}), ...(f.gel ? { gel: f.gel } : {}),
});

/** Applies a look: matches lights by id, falls back to name (so looks work across scenes). */
export function applyLook(look: Look, fixtures: PatchedFixture[]): PatchedFixture[] {
  return fixtures.map((f) => {
    const s = look.states.find((x) => x.uid === f.uid) ?? look.states.find((x) => x.name === f.name);
    return s ? { ...f, ...structuredClone(s.state), trigger: null } : f;
  });
}

export function LooksPanel({ fixtures, selected, looks, setLooks, onRecall, lastLook }: {
  fixtures: PatchedFixture[]; selected: string[]; looks: Look[]; setLooks: (l: Look[]) => void; onRecall: (l: Look) => void; lastLook: string | null;
}) {
  const [name, setName] = useState("");
  const save = (onlySel: boolean) => {
    const src = onlySel ? fixtures.filter((f) => selected.includes(f.uid)) : fixtures;
    if (!src.length) return;
    const look: Look = {
      id: uid(),
      name: name.trim() || `Look ${looks.length + 1}`,
      createdAt: Date.now(),
      states: src.map((f) => ({ uid: f.uid, name: f.name, state: snapshot(f) })),
    };
    setLooks([look, ...looks]);
    setName("");
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Looks</h2>
      <div className="space-y-2 rounded-lg bg-surface-elevated p-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Look name (e.g. Scene 1 — wide)" className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
        <div className="flex gap-2">
          <button disabled={!selected.length} onClick={() => save(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-surface py-2.5 text-xs font-semibold disabled:opacity-40"><Camera className="h-3.5 w-3.5" />Save selected ({selected.length})</button>
          <button disabled={!fixtures.length} onClick={() => save(false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Camera className="h-3.5 w-3.5" />Save all lights</button>
        </div>
        <p className="text-[10px] text-muted-foreground">Looks are shared across all scenes in this project.</p>
      </div>

      {looks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No looks saved yet.</p>
      ) : (
        <div className="space-y-1.5">
          {looks.map((l) => (
            <div key={l.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${lastLook === l.id ? "bg-primary/20" : "bg-surface-elevated"}`}>
              <button onClick={() => onRecall(l)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left active:scale-[0.98]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-glow text-primary-foreground"><Play className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{l.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.states.length} lights · {new Date(l.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              </button>
              <ItemMenu name={l.name}
                onRename={(n) => setLooks(looks.map((x) => (x.id === l.id ? { ...x, name: n } : x)))}
                onDuplicate={() => setLooks([{ ...structuredClone(l), id: uid(), name: `${l.name} copy`, createdAt: Date.now() }, ...looks])}
                onDelete={() => setLooks(looks.filter((x) => x.id !== l.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
