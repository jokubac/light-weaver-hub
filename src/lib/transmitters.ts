// CRMX / wireless DMX transmitter library. Used to auto-map app universes to the
// transmitter's numbering and colour channel order. Values are typical defaults —
// check the transmitter's own manual/web page before a shoot.

export type ColorOrder = "RGB" | "GRB" | "BGR" | "RBG";

export interface Transmitter {
  id: string;
  brand: string;
  model: string;
  universes: number;
  protocols: ("artnet" | "sacn")[];
  /** universe number the transmitter's first input listens on (Art-Net often 0, sACN 1) */
  artnetStart: number;
  sacnStart: number;
  radio: string[];
  order: ColorOrder;
}

const T = (brand: string, model: string, universes: number, radio: string[], o: Partial<Transmitter> = {}): Transmitter => ({
  id: `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  brand, model, universes, radio, protocols: ["artnet", "sacn"], artnetStart: 0, sacnStart: 1, order: "RGB", ...o,
});

export const TRANSMITTERS: Transmitter[] = [
  T("LumenRadio", "CRMX Stardust", 8, ["CRMX Classic", "CRMX2"]),
  T("LumenRadio", "Aurora Multiverse", 4, ["CRMX2", "CRMX Classic"]),
  T("LumenRadio", "Moon Multiverse", 4, ["CRMX2"]),
  T("Astera", "ART7 AsteraBox", 1, ["CRMX", "Astera Wireless"], { artnetStart: 0 }),
  T("Astera", "ART7 Ethernet", 2, ["CRMX", "Astera Wireless"]),
  T("Ratpac", "AKS Mini CRMX", 1, ["CRMX Classic"]),
  T("Ratpac", "Cintenna CRMX", 2, ["CRMX Classic", "CRMX2"]),
  T("DMXking", "eDMX1 MAX TX CRMX", 1, ["CRMX Classic"], { artnetStart: 0 }),
  T("DMXking", "eDMX4 MAX", 4, ["wired DMX"]),
  T("Cinelex", "SkyBolt CRMX", 1, ["CRMX Classic"]),
  T("Lightbridge", "C-DMX TX", 2, ["CRMX"]),
  T("Swisson", "XND-4 + TX", 4, ["CRMX"]),
  T("City Theatrical", "Multiverse SHoW Baby", 2, ["Multiverse", "CRMX"]),
  T("City Theatrical", "Multiverse Transmitter", 4, ["Multiverse", "CRMX"]),
  T("Wireless Solution", "BlackBox F-1 G5", 1, ["W-DMX G5", "CRMX"]),
  T("Wireless Solution", "Rack Mount R-512 G4S", 1, ["W-DMX G4S"]),
  T("Exalux", "Connect One", 1, ["CRMX"], { artnetStart: 0, sacnStart: 1 }),
  T("Exalux", "Connect+", 2, ["CRMX"], { artnetStart: 0, sacnStart: 1 }),
  T("Ratpac", "Ratpac Dimmer DMX Pro", 1, ["CRMX"], { protocols: ["artnet"] }),
  T("Aputure", "Sidus Link Bridge", 1, ["CRMX", "Sidus Mesh"], { protocols: ["artnet", "sacn"] }),
  T("Nanlite", "NanLink Box WS-TB-1", 1, ["NanLink", "CRMX"]),
  T("Obsidian", "RDMX Transmitter", 1, ["CRMX"]),
  T("Generic", "Art-Net → CRMX (GRB pixels)", 1, ["CRMX"], { order: "GRB" }),
];

export const getTransmitter = (id?: string) => TRANSMITTERS.find((t) => t.id === id);

/** Reorders an [r,g,b] triple to the transmitter's channel order. */
export function reorder(c: [number, number, number], order: ColorOrder): [number, number, number] {
  const [r, g, b] = c;
  switch (order) {
    case "GRB": return [g, r, b];
    case "BGR": return [b, g, r];
    case "RBG": return [r, b, g];
    default: return c;
  }
}
