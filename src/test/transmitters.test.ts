import { describe, expect, it } from "vitest";
import { detectTransmitter, getTransmitter } from "@/lib/transmitters";

describe("detectTransmitter", () => {
  it("recognises an Astera ART7 from its ArtPollReply name", () => {
    expect(detectTransmitter("AsteraBox ART7", 1)?.id).toBe("astera-art7-asterabox");
  });
  it("recognises Exalux Connect+ from its reported name", () => {
    expect(detectTransmitter("Exalux Connect+", 2)?.id).toBe("exalux-connect");
  });
  it("recognises Exalux Connect One", () => {
    expect(detectTransmitter("Exalux Connect One", 1)?.id).toBe("exalux-connect-one");
  });
  it("uses the advertised port count to tell ART7 AsteraBox from ART7 Ethernet", () => {
    expect(detectTransmitter("Astera ART7", 2)?.id).toBe("astera-art7-ethernet");
    expect(detectTransmitter("Astera ART7", 1)?.id).toBe("astera-art7-asterabox");
  });
  it("uses the advertised port count to tell eDMX1 from eDMX4", () => {
    expect(detectTransmitter("DMXking eDMX4 MAX", 4)?.id).toBe("dmxking-edmx4-max");
    expect(detectTransmitter("DMXking eDMX1 MAX TX", 1)?.id).toBe("dmxking-edmx1-max-tx-crmx");
  });
  it("recognises other common models without a port count", () => {
    expect(detectTransmitter("LumenRadio CRMX Stardust")?.id).toBe("lumenradio-crmx-stardust");
    expect(detectTransmitter("City Theatrical Multiverse SHoW Baby")?.id).toBe("city-theatrical-multiverse-show-baby");
    expect(detectTransmitter("Aputure Sidus Link Bridge")?.id).toBe("aputure-sidus-link-bridge");
  });
  it("returns undefined for unknown devices", () => {
    expect(detectTransmitter("Manual transmitter")).toBeUndefined();
    expect(detectTransmitter("Some Random Node", 3)).toBeUndefined();
  });
  it("every alias key points at a real profile", () => {
    // detectTransmitter skips profiles without aliases — a typo in an id would
    // silently disable detection for that model.
    for (const t of ["astera-art7-asterabox", "exalux-connect", "dmxking-edmx4-max"]) {
      expect(getTransmitter(t)).toBeDefined();
    }
  });
});
