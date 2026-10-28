import { VERIFIED_FIXTURES } from "@/lib/verified-fixtures";
for (const id of ["gdtf-creamsource-vortex-8", "gdtf-astera-led-technology-fp1-titan-tube"]) {
  const d = VERIFIED_FIXTURES.find((x) => x.id === id);
  console.log("==", id, d ? d.modes.length : "MISSING");
  d?.modes.forEach((m, i) => {
    if ((m.pixels ?? 0) > 1) console.log("  ", i, m.name, "ch", m.channels, "px", m.pixels, "grid", JSON.stringify(m.grid ?? null));
  });
}
