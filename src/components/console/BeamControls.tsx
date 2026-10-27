import { BEAM_ATTRS, getMode, type BeamAttr, type ChannelMapEntry, type PatchedFixture } from "@/lib/dmx";
import { Control } from "./FixtureControls";
import { FramingPad } from "./FramingPad";

import { t as tr } from "@/lib/i18n";
type UpdEach = (fn: (f: PatchedFixture) => Partial<PatchedFixture>) => void;

const LABELS: Partial<Record<BeamAttr, string>> = {
  Strobe: "Shutter / Strobe", Zoom: "Zoom / Fresnel focus", GoboRot: "Gobo rotation", Gobo2: "Gobo 2", PrismRot: "Prism rotation", ShaperRot: "Framing rotation",
};
const label = (a: BeamAttr) => LABELS[a] ?? a.replace(/^Blade(\d)(A|B|Rot)$/, (_m, n, x) => `Blade ${n} ${x === "Rot" ? "rotation" : x}`);
const GROUPS: { title: string; attrs: BeamAttr[] }[] = [
  { title: "Position", attrs: ["Pan", "Tilt"] },
  { title: "Shutter", attrs: ["Strobe"] },
  { title: "Gobo", attrs: ["Gobo", "GoboRot", "Gobo2"] },
  { title: "Beam", attrs: ["Zoom", "Focus", "Iris", "Frost", "Prism", "PrismRot"] },
  { title: "Framing", attrs: BEAM_ATTRS.filter((a) => a.startsWith("Blade") || a === "ShaperRot") },
];

/** Channels of the selected light's mode that the Position & Beam panel can drive. */
export function beamChannels(f: PatchedFixture): Map<BeamAttr, ChannelMapEntry> {
  const out = new Map<BeamAttr, ChannelMapEntry>();
  for (const e of getMode(f).channelMap ?? []) {
    if (!e.fine && (BEAM_ATTRS as readonly string[]).includes(e.attr) && !out.has(e.attr as BeamAttr)) out.set(e.attr as BeamAttr, e);
  }
  return out;
}

export function BeamControls({ first, updateEach }: { first: PatchedFixture; updateEach: UpdEach }) {
  const chans = beamChannels(first);
  if (chans.size === 0) return null;
  const set = (a: BeamAttr, v: number | undefined) =>
    updateEach((f) => { const beam = { ...f.beam }; if (v === undefined) delete beam[a]; else beam[a] = v; return { beam }; });
  const value = (a: BeamAttr) => first.beam?.[a] ?? chans.get(a)?.home ?? 0;

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => {
        const attrs = g.attrs.filter((a) => chans.has(a));
        if (!attrs.length) return null;
        return (
          <div key={g.title} className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
              <button onClick={() => updateEach((f) => { const beam = { ...f.beam }; attrs.forEach((a) => delete beam[a]); return { beam }; })} className="rounded bg-surface-elevated px-2 py-0.5 normal-case">{tr("Reset")}</button>
            </div>
            {g.title === "Position" && <PanTiltPad pan={value("Pan")} tilt={value("Tilt")} hasPan={chans.has("Pan")} hasTilt={chans.has("Tilt")} set={set} />}
            {g.title === "Framing" && <FramingPad has={(a) => chans.has(a)} value={value} set={set} />}
            {attrs.map((a) => {
              const slots = chans.get(a)?.slots ?? [];
              const v = value(a);
              return (
                <div key={a} className="space-y-1.5">
                  <Control label={label(a)} value={v} display="%" onChange={(n) => set(a, n)} onReset={() => set(a, undefined)} />
                  {slots.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {slots.map((s, i) => {
                        const next = slots[i + 1]?.v ?? 1.01;
                        const active = first.beam?.[a] !== undefined && v >= s.v && v < next;
                        return <button key={s.name} onClick={() => set(a, s.v)} className={`rounded-md px-2 py-1 text-[11px] font-semibold active:scale-95 ${active ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{s.name}</button>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function PanTiltPad({ pan, tilt, hasPan, hasTilt, set }: { pan: number; tilt: number; hasPan: boolean; hasTilt: boolean; set: (a: BeamAttr, v: number | undefined) => void }) {
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.type === "pointermove") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    if (hasPan) set("Pan", x);
    if (hasTilt) set("Tilt", y);
  };
  return (
    <div
      aria-label={tr("Pan and tilt pad")}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={move}
      className="relative aspect-[2/1] w-full touch-none rounded-md border border-input bg-surface-elevated"
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div className="absolute h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-primary bg-primary/40" style={{ left: `${pan * 100}%`, bottom: `${tilt * 100}%` }} />
    </div>
  );
}
