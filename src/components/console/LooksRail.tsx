import { Camera, Play } from "lucide-react";
import { ItemMenu } from "./ItemMenu";
import { snapshot } from "./LooksPanel";
import type { PatchedFixture } from "@/lib/dmx";
import { uid, type Look } from "@/lib/store";

import { t as tr } from "@/lib/i18n";
/** Compact looks list for the side rail (same strip as groups). */
export function LooksRail({ fixtures, selected, looks, setLooks, onRecall, lastLook, hideTitle }: {
  fixtures: PatchedFixture[]; selected: string[]; looks: Look[]; setLooks: (l: Look[]) => void; onRecall: (l: Look) => void; lastLook: string | null; hideTitle?: boolean;
}) {
  const save = (onlySel: boolean) => {
    const src = onlySel ? fixtures.filter((f) => selected.includes(f.uid)) : fixtures;
    if (!src.length) return;
    const fallback = `Look ${looks.length + 1}`;
    const name = prompt(tr("Look name"), fallback)?.trim() || fallback;
    setLooks([{ id: uid(), name, createdAt: Date.now(), states: src.map((f) => ({ uid: f.uid, name: f.name, state: snapshot(f) })) }, ...looks]);
  };

  return (
    <>
      {!hideTitle && <p className="w-full shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:mt-3 lg:border-t lg:border-border lg:pt-3">{tr("Looks")}</p>}
      <div className="flex shrink-0 gap-1.5">
        <button disabled={!selected.length} onClick={() => save(true)} title={tr("Save a look from the selected lights")}
          className="flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-[11px] font-semibold active:scale-95 disabled:opacity-40">
          <Camera className="h-3 w-3" />{tr("Selected (")}{selected.length})
        </button>
        <button disabled={!fixtures.length} onClick={() => save(false)} title={tr("Save a look from every light")}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground active:scale-95 disabled:opacity-40">
          <Camera className="h-3 w-3" />{tr("All lights")}</button>
      </div>
      {looks.length === 0 ? (
        <p className="shrink-0 text-[11px] text-muted-foreground">{tr("No looks saved yet.")}</p>
      ) : looks.map((l) => (
        <div key={l.id} className={`flex min-w-0 shrink-0 items-center gap-1 rounded-lg ${lastLook === l.id ? "bg-primary/20" : "bg-surface-elevated"}`}>
          <button onClick={() => onRecall(l)} aria-pressed={lastLook === l.id} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left active:scale-95">
            <Play className="h-3.5 w-3.5 shrink-0 text-amber-glow" />
            <span className="min-w-0">
              <span className="block max-w-40 truncate text-xs font-semibold lg:max-w-none">{l.name}</span>
              <span className="block text-[10px] text-muted-foreground">{l.states.length}{tr("lights")}</span>
            </span>
          </button>
          <ItemMenu name={l.name}
            onRename={(n) => setLooks(looks.map((x) => (x.id === l.id ? { ...x, name: n } : x)))}
            onDuplicate={() => setLooks([{ ...structuredClone(l), id: uid(), name: `${l.name} copy`, createdAt: Date.now() }, ...looks])}
            onDelete={() => setLooks(looks.filter((x) => x.id !== l.id))} />
        </div>
      ))}
    </>
  );
}
