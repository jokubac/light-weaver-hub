// Gaffer call sheet / rental order: power load balancing, generator sizing,
// an editable equipment list and a battery charging plan — opened from the Patch page.
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "./NumberField";
import type { PatchedFixture } from "@/lib/dmx";
import { buildCallSheet, fmtHours, type EquipmentLine } from "@/lib/callsheet";

const CATEGORY_LABEL: Record<EquipmentLine["category"], string> = {
  fixture: "Fixtures", power: "Power & cabling", data: "DMX / wireless", stand: "Stands & rigging", grip: "Grip", modifier: "Modifiers", custom: "Other",
};
const CATEGORY_ORDER: EquipmentLine["category"][] = ["fixture", "power", "data", "stand", "modifier", "grip", "custom"];

export function CallSheet({ title, fixtures, onClose }: { title: string; fixtures: PatchedFixture[]; onClose: () => void }) {
  const [production, setProduction] = useState(title);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [gaffer, setGaffer] = useState("");
  const [shiftHours, setShiftHours] = useState(12);

  const base = useMemo(() => buildCallSheet(fixtures, { production, date, location, gaffer, shiftHours }), [fixtures, production, date, location, gaffer, shiftHours]);

  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [custom, setCustom] = useState<EquipmentLine[]>([]);

  const equipment = useMemo(() => {
    const lines = base.equipment.filter((l) => !removed.includes(l.id)).map((l) => ({ ...l, qty: qtyOverrides[l.id] ?? l.qty }));
    return [...lines, ...custom];
  }, [base.equipment, qtyOverrides, removed, custom]);

  const addCustom = () => {
    const label = prompt("Custom item name");
    if (!label?.trim()) return;
    setCustom((c) => [...c, { id: `custom-${Date.now()}`, label: label.trim(), category: "custom", qty: 1 }]);
  };
  const removeCustom = (id: string) => setCustom((c) => c.filter((l) => l.id !== id));
  const setQty = (id: string, qty: number) => {
    if (custom.some((l) => l.id === id)) setCustom((c) => c.map((l) => (l.id === id ? { ...l, qty } : l)));
    else setQtyOverrides((o) => ({ ...o, [id]: qty }));
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, lines: equipment.filter((l) => l.category === cat) })).filter((g) => g.lines.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3 print:hidden">
        <button onClick={onClose} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Close call sheet"><ArrowLeft className="h-5 w-5" /></button>
        <div className="mr-auto min-w-0"><div className="font-display text-lg font-semibold">Call sheet</div><div className="truncate text-xs text-muted-foreground">{title}</div></div>
        <Button variant="secondary" onClick={() => window.print()} title="Print, or choose “Save as PDF” in the print dialog"><Printer />Print / PDF</Button>
      </div>
      <div className="callsheet-print min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 print:border-0 print:p-0">
            <Field label="Production"><input value={production} onChange={(e) => setProduction(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></Field>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" /></Field>
            <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="—" /></Field>
            <Field label="Gaffer"><input value={gaffer} onChange={(e) => setGaffer(e.target.value)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="—" /></Field>
            <Field label="Shift (hours)"><NumberField integer min={1} max={48} value={shiftHours} onChange={(v) => v !== undefined && setShiftHours(v)} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center" /></Field>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
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
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Equipment list</h2>
              <Button variant="secondary" size="sm" onClick={addCustom} className="print:hidden"><Plus className="h-3.5 w-3.5" />Add item</Button>
            </div>
            {grouped.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No fixtures patched yet.</p> : (
              <div className="space-y-4">
                {grouped.map(({ cat, lines }) => (
                  <div key={cat}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABEL[cat]}</div>
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {lines.map((l) => (
                          <tr key={l.id} className="border-b border-border/60">
                            <td className="py-1 pr-2">{l.label}</td>
                            <td className="w-20 py-1 pr-2 text-right">
                              <NumberField integer min={0} max={999} value={l.qty} onChange={(v) => v !== undefined && setQty(l.id, v)} className="w-16 rounded-md border border-input bg-surface-elevated px-2 py-1 text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring print:border-0 print:bg-transparent" />
                            </td>
                            <td className="w-8 py-1 print:hidden">
                              {custom.some((c) => c.id === l.id) ? (
                                <button onClick={() => removeCustom(l.id)} className="text-muted-foreground" aria-label={`Remove ${l.label}`}><Trash2 className="h-3.5 w-3.5" /></button>
                              ) : (
                                <button onClick={() => setRemoved((r) => [...r, l.id])} className="text-muted-foreground" aria-label={`Remove ${l.label}`}><Trash2 className="h-3.5 w-3.5" /></button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
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
          </section>
        </div>
      </div>
      <style>{`
        @media print {
          .callsheet-print { overflow: visible !important; }
          body * { visibility: hidden; }
          .callsheet-print, .callsheet-print * { visibility: visible; }
          .callsheet-print { position: absolute; inset: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}<div className="mt-1 normal-case">{children}</div></label>;
}
