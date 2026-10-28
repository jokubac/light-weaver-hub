import { VERIFIED_FIXTURES } from "@/lib/verified-fixtures";
const d = VERIFIED_FIXTURES.find((x) => x.id === "gdtf-astera-led-technology-fp1-titan-tube")!;
d.modes.forEach((m, i) => { if ((m.pixels ?? 0) > 1) console.log("  ", i, m.name, "ch", m.channels, "px", m.pixels, "grid", JSON.stringify(m.grid ?? null)); });
