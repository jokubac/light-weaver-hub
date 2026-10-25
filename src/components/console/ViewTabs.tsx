import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ViewTab {
  key: string;
  label: string;
  on: boolean;
  onClick: () => void;
}

/** View tabs with a sliding amber highlight that glides to the active tab. */
export function ViewTabs({ tabs }: { tabs: ViewTab[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; w: number } | null>(null);
  const active = tabs.findIndex((t) => t.on);

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.querySelectorAll<HTMLButtonElement>("button[data-tab]")[active];
      if (!el || !wrap.current) { setPos(null); return; }
      setPos({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [active, tabs.length]);

  return (
    <div ref={wrap} className="relative flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1">
      {pos && (
        <span aria-hidden="true"
          className="pointer-events-none absolute bottom-1 top-1 rounded-lg bg-amber-glow shadow-[0_0_16px_-2px_var(--amber-glow)] transition-[left,width] duration-200 ease-out"
          style={{ left: pos.x, width: pos.w }} />
      )}
      {tabs.map((t, i) => (
        <button key={t.key} type="button" data-tab={i} onClick={t.onClick} aria-pressed={t.on} className="nox-tab">{t.label}</button>
      ))}
    </div>
  );
}

// ResizeObserver re-measures on window resizes; suppress the unused-import lint for useEffect
void useEffect;
