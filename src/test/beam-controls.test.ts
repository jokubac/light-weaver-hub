import { describe, expect, it } from "vitest";
import { parseDescriptionXml } from "@/lib/gdtf";

const xml = `<GDTF><FixtureType Manufacturer="Test" Name="Spot"><DMXModes><DMXMode Name="Std"><DMXChannels>
<DMXChannel Offset="1,2"><LogicalChannel Attribute="Pan"><ChannelFunction Default="32768/2"/></LogicalChannel></DMXChannel>
<DMXChannel Offset="3"><LogicalChannel Attribute="Shutter1"><ChannelFunction Default="255/1"><ChannelSet Name="Closed" DMXFrom="0/1"/><ChannelSet Name="Open" DMXFrom="250/1"/></ChannelFunction></LogicalChannel></DMXChannel>
<DMXChannel Offset="4"><LogicalChannel Attribute="Gobo1"><ChannelFunction><ChannelSet Name="Open" DMXFrom="0/1"/><ChannelSet Name="Star" DMXFrom="20/1"/></ChannelFunction></LogicalChannel></DMXChannel>
<DMXChannel Offset="5"><LogicalChannel Attribute="Blade1A"><ChannelFunction/></LogicalChannel></DMXChannel>
<DMXChannel Offset="6"><LogicalChannel Attribute="Dimmer"><ChannelFunction/></LogicalChannel></DMXChannel>
</DMXChannels></DMXMode></DMXModes></FixtureType></GDTF>`;

describe("moving-head channels", () => {
  const map = parseDescriptionXml(xml)!.modes[0]!.channelMap!;
  it("reads pan as 16-bit with centre default", () => {
    expect(map[0]).toMatchObject({ attr: "Pan", home: 0.502 });
    expect(map[1]).toMatchObject({ attr: "Pan", fine: true });
  });
  it("keeps shutter open by default and lists named positions", () => {
    expect(map[2]!.attr).toBe("Strobe");
    expect(map[2]!.home).toBe(1);
    expect(map[2]!.slots!.map((s) => s.name)).toEqual(["Closed", "Open"]);
  });
  it("lists gobo names and framing blades", () => {
    expect(map[3]!.slots!.map((s) => s.name)).toEqual(["Open", "Star"]);
    expect(map[4]!.attr).toBe("Blade1A");
  });
});
