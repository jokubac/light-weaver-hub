import { expect, it } from "vitest";
import { parseDescriptionXml } from "@/lib/gdtf";
import { buildUniverses } from "@/lib/output";
import { normalizeFixture } from "@/lib/dmx";
import { addCustomFixture } from "@/lib/custom-fixtures";

const xml = `<GDTF><FixtureType Name="Verified" Manufacturer="Test"><DMXModes><DMXMode Name="CCT exact"><DMXChannels>
<DMXChannel Offset="1"><LogicalChannel Attribute="Dimmer" /></DMXChannel>
<DMXChannel Offset="4"><LogicalChannel Attribute="CTC"><ChannelFunction PhysicalFrom="2800" PhysicalTo="10000" /></LogicalChannel></DMXChannel>
<DMXChannel Offset="7"><LogicalChannel Attribute="Fan" /></DMXChannel>
</DMXChannels></DMXMode></DMXModes></FixtureType></GDTF>`;
it("preserves absolute offsets, gaps and unknown channels in GDTF", () => {
  const def = parseDescriptionXml(xml);
  expect(def?.modes[0]?.channels).toBe(7);
  expect(def?.modes[0]?.channelMap?.map((c) => c.attr)).toEqual(["Dimmer", "Spare", "Spare", "CCT", "Spare", "Spare", "Spare"]);
  expect(def?.cctRange).toEqual([2800, 10000]);
});
it("encodes 6400K halfway across a declared 2800–10000K channel", () => {
  const def = parseDescriptionXml(xml);
  if (!def) throw new Error("GDTF parse failed");
  addCustomFixture(def);
  const f = normalizeFixture({ uid: "exact", defId: def.id, modeIdx: 0, universe: 1, address: 10, intensity: 1, cct: (6400 - 2000) / 8000 });
  const output = buildUniverses([f], 0, 1, new Map()).get(1);
  expect(output?.[12]).toBe(128);
  expect(output?.[10]).toBe(0);
});