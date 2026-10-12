import { describe, expect, it } from "vitest";
import { parseDescriptionXml } from "@/lib/gdtf";

const SYNTHETIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.1">
  <FixtureType Name="Spacelight" ShortName="SPL" Manufacturer="Acme" FixtureTypeID="00000000-0000-0000-0000-000000000000">
    <DMXModes>
      <DMXMode Name="RGBW 8-bit">
        <DMXChannels>
          <DMXChannel Offset="1">
            <LogicalChannel Attribute="Dimmer" />
          </DMXChannel>
          <DMXChannel Offset="2">
            <LogicalChannel Attribute="ColorAdd_R" />
          </DMXChannel>
          <DMXChannel Offset="3">
            <LogicalChannel Attribute="ColorAdd_G" />
          </DMXChannel>
          <DMXChannel Offset="4">
            <LogicalChannel Attribute="ColorAdd_B" />
          </DMXChannel>
          <DMXChannel Offset="5">
            <LogicalChannel Attribute="ColorAdd_W" />
          </DMXChannel>
        </DMXChannels>
      </DMXMode>
      <DMXMode Name="HSB">
        <DMXChannels>
          <DMXChannel Offset="1">
            <LogicalChannel Attribute="HSB_Hue" />
          </DMXChannel>
          <DMXChannel Offset="2">
            <LogicalChannel Attribute="HSB_Saturation" />
          </DMXChannel>
          <DMXChannel Offset="None">
            <LogicalChannel Attribute="Pan" />
          </DMXChannel>
        </DMXChannels>
      </DMXMode>
    </DMXModes>
  </FixtureType>
</GDTF>`;

describe("parseDescriptionXml", () => {
  it("parses manufacturer, model and modes from a synthetic description.xml", () => {
    const def = parseDescriptionXml(SYNTHETIC_XML);
    expect(def).not.toBeNull();
    expect(def!.brand).toBe("Acme");
    expect(def!.model).toBe("Spacelight");
    expect(def!.id).toBe("gdtf-acme-spacelight");
    expect(def!.modes).toHaveLength(2);
  });

  it("recognises the RGBW channel sequence as the built-in rgbw kind", () => {
    const def = parseDescriptionXml(SYNTHETIC_XML)!;
    const rgbw = def.modes.find((m) => m.name === "RGBW 8-bit")!;
    expect(rgbw.channels).toBe(5);
    expect(rgbw.kind).toBe("rgbw");
    expect(rgbw.channelMap).toBeUndefined();
  });

  it("drops channels with Offset=None and keeps the remaining ones in order", () => {
    const def = parseDescriptionXml(SYNTHETIC_XML)!;
    const hsb = def.modes.find((m) => m.name === "HSB")!;
    expect(hsb.channels).toBe(2);
  });

  it("returns null for invalid or unparseable XML", () => {
    expect(parseDescriptionXml("<not-gdtf/>")).toBeNull();
    expect(parseDescriptionXml("not even xml <<<")).toBeNull();
  });
});
