import { useRef, useState } from "react";
import { Lock } from "lucide-react";

const HOLD_MS = 1500;

/** Full-screen touch guard; hold the button for 1.5 s to unlock. DMX output keeps running. */
export function ScreenLock({ onUnlock }: { onUnlock: () => void }) {
  const [k, setK] = useState(0);
  const raf = useRef<number | null>(null);
  const start = () => {
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
      setK(p);
      if (p >= 1) { navigator.vibrate?.(20); onUnlock(); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; setK(0); };
  return (
    <div role="dialog" aria-label="Screen locked" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-sm select-none"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="text-center">
        <div className="text-lg font-black tracking-widest text-primary">SCREEN LOCKED</div>
        <div className="text-xs text-muted-foreground">Lights keep running. Hold to unlock.</div>
      </div>
      <button aria-label="Hold to unlock" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-primary bg-surface-elevated text-primary">
        <span className="absolute bottom-0 left-0 w-full bg-primary/40" style={{ height: `${k * 100}%` }} />
        <Lock className="relative h-8 w-8" />
      </button>
    </div>
  );
}
