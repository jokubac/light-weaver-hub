// Lights stocked by Lithuanian rental houses (arclight.lt LED/HMI/tungsten/fluo pages and
// cine.lt "Equipment → Lighting"), mapped to the closest DMX mode set. Tungsten, HMI and
// fluorescent units are controlled through a DMX dimmer or DMX ballast, so they get dimmer modes.

type Stock = "Arclight" | "Cinevera";
export interface RentalEntry { brand: string; models: string[]; modes: string; stock: Stock[] }

const A: Stock[] = ["Arclight"], C: Stock[] = ["Cinevera"], AC: Stock[] = ["Arclight", "Cinevera"];

export const RENTAL_FIXTURES: RentalEntry[] = [
  // LED — Arclight
  { brand: "ANSSO", models: ["LedPad Pro Gaffer 5600K"], modes: "DIM", stock: A },
  { brand: "Aputure", models: ["Amaran F21c"], modes: "APUTURE_COLOR", stock: A }, // superseded by the chart-built F21C
  { brand: "Aputure", models: ["LS 60x", "Amaran 100x", "Amaran F21x"], modes: "APUTURE_BI", stock: AC },
  { brand: "Aladdin", models: ["A-Lite Bi-colour", "Bi-Flex M7", "Bi-Flex 1", "EYE-Lite", "Fabric-Lite 350"], modes: "BI", stock: AC },
  { brand: "Arcball", models: ["Arcball 50W 19\" Bi-colour", "Arcball 100W 30\" Bi-colour"], modes: "BI", stock: A },
  { brand: "CBL", models: ["CBL1 Bi-colour"], modes: "BI", stock: A },
  { brand: "CINEFlex", models: ["LED 20×120 Bi-colour", "LED 40×60 Bi-colour"], modes: "BI", stock: A },
  { brand: "Creamsource", models: ["Micro"], modes: "CREAM_MICRO", stock: AC },
  { brand: "DMG Lumière", models: ["Lumière Mini", "Lumière SL1", "SUMO MAX", "DASH Pocket"], modes: "DMG", stock: A },
  { brand: "Dedolight", models: ["DLED 4.1 Bi-colour 3×40W"], modes: "BI", stock: A },
  { brand: "Exalux", models: ["2×4 Punch"], modes: "BI", stock: A },
  { brand: "Fiilex", models: ["G3 Color", "G6 Color"], modes: "GODOX_RGB", stock: A },
  { brand: "Flex LED", models: ["Airlight 40W Bi-colour", "Airlight 80W Bi-colour"], modes: "BI", stock: A },
  { brand: "Fomex", models: ["RollLite RL33 Bi-colour", "Flex 1×1 Bi-colour", "Flex 2×1 Bi-colour"], modes: "BI", stock: A },
  { brand: "Godox", models: ["Knowled AM1600R"], modes: "GODOX_RGB", stock: A },
  { brand: "Kino Flo", models: ["FreeStyle 41", "Celeb 200", "Celeb 400"], modes: "KINO", stock: A },
  { brand: "Lightstar", models: ["Airlite 1000W Bi-colour"], modes: "BI", stock: A },
  { brand: "Lightstar", models: ["LUXED P12 RGBW 1920W"], modes: "CHAUVET", stock: A },
  { brand: "LS", models: ["RGBW 150"], modes: "CHAUVET", stock: A },
  { brand: "LiteGear", models: ["LiteMat Plus 1", "LiteMat Plus 2L", "LiteMat Plus 4", "LiteStix Pro Hybrid"], modes: "BI", stock: AC },
  { brand: "LiteGear", models: ["LiteRibbon (DMX driver)"], modes: "DIM", stock: AC },
  { brand: "Litra", models: ["LitraPro Cube"], modes: "BI", stock: A },
  { brand: "Lupo", models: ["Superpanel RGBW"], modes: "GODOX_RGB", stock: A },
  { brand: "Nanlite", models: ["PavoSlim 240CL"], modes: "NANLITE_PAVO", stock: AC },
  { brand: "Nanlite", models: ["Forza 60C R"], modes: "NANLITE_PAVO", stock: C },
  { brand: "Nanlux", models: ["Evoke 600C", "Evoke 5000B"], modes: "NANLITE_BI", stock: A },
  { brand: "Generic", models: ["Ring light Halo 18 Bi-colour", "Ikan Canvas Round Bi-colour"], modes: "BI", stock: A },
  { brand: "Quasar Science", models: ["Q-LED Bi-colour 2ft", "Q-LED Bi-colour 4ft"], modes: "QUASAR", stock: A },
  { brand: "Philips", models: ["Hue (via DMX bridge)"], modes: "CHAUVET", stock: A },
  { brand: "Pocketlite", models: ["F7 RGBW"], modes: "CHAUVET", stock: A },
  { brand: "Velvet", models: ["Velvet 1 Bi-colour"], modes: "LITEPANELS", stock: A },
  { brand: "Generic", models: ["LED strip RGBW DMX driver 4×4A"], modes: "CHAUVET", stock: A },
  // LED — Cinevera
  { brand: "Carpetlight", models: ["CL88"], modes: "BI", stock: C },
  { brand: "Hive", models: ["Hornet 200-C", "Wasp 100-C"], modes: "GODOX_RGB", stock: C },
  // Fluorescent (DMX ballast)
  { brand: "Kino Flo", models: ["4Bank 120cm", "2Bank 120cm", "4Bank 60cm", "2Bank 60cm", "1×120cm", "1×240cm", "8×120cm", "Flathead 80", "Mega Single", "Micro Flo", "Mini Flo"], modes: "DIM", stock: AC },
  { brand: "Lithlight", models: ["C-880"], modes: "DIM", stock: A },
  // HMI (DMX ballast dimming)
  { brand: "ARRI HMI", models: ["ARRIMAX 18K", "M90", "M40", "M18", "M8", "ARRISUN 120", "ARRISUN 60", "ARRISUN 40", "ARRISUN 18", "ARRISUN 12", "Compact 12", "Compact 575", "Pocket PAR"], modes: "DIM", stock: AC },
  { brand: "K5600", models: ["Joker-Bug 800"], modes: "DIM", stock: C },
  { brand: "Dedolight", models: ["Octodome 400W HMI"], modes: "DIM", stock: C },
  // Tungsten (DMX dimmer)
  { brand: "ARRI Tungsten", models: ["150W", "300 Plus", "650 Plus", "1000 Plus", "2000 Junior", "5000 Junior", "T12 10/12kW", "T24 20/24kW", "ArriLite 750", "ArriLite 800", "ArriLite 1kW", "ArriLite 2kW"], modes: "DIM", stock: AC },
  { brand: "Tungsten", models: ["Dino 12kW", "Space light 6×1kW", "Jemball 2kW", "Jemball 4kW", "Jemball 6kW", "Jemball 8kW", "Jem 19\" 500W", "Jem 22\" 1000W", "Jem 30\" 2000W", "PAR 64", "PAR 64 Short", "Blonde 2000W", "Red Head 800W", "Desisti 300/500", "Desisti 1000", "Desisti 2000", "Desisti Giotto 1000W", "Pacific 1000W", "Rifa 55 500W", "Rifa 66 650W", "Rifa 88 1000W", "China ball", "Triolet 750W", "Octodome 1000"], modes: "DIM", stock: AC },
  { brand: "Dedolight", models: ["DLH 150W", "DLH 650 + Projector", "Panaura 5 1kW", "3×150W kit", "4×100W kit"], modes: "DIM", stock: AC },
  { brand: "ETC", models: ["Source Four 575 Baby", "Source Four 750 Zoom 25-50", "Source Four Followspot"], modes: "DIM", stock: AC },
  { brand: "Robert Juliat", models: ["Followspot"], modes: "DIM", stock: C },
];

/** Library entries that already existed and are also stocked by a rental house. */
export const RENTAL_ALIASES: Record<string, Stock[]> = {
  "arri-skypanel-s30-c": AC, "arri-skypanel-s60-c": AC, "arri-skypanel-s120-c": A, "arri-skypanel-s360-c": AC, "arri-skypanel-x": A, "arri-orbiter": A,
  "aputure-mc-pro": A, "aputure-amaran-f22c": A, "aputure-600c-pro": C, "aputure-600c-pro-ii": C, "aputure-ls-600x-pro": C, "aputure-ls-300d-ii": C,
  "astera-titan-tube": AC, "astera-helios-tube": AC, "astera-hyperion-tube": A, "astera-nyx-bulb": AC, "astera-ax3-lightdrop": A, "astera-ax9-powerpar": AC, "astera-ax1-pixeltube": C,
  "creamsource-vortex4": A, "creamsource-vortex8": AC, "kino-flo-select-30": A, "kino-flo-freestyle-21": C, "kino-flo-freestyle-31": C,
  "litegear-litemat-spectrum-4": A, "nanlite-pavotube-ii-30c": A, "nanlite-pavoslim-60c": AC, "nanlite-pavoslim-120c": AC, "nanlite-pavoslim-240c": C,
  "nanlite-forza-60": A, "nanlite-forza-60b": A, "nanlite-forza-60c": A, "nanlite-forza-300-ii": A,
  "nanlux-evoke-1200": A, "nanlux-evoke-1200b": AC, "nanlux-evoke-2400b": AC, "nanlux-evoke-150c": A, "nanlux-evoke-900c": A, "nanlux-dyno-1200c": A,
};

/** Lights with no DMX input (manual / Sidus Link Bluetooth only): hidden from PATCH, kept so saved patches still open. */
export const NO_DMX: string[] = ["aputure-mc", "aputure-accent-b7c", "aputure-ls-60x", "aputure-amaran-100x", "nanlite-pavotube-ii-6c"];

/** Guessed rental rows replaced by a chart-checked library entry: the old id stays (hidden) for saved patches,
 *  and its rental-house tag moves to the official entry. */
export const RENTAL_SUPERSEDED: Record<string, string> = {
  "fiilex-g3-color": "gdtf-fiilex-g3-color", "fiilex-g6-color": "gdtf-fiilex-g6-color",
  "nanlux-evoke-5000b": "gdtf-nanlux-evoke-5000b", "nanlite-forza-60c": "gdtf-nanlite-forza-60c", "aputure-amaran-f22c": "gdtf-aputure-f22c", "aputure-amaran-f21c": "gdtf-aputure-f21c", "aputure-amaran-f21x": "gdtf-aputure-f21x", "aputure-amaran-f22x": "gdtf-aputure-f22x",
  "nanlite-forza-300-ii": "gdtf-nanlite-forza-300-ii", "nanlite-pavotube-ii-15c": "gdtf-nanlite-pavotube-ii-15c", "nanlite-pavotube-ii-30c": "gdtf-nanlite-pavotube-ii-30c", "nanlite-pavoslim-60c": "gdtf-nanlite-pavoslim-60c", "nanlite-pavoslim-120c": "gdtf-nanlite-pavoslim-120c", "nanlite-pavoslim-240c": "gdtf-nanlite-pavoslim-240c",
  "nanlux-dyno-1200c": "gdtf-nanlux-dyno-1200c",
};
