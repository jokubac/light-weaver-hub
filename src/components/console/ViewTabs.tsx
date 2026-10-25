import { useLayoutEffect, useRef, useState } from "react";

export interface ViewTab {
  key: string;
  label: string;
  on: boolean;
  onClick: () => void;
}

/** View tabs with a sliding amber highlight that glides to the active tab.
 *  fill=true stretches the tabs evenly across the whole row width. */
export function ViewTabs({ tabs, fill = false }: { tabs: ViewTab[]; fill?: boolean }) {
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
    <div ref={wrap} className={`relative flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1${fill ? " min-w-0 flex-1" : ""}`}>
      {pos && (
        <span aria-hidden="true"
          className="pointer-events-none absolute bottom-1 top-1 rounded-lg bg-primary shadow-[0_4px_14px_-6px_color-mix(in_oklab,var(--primary)_75%,transparent)] transition-[left,width] duration-200 ease-out"
          style={{ left: pos.x, width: pos.w }} />
      )}
      {tabs.map((t, i) => (
        <button key={t.key} type="button" data-tab={i} onClick={t.onClick} aria-pressed={t.on} className={`nox-tab relative z-10${fill ? " nox-tab-fill" : ""}`}>{t.label}</button>
      ))}
    </div>
  );
}
