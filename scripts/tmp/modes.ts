import { FIXTURE_LIBRARY } from "@/lib/dmx";
import { isPixelFixture, pixelGrid } from "@/lib/pixels";
for (const id of ["gdtf-creamsource-vortex-8", "gdtf-astera-led-technology-fp1-titan-tube"]) {
  const d = FIXTURE_LIBRARY.find((x) => x.id === id);
  console.log("==", id, d ? d.modes.length : "MISSING");
  d?.modes.forEach((m, i) => {
    const fake = { uid: "u", defId: id, modeIdx: i, name: "n", universe: 1, address: 1, intensity: 1, cct: 0.5, gm: 0, hue: 0, saturation: 0, crossfade: 0, cctOnly: false, fx: {} as never } as never;
    if (isPixelFixture(fake)) {
      const [c, r] = pixelGrid(fake);
      console.log("  ", i, m.name, m.channels, "grid", c + "x" + r);
    }
  });
}
