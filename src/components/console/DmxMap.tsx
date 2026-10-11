import { footprint, type PatchedFixture } from "@/lib/dmx";

/** 512-channel universe map: shows each fixture's footprint, overlaps in red, planned patch as outline. */
export function DmxMap({ fixtures, universe, planned = [] }: { fixtures: PatchedFixture[]; universe: number; planned?: { address: number; channels: number }[] }) {
  const inU = fixtures.filter((f) => f.universe === universe);
  const owners: number[][] = Array.from({ length: 513 }, () => []);
  inU.forEach((f, i) => {
    for (let c = f.address; c < f.address + footprint(f) && c <= 512; c++) owners[c]!.push(i);
  });
  const plannedSet = new Set<number>();
  planned.forEach((p) => { for (let c = p.address; c < p.address + p.channels && c <= 512; c++) plannedSet.add(c); });
  const used = owners.filter((o) => o.length > 0).length;
  const clashes = owners.filter((o) => o.length > 1).length + [...plannedSet].filter((c) => owners[c]!.length > 0).length;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Universe {universe} · {used}/512 used</span>
        <span className={clashes ? "font-bold text-destructive" : "text-success"}>{clashes ? `${clashes} ch clash` : "No clashes"}</span>
      </div>
      <div className="grid grid-cols-[repeat(32,minmax(0,1fr))] gap-px rounded-md bg-border p-px">
        {Array.from({ length: 512 }, (_, k) => {
          const ch = k + 1;
          const o = owners[ch]!;
          const isPlan = plannedSet.has(ch);
          const clash = o.length > 1 || (isPlan && o.length > 0);
          const f = o.length ? inU[o[0]!] : undefined;
          const start = f && f.address === ch;
          const bg = clash
            ? "var(--color-destructive)"
            : f
              ? `hsl(${(o[0]! * 47) % 360} 70% ${start ? 62 : 45}%)`
              : isPlan
                ? "color-mix(in oklab, var(--color-primary) 55%, transparent)"
                : "var(--color-surface-elevated)";
          return (
            <div key={ch} title={`${ch}${f ? ` · ${o.map((i) => inU[i]!.name).join(" + ")}` : isPlan ? " · new" : ""}`}
              className="aspect-square" style={{ background: bg }} />
          );
        })}
      </div>
      {inU.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {inU.slice(0, 24).map((f, i) => (
            <span key={f.uid} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: `hsl(${(i * 47) % 360} 70% 55%)` }} />
              {f.name} {f.address}–{f.address + footprint(f) - 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
