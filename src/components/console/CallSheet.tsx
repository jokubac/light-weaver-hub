// Gaffer call sheet / rental order: power load balancing, generator sizing,
// an editable equipment list and a battery charging plan — opened from the Patch page.
import { Fragment as Frag, useMemo, useState } from "react";
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "./NumberField";
import type { PatchedFixture } from "@/lib/dmx";
import { buildCallSheet, fmtHours, type EquipmentLine } from "@/lib/callsheet";
import { EQUIPMENT_CATALOGUE, type CatalogueNode } from "@/lib/equipment-catalogue";
import type { CallSheetData } from "@/lib/store";

const CATEGORY_LABEL: Record<EquipmentLine["category"], string> = {
  fixture: "Fixtures", power: "Cables & power", data: "DMX & data", stand: "Stands", grip: "Grip", modifier: "Modifiers", custom: "Other",
};
const GROUP_ORDER = ["Fixtures", ...EQUIPMENT_CATALOGUE.map((c) => c.name), "Other"];
type Line = { id: string; label: string; group: string; sub?: string; qty: number; custom?: boolean };

export function CallSheet({ title, fixtures, onClose, data = {}, onData, initialView = "call" }: { title: string; fixtures: PatchedFixture[]; onClose: () => void; data?: CallSheetData; onData?: (d: CallSheetData) => void; initialView?: "call" | "equipment" }) {
  const [d, setD] = useState<CallSheetData>(data);
  const upd = (patch: Partial<CallSheetData>) => setD((prev) => { const next = { ...prev, ...patch }; onData?.(next); return next; });
  const production = d.production ?? title, date = d.date ?? new Date().toISOString().slice(0, 10), location = d.location ?? "", gaffer = d.gaffer ?? "", shiftHours = d.shiftHours ?? 12;
  const setProduction = (v: string) => upd({ production: v }), setDate = (v: string) => upd({ date: v }), setLocation = (v: string) => upd({ location: v }), setGaffer = (v: string) => upd({ gaffer: v }), setShiftHours = (v: number) => upd({ shiftHours: v });

  const base = useMemo(() => buildCallSheet(fixtures, { production, date, location, gaffer, shiftHours }), [fixtures, production, date, location, gaffer, shiftHours]);
  const custom = d.custom ?? [];
  const removed = d.removed ?? [];

  const equipment: Line[] = useMemo(() => {
    const lines: Line[] = base.equipment.filter((l) => !removed.includes(l.id)).map((l) => ({ id: l.id, label: l.label, group: CATEGORY_LABEL[l.category], qty: d.qty?.[l.id] ?? l.qty }));
    return [...lines, ...custom.map((c) => { const [g, sub] = c.group.split(" › "); return { ...c, group: g!, sub, custom: true }; })];
  }, [base.equipment, d.qty, removed, custom]);

  const addCustom = () => {
    const label = prompt("Custom item name");
    if (!label?.trim()) return;
    upd({ custom: [...custom, { id: `custom-${Date.now()}`, label: label.trim(), group: "Other", qty: 1 }] });
  };
  const removeLine = (l: Line) => (l.custom ? upd({ custom: custom.filter((c) => c.id !== l.id) }) : upd({ removed: [...removed, l.id] }));
  const setQty = (id: string, qty: number) => {
    if (custom.some((l) => l.id === id)) upd({ custom: custom.map((l) => (l.id === id ? { ...l, qty } : l)) });
    else upd({ qty: { ...d.qty, [id]: qty } });
  };
  const setCount = (key: "packed" | "returned", id: string, n: number) => upd({ [key]: { ...d[key], [id]: n } });

  const groups = [...new Set(equipment.map((l) => l.group))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 99) % 99 - (GROUP_ORDER.indexOf(b) + 99) % 99);
  const grouped = groups.map((g) => ({ cat: g, lines: equipment.filter((l) => l.group === g).sort((a, b) => (a.sub ?? "").localeCompare(b.sub ?? "")) }));
  const [view, setView] = useState<"call" | "equipment">(initialView);
  const [catOpen, setCatOpen] = useState(false);
  const [catQ, setCatQ] = useState("");
  const [path, setPath] = useState<string[]>([]);
  const node: CatalogueNode | undefined = path.reduce<CatalogueNode | undefined>((n, name) => (n ? n.children?.find((c) => c.name === name) : EQUIPMENT_CATALOGUE.find((c) => c.name === name)), undefined);
  const searchHits = useMemo(() => {
    const q = catQ.trim().toLowerCase(); if (!q) return [];
    return EQUIPMENT_CATALOGUE.flatMap((c) => (c.children ?? []).flatMap((s) => (s.items ?? []).filter((i) => `${c.name} ${s.name} ${i}`.toLowerCase().includes(q)).map((i) => ({ group: c.name, sub: s.name, item: i })))).slice(0, 100);
  }, [catQ]);
  const addCatalogue = (group: string, sub: string, item: string) => {
    const id = `cat-${group}-${sub}-${item}`;
    upd({ custom: custom.some((l) => l.id === id) ? custom.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l)) : [...custom, { id, label: item, group: `${group} › ${sub}`, qty: 1 }] });
  };
  const qtyOf = (group: string, sub: string, item: string) => custom.find((l) => l.id === `cat-${group}-${sub}-${item}`)?.qty ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3 print:hidden">
        <button onClick={onClose} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Close call sheet"><ArrowLeft className="h-5 w-5" /></button>
        <div className="mr-auto min-w-0"><div className="font-display text-lg font-semibold">{view === "call" ? "Call sheet" : "Equipment list"}</div><div className="truncate text-xs text-muted-foreground">{title}</div></div>
        <div className="flex rounded-lg bg-surface-elevated p-1 text-xs font-semibold">
          {(["call", "equipment"] as const).map((v) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-primary text-primary-foreground" : ""}`}>{v === "call" ? "Call sheet" : "Equipment list"}</button>)}
        </div>
        <Button variant="secondary" onClick={() => window.print()} title="Print, or choose “Save as PDF” in the print dialog"><Printer />Print / PDF</Button>
      </div>
      <div className="callsheet-print min-h-0 flex-1 overflow-auto p-4">
        <h1 className="mb-4 hidden font-display text-2xl font-bold print:block">{view === "call" ? "Call sheet" : "Equipment list"} — {production}</h1>
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 print:border-0 print:p-0">
            <Field label="Production"><input value={production} onChange={(e) => setProduction(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></Field>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></Field>
            <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="—" /></Field>
            <Field label="Gaffer"><input value={gaffer} onChange={(e) => setGaffer(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="—" /></Field>
            <Field label="Shift (hours)"><NumberField integer min={1} max={48} value={shiftHours} onChange={(v) => v !== undefined && setShiftHours(v)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center" /></Field>
          </section>

          {view === "call" && <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Power</h2>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-2">Phase</th><th className="pr-2">Fixtures</th><th className="pr-2 text-right">Watts</th><th className="pr-2 text-right">Amps (230V)</th>
                </tr></thead>
                <tbody>
                  {base.power.phases.map((p) => (
                    <tr key={p.phase} className="border-b border-border/60">
                      <td className="py-1.5 pr-2 font-semibold">{p.phase}</td>
                      <td className="pr-2 text-muted-foreground">{p.fixtures.length ? p.fixtures.map((f) => f.name).join(", ") : "—"}</td>
                      <td className="pr-2 text-right font-mono">{Math.round(p.watts)} W</td>
                      <td className="pr-2 text-right font-mono">{p.amps.toFixed(1)} A</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1.5 pr-2" colSpan={2}>Total</td>
                    <td className="pr-2 text-right font-mono">{Math.round(base.power.totalW)} W</td>
                    <td className="pr-2 text-right font-mono">{base.power.totalA230.toFixed(1)} A</td>
                  </tr>
                </tbody>
              </table>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Total load:</span> <span className="font-mono font-semibold">{base.power.totalKw.toFixed(2)} kW</span></div>
                <div><span className="text-muted-foreground">Phase imbalance:</span> <span className="font-mono font-semibold">{base.power.imbalancePct.toFixed(0)}%</span></div>
                <div className="rounded-lg bg-surface-elevated p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Generator suggestion</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-primary">{base.power.generatorKva} kVA</div>
                  <div className="text-xs text-muted-foreground">{base.power.generatorNote}</div>
                </div>
              </div>
            </div>
          </section>}

          <section className="rounded-xl border border-border bg-surface p-4 print:border-0 print:p-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">Equipment list <span className="text-xs font-normal text-muted-foreground">({equipment.reduce((a, l) => a + l.qty, 0)} items)</span></h2>
              <div className="flex gap-2 print:hidden">
                <Button variant="secondary" size="sm" onClick={() => setCatOpen((o) => !o)}><Plus className="h-3.5 w-3.5" />Catalogue</Button>
                <Button variant="secondary" size="sm" onClick={addCustom}><Plus className="h-3.5 w-3.5" />Custom item</Button>
              </div>
            </div>
            {catOpen && (
              <div className="mb-4 space-y-2 rounded-lg bg-surface-elevated p-3 print:hidden">
                <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Search catalogue: barrel clamp, 8x8, 32A, blackwrap…" className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                {catQ.trim() ? (
                  <div className="max-h-72 space-y-0.5 overflow-auto">
                    {searchHits.map((h) => (
                      <button key={`${h.group}-${h.sub}-${h.item}`} onClick={() => addCatalogue(h.group, h.sub, h.item)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface">
                        <span className="truncate">{h.item}</span><span className="shrink-0 text-[10px] text-muted-foreground">{h.group} › {h.sub} +</span>
                      </button>
                    ))}
                    {searchHits.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Nothing found</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <button onClick={() => setPath([])} className={`rounded px-2 py-1 font-semibold ${path.length ? "text-primary" : ""}`}>All</button>
                      {path.map((p, i) => <Frag key={p}><span className="text-muted-foreground">›</span><button onClick={() => setPath(path.slice(0, i + 1))} className="rounded px-2 py-1 font-semibold text-primary">{p}</button></Frag>)}
                    </div>
                    <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-auto sm:grid-cols-3">
                      {(node ? node.children ?? [] : path.length ? [] : EQUIPMENT_CATALOGUE).map((c) => (
                        <button key={c.name} onClick={() => setPath([...path, c.name])} className="flex items-center justify-between rounded-md bg-surface px-3 py-2.5 text-left text-sm font-semibold active:scale-95">
                          <span className="truncate">{c.name}</span><span className="text-muted-foreground">›</span>
                        </button>
                      ))}
                      {node?.items?.map((it) => { const n = qtyOf(path[0]!, path[1]!, it); return (
                        <button key={it} onClick={() => addCatalogue(path[0]!, path[1]!, it)} className={`flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-xs active:scale-95 ${n ? "bg-primary/15 text-foreground" : "bg-surface"}`}>
                          <span className="truncate">{it}</span><span className="shrink-0 font-mono text-[10px] text-muted-foreground">{n ? `×${n}` : "+"}</span>
                        </button>
                      ); })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {grouped.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing on the list yet — patch lights or add from the catalogue.</p> : (
              <table className="equip-table w-full border-collapse text-sm">
                <thead><tr className="border-b-2 border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 py-1.5 pr-2">#</th><th className="pr-2">Item</th><th className="w-20 pr-2 text-right">Qty</th><th className="w-24 pr-2 text-center">Packed</th><th className="w-24 pr-2 text-center">Returned</th><th className="w-8 print:hidden"></th>
                </tr></thead>
                <tbody>
                  {(() => { let n = 0; return grouped.map(({ cat, lines }) => (
                    <Frag key={cat}>
                      <tr className="bg-surface-elevated print:bg-transparent"><td colSpan={6} className="px-1 py-1.5 text-[11px] font-bold uppercase tracking-wider">{cat}</td></tr>
                      {lines.map((l) => { const packed = d.packed?.[l.id] ?? 0, ret = d.returned?.[l.id] ?? 0; return (
                        <tr key={l.id} className="border-b border-border/60 break-inside-avoid">
                          <td className="py-1 pr-2 font-mono text-xs text-muted-foreground">{++n}</td>
                          <td className="py-1 pr-2">{l.label}{l.sub && <span className="ml-1.5 text-[10px] text-muted-foreground">{l.sub}</span>}</td>
                          <td className="py-1 pr-2 text-right">
                            <NumberField integer min={0} max={999} value={l.qty} onChange={(v) => v !== undefined && setQty(l.id, v)} className="w-16 rounded-md border border-input bg-surface-elevated px-2 py-1 text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring print:hidden" />
                            <span className="hidden font-mono print:inline">{l.qty}</span>
                          </td>
                          <td className="text-center"><CountCell n={packed} qty={l.qty} label={`Packed ${l.label}`} onChange={(n) => setCount("packed", l.id, n)} /></td>
                          <td className="text-center"><CountCell n={ret} qty={l.qty} label={`Returned ${l.label}`} onChange={(n) => setCount("returned", l.id, n)} /></td>
                          <td className="py-1 print:hidden">
                            <button onClick={() => removeLine(l)} className="text-muted-foreground" aria-label={`Remove ${l.label}`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </td>
                        </tr>
                      ); })}
                    </Frag>
                  )); })()}
                </tbody>
              </table>
            )}
            {view === "equipment" && (
              <div className="mt-8 hidden grid-cols-2 gap-8 text-xs print:grid">
                <div className="border-t border-muted-foreground pt-1">Issued by (rental house)</div>
                <div className="border-t border-muted-foreground pt-1">Received by (gaffer)</div>
              </div>
            )}
          </section>

          {view === "call" && <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Battery charging plan <span className="text-xs font-normal text-muted-foreground">(shift: {shiftHours}h)</span></h2>
            {base.battery.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No battery-powered fixtures on batteries in this patch.</p> : (
              <table className="w-full border-collapse text-sm">
                <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-2">Fixture</th><th className="pr-2 text-right">Draw</th><th className="pr-2 text-right">Runtime / battery</th><th className="pr-2 text-right">Batteries for shift</th><th className="pr-2 text-right">Swaps</th>
                </tr></thead>
                <tbody>
                  {base.battery.map((b) => (
                    <tr key={b.uid} className="border-b border-border/60">
                      <td className="py-1.5 pr-2">{b.name}</td>
                      <td className="pr-2 text-right font-mono">{Math.round(b.watts)} W</td>
                      <td className="pr-2 text-right font-mono">{fmtHours(b.runtimeHours)}</td>
                      <td className="pr-2 text-right font-mono">{b.batteriesPerShift}</td>
                      <td className="pr-2 text-right font-mono">{b.swaps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>}
        </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .callsheet-print { overflow: visible !important; }
          body * { visibility: hidden; }
          .callsheet-print, .callsheet-print * { visibility: visible; color: #000 !important; }
          .callsheet-print { position: absolute; inset: 0; padding: 0; background: #fff; }
          .callsheet-print section { border: 0 !important; background: transparent !important; break-inside: auto; }
          .callsheet-print table { font-size: 10pt; }
          .callsheet-print th, .callsheet-print td { border-bottom: 0.5pt solid #999 !important; padding: 3pt 4pt !important; }
          .callsheet-print thead th { border-bottom: 1.2pt solid #000 !important; }
          .callsheet-print tr { break-inside: avoid; }
          .callsheet-print span.rounded-sm { border-color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}<div className="mt-1 normal-case">{children}</div></label>;
}

/** Tap the box to tick all / clear; edit the number for partial counts. */
function CountCell({ n, qty, label, onChange }: { n: number; qty: number; label: string; onChange: (n: number) => void }) {
  const done = qty > 0 && n >= qty;
  return (
    <div className="inline-flex items-center gap-1">
      <button onClick={() => onChange(done ? 0 : qty)} aria-label={label} aria-pressed={done}
        className={`flex h-5 w-5 items-center justify-center rounded-sm border text-[10px] font-bold ${done ? "border-success bg-success text-primary-foreground" : n > 0 ? "border-warning text-warning" : "border-muted-foreground"}`}>{done ? "✓" : ""}</button>
      <NumberField integer min={0} max={999} value={n} onChange={(v) => v !== undefined && onChange(v)} className={`w-10 rounded border border-input bg-surface-elevated px-1 py-0.5 text-center font-mono text-xs focus:outline-none print:hidden ${done ? "text-success" : n > 0 ? "text-warning" : "text-muted-foreground"}`} />
      <span className="hidden font-mono text-xs print:inline">{n || ""}</span>
    </div>
  );
}
