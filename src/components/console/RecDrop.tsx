import { useEffect, useRef, type ReactNode } from "react";

import { t as tr } from "@/lib/i18n";
/** REC dropdown in the FIXTURES bar — opens like + Group / + Look: record the selection, open the editor, play saved REC. */
export function RecDrop({ open, setOpen, playing, onEditor, children }: {
  open: boolean; setOpen: (o: boolean) => void; playing: boolean; onEditor: () => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open, setOpen]);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={tr("REC")} aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-elevated px-3 text-xs font-bold">
        <span className={`h-2.5 w-2.5 rounded-full bg-destructive ${playing ? "animate-pulse" : ""}`} />{tr("REC")}</button>
      {open && <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-80 space-y-3 overflow-auto rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
        <div className="flex gap-1.5">
          <button type="button" onClick={onEditor} className="ml-auto rounded-md border border-border bg-surface-elevated px-3 py-1.5 font-semibold">{tr("Open REC editor")}</button>
        </div>
        {children}
      </div>}
    </div>
  );
}
