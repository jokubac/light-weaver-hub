import { getDef, type PatchedFixture } from "@/lib/dmx";
// Static imports: installed apps only contain files the offline crawler can find, so avoid lazy PDF chunks.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

async function logoPng(): Promise<string | null> {
  try {
    const img = new Image(); img.src = "/nox-logo.svg"; await img.decode();
    const c = document.createElement("canvas"); c.width = 128; c.height = 128;
    c.getContext("2d")!.drawImage(img, 0, 0, 128, 128);
    return c.toDataURL("image/png");
  } catch { return null; }
}

/** Compact A4 patch sheet: # · Name · Fixture · Mode · Univ · DMX · Ch, with the NOX logo. */
export async function buildPatchPdf(title: string, fixtures: PatchedFixture[]): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await logoPng();
  if (logo) doc.addImage(logo, "PNG", 12, 10, 10, 10);
  doc.setFontSize(13); doc.text(`${title} — Patch sheet`, logo ? 25 : 12, 17);
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`${fixtures.length} fixtures · ${new Date().toLocaleDateString()}`, 198, 17, { align: "right" });
  const body = fixtures.map((f, i) => {
    const d = getDef(f.defId); const m = d.modes[f.modeIdx]; const ch = m?.channels ?? 1;
    return [i + 1, f.name, `${d.brand} ${d.model}`, m?.name ?? "", f.universe, `${f.address}–${f.address + ch - 1}`, ch];
  });
  autoTable(doc, {
    startY: 24, head: [["#", "Name", "Fixture", "Mode", "Univ", "DMX", "Ch"]], body,
    styles: { fontSize: 7.5, cellPadding: 1.2 }, headStyles: { fillColor: [30, 30, 30] },
    margin: { left: 12, right: 12 },
  });
  return doc.output("blob");
}
