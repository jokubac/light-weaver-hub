// Gel library (Rosco & LEE). Colours are approximate screen values for preview and
// conversion to HSI / CCT on LED fixtures — not spectral data.

export interface Gel {
  id: string;
  brand: "Rosco" | "LEE";
  code: string;
  name: string;
  hex: string;
  /** correction gels: target Kelvin from a 5600K source (CTO) or 3200K source (CTB) */
  kelvin?: number;
  /** green/magenta correction: +green / −magenta, -1..1 */
  gm?: number;
}

type Row = [string, string, string, number?, number?];

const R: Row[] = [
  // Rosco corrections (Cinegel / E-Colour)
  ["3407", "RoscoSun Full CTO", "#ffb45a", 3200], ["3408", "RoscoSun 1/2 CTO", "#ffcf92", 4100], ["3409", "RoscoSun 1/4 CTO", "#ffe2bb", 4700],
  ["3410", "RoscoSun 1/8 CTO", "#fff0dc", 5100], ["3411", "3/4 CTO", "#ffbf72", 3500], ["3441", "Full Straw CTS", "#ffc24d", 3200],
  ["3442", "1/2 Straw CTS", "#ffd98a", 4100], ["3443", "1/4 Straw CTS", "#ffe8b5", 4700], ["3444", "1/8 Straw CTS", "#fff3d9", 5100],
  ["3202", "Full Blue CTB", "#5c8cff", 5600], ["3203", "3/4 CTB", "#7aa2ff", 5000], ["3204", "1/2 CTB", "#9cbaff", 4300],
  ["3206", "1/3 CTB", "#b6ccff", 3900], ["3208", "1/4 CTB", "#c9d8ff", 3600], ["3216", "1/8 CTB", "#e2eaff", 3400],
  ["3304", "Tough Plusgreen", "#b9f5a0", undefined, 1], ["3315", "1/2 Plusgreen", "#d3f8c4", undefined, 0.5], ["3316", "1/4 Plusgreen", "#e5fbdb", undefined, 0.25],
  ["3317", "1/8 Plusgreen", "#f0fdea", undefined, 0.125], ["3308", "Tough Minusgreen", "#ffb3e6", undefined, -1], ["3313", "1/2 Minusgreen", "#ffcfee", undefined, -0.5],
  ["3314", "1/4 Minusgreen", "#ffe2f5", undefined, -0.25], ["3318", "1/8 Minusgreen", "#fff0fa", undefined, -0.125],
  // Roscolux
  ["01", "Light Bastard Amber", "#fbc9a3"], ["02", "Bastard Amber", "#fbb98a"], ["04", "Medium Bastard Amber", "#f9a87c"], ["05", "Rose Tint", "#fbd5d5"],
  ["07", "Pale Yellow", "#fff7c2"], ["08", "Pale Gold", "#ffe3a8"], ["09", "Pale Amber Gold", "#ffd28a"], ["10", "Medium Yellow", "#fff04d"],
  ["11", "Light Straw", "#ffef9e"], ["12", "Straw", "#ffe066"], ["13", "Straw Tint", "#ffdba0"], ["14", "Medium Straw", "#ffcc4d"],
  ["15", "Deep Straw", "#ffbb00"], ["16", "Light Amber", "#ffc773"], ["17", "Light Flame", "#ff9e6b"], ["18", "Flame", "#ff7d45"],
  ["19", "Fire", "#ff4b1f"], ["20", "Medium Amber", "#ffa640"], ["21", "Golden Amber", "#ff8c1a"], ["22", "Deep Amber", "#ff6a00"],
  ["23", "Orange", "#ff7300"], ["24", "Scarlet", "#ff2a2a"], ["25", "Orange Red", "#ff3b1a"], ["26", "Light Red", "#e6001a"],
  ["27", "Medium Red", "#b3001b"], ["30", "Light Salmon Pink", "#ff9c94"], ["31", "Salmon Pink", "#ff8a80"], ["32", "Medium Salmon Pink", "#ff6e66"],
  ["33", "No Color Pink", "#ffd1dc"], ["34", "Flesh Pink", "#ffa3b5"], ["35", "Light Pink", "#ffc2d1"], ["36", "Medium Pink", "#ff99b8"],
  ["37", "Pale Rose Pink", "#f7b3d1"], ["38", "Light Rose", "#ff8fb3"], ["39", "Skelton Exotic Sangria", "#d6006e"], ["40", "Light Salmon", "#ff8066"],
  ["42", "Deep Salmon", "#ff5c4d"], ["43", "Deep Pink", "#ff3d8b"], ["44", "Middle Rose", "#ff5ca8"], ["45", "Rose", "#ff2e8b"],
  ["46", "Magenta", "#e6007a"], ["47", "Light Rose Purple", "#c86ec8"], ["48", "Rose Purple", "#b052c8"], ["49", "Medium Purple", "#8c1ab3"],
  ["50", "Mauve", "#c0607a"], ["51", "Surprise Pink", "#d9b3e6"], ["52", "Light Lavender", "#cfb3ff"], ["53", "Pale Lavender", "#e3d9ff"],
  ["54", "Special Lavender", "#d1c2ff"], ["55", "Lilac", "#b8a3ff"], ["56", "Gypsy Lavender", "#8a4dff"], ["57", "Lavender", "#9b7aff"],
  ["58", "Deep Lavender", "#7a4dff"], ["59", "Indigo", "#4b00b3"], ["60", "No Color Blue", "#d6ecff"], ["61", "Mist Blue", "#c7e6ff"],
  ["62", "Booster Blue", "#b3d9ff"], ["63", "Pale Blue", "#a3d1ff"], ["64", "Light Steel Blue", "#8cc2ff"], ["65", "Daylight Blue", "#66b3ff"],
  ["66", "Cool Blue", "#a6e3ff"], ["67", "Light Sky Blue", "#4da6ff"], ["68", "Sky Blue", "#2e8bff"], ["69", "Brilliant Blue", "#1f7aff"],
  ["70", "Nile Blue", "#80dfff"], ["71", "Sea Blue", "#00a3e6"], ["72", "Azure Blue", "#40b3ff"], ["73", "Peacock Blue", "#00b3b3"],
  ["74", "Night Blue", "#1a3dff"], ["76", "Light Green Blue", "#0066cc"], ["77", "Green Blue", "#0080b3"], ["78", "Trudy Blue", "#5c66ff"],
  ["79", "Bright Blue", "#0033ff"], ["80", "Primary Blue", "#0022e6"], ["81", "Urban Blue", "#3366ff"], ["82", "Surprise Blue", "#2a1aff"],
  ["83", "Medium Blue", "#0019b3"], ["84", "Zephyr Blue", "#4d66ff"], ["85", "Deep Blue", "#00109e"], ["86", "Pea Green", "#a3ff4d"],
  ["88", "Light Green", "#ccff99"], ["89", "Moss Green", "#33cc33"], ["90", "Dark Yellow Green", "#00992e"], ["91", "Primary Green", "#007a1f"],
  ["92", "Turquoise", "#00ccb3"], ["93", "Blue Green", "#00b38f"], ["94", "Kelly Green", "#00b34d"], ["95", "Medium Blue Green", "#00998a"],
  ["96", "Lime", "#ccff33"], ["97", "Light Grey", "#d9d9d9"], ["98", "Medium Grey", "#a6a6a6"], ["99", "Chocolate", "#b38059"],
  ["100", "Frost", "#f5f5f5"], ["101", "Light Frost", "#fafafa"], ["102", "Light Amber", "#ffd27f"], ["103", "Straw", "#ffe7a3"],
  ["104", "Tough Silk", "#f5f5f5"], ["114", "Hamburg Frost", "#f2f2f2"], ["116", "Tough White Diffusion", "#efefef"], ["119", "Light Hamburg Frost", "#f7f7f7"],
  ["120", "Red Diffusion", "#ff4d4d"], ["124", "Red Cyc Silk", "#e60000"], ["132", "Medium Blue Diffusion", "#3366ff"],
  ["304", "Pale Apricot", "#ffd9b8"], ["305", "Rose Gold", "#ffc2a3"], ["312", "Canary", "#ffff66"], ["316", "Gallo Gold", "#ffb34d"],
  ["318", "Mayan Sun", "#ff9966"], ["321", "Soft Golden Amber", "#ffa366"], ["325", "Henna Sky", "#ff8c66"], ["331", "Shell Pink", "#ffb3c2"],
  ["337", "True Pink", "#ff8cc6"], ["339", "Broadway Pink", "#ff1a8c"], ["342", "Rose Pink", "#ff3da8"], ["344", "Follies Pink", "#ff4dc2"],
  ["355", "Pale Violet", "#d4b3ff"], ["356", "Middle Lavender", "#b399ff"], ["357", "Royal Lavender", "#8c4dff"], ["358", "Rose Indigo", "#9933ff"],
  ["359", "Medium Violet", "#6619ff"], ["363", "Aquamarine", "#99ffe6"], ["364", "Blue Bell", "#66b3ff"], ["366", "Cornflower", "#80b3ff"],
  ["367", "Slate Blue", "#4d80ff"], ["370", "Italian Blue", "#00b3e6"], ["373", "Theatre Booster 3", "#e6f2ff"], ["375", "Cerulean Blue", "#0099e6"],
  ["377", "Iris Purple", "#5c1aff"], ["378", "Alice Blue", "#7a8cff"], ["380", "Golden Tan", "#d9a066"], ["382", "Congo Blue", "#1a00b3"],
  ["383", "Sapphire Blue", "#0019e6"], ["385", "Royal Blue", "#1a1aff"], ["386", "Leaf Green", "#4dcc33"], ["388", "Gaslight Green", "#b3ff66"],
  ["389", "Chroma Green", "#00e64d"], ["393", "Emerald Green", "#00b366"], ["395", "Teal Green", "#00a38c"],
];

const L: Row[] = [
  ["204", "Full CT Orange", "#ffb45a", 3200], ["205", "1/2 CT Orange", "#ffcf92", 3800], ["206", "1/4 CT Orange", "#ffe2bb", 4600],
  ["223", "1/8 CT Orange", "#fff0dc", 5100], ["285", "3/4 CT Orange", "#ffbf72", 3600], ["441", "Full CT Straw", "#ffc24d", 3200],
  ["442", "1/2 CT Straw", "#ffd98a", 3800], ["443", "1/4 CT Straw", "#ffe8b5", 4600], ["444", "1/8 CT Straw", "#fff3d9", 5100],
  ["201", "Full CT Blue", "#5c8cff", 5700], ["281", "3/4 CT Blue", "#7aa2ff", 5000], ["202", "1/2 CT Blue", "#9cbaff", 4300],
  ["203", "1/4 CT Blue", "#c9d8ff", 3600], ["218", "1/8 CT Blue", "#e2eaff", 3400], ["200", "Double CT Blue", "#3d6eff", 10000],
  ["244", "LEE Plus Green", "#b9f5a0", undefined, 1], ["245", "1/2 Plus Green", "#d3f8c4", undefined, 0.5], ["246", "1/4 Plus Green", "#e5fbdb", undefined, 0.25],
  ["278", "1/8 Plus Green", "#f0fdea", undefined, 0.125], ["247", "LEE Minus Green", "#ffb3e6", undefined, -1], ["248", "1/2 Minus Green", "#ffcfee", undefined, -0.5],
  ["249", "1/4 Minus Green", "#ffe2f5", undefined, -0.25], ["279", "1/8 Minus Green", "#fff0fa", undefined, -0.125],
  ["002", "Rose Pink", "#ff4db8"], ["003", "Lavender Tint", "#efe3ff"], ["004", "Medium Bastard Amber", "#ffb38c"], ["007", "Pale Yellow", "#fff7c2"],
  ["008", "Dark Salmon", "#ff8066"], ["009", "Pale Amber Gold", "#ffd28a"], ["010", "Medium Yellow", "#fff04d"], ["013", "Straw Tint", "#ffdba0"],
  ["015", "Deep Straw", "#ffbb00"], ["017", "Surprise Peach", "#e69980"], ["019", "Fire", "#ff4b1f"], ["020", "Medium Amber", "#ffa640"],
  ["021", "Gold Amber", "#ff8c1a"], ["022", "Dark Amber", "#ff6a00"], ["024", "Scarlet", "#ff1a40"], ["025", "Sunset Red", "#ff5933"],
  ["026", "Bright Red", "#e6001a"], ["027", "Medium Red", "#b3001b"], ["029", "Plasa Red", "#cc0026"], ["035", "Light Pink", "#ffc2d1"],
  ["036", "Medium Pink", "#ff99b8"], ["046", "Dark Magenta", "#cc0066"], ["048", "Rose Purple", "#b052c8"], ["052", "Light Lavender", "#cfb3ff"],
  ["053", "Paler Lavender", "#e3d9ff"], ["058", "Lavender", "#9b7aff"], ["061", "Mist Blue", "#c7e6ff"], ["063", "Pale Blue", "#a3d1ff"],
  ["068", "Sky Blue", "#2e8bff"], ["071", "Tokyo Blue", "#1a00b3"], ["075", "Evening Blue", "#3d66ff"], ["079", "Just Blue", "#0033ff"],
  ["085", "Deeper Blue", "#00109e"], ["088", "Lime Green", "#ccff66"], ["089", "Moss Green", "#33cc33"], ["090", "Dark Yellow Green", "#00992e"],
  ["101", "Yellow", "#ffee00"], ["102", "Light Amber", "#ffd27f"], ["103", "Straw", "#ffe7a3"], ["104", "Deep Amber", "#ffb000"],
  ["105", "Orange", "#ff7300"], ["106", "Primary Red", "#e6001a"], ["107", "Light Rose", "#ff8fb3"], ["109", "Light Salmon", "#ff8a80"],
  ["110", "Middle Rose", "#ff5ca8"], ["111", "Dark Pink", "#ff3d8b"], ["113", "Magenta", "#e6007a"], ["115", "Peacock Blue", "#00b3b3"],
  ["116", "Medium Blue-Green", "#00998a"], ["117", "Steel Blue", "#a3e0ff"], ["118", "Light Blue", "#00a3e6"], ["119", "Dark Blue", "#0019b3"],
  ["120", "Deep Blue", "#00109e"], ["121", "LEE Green", "#99ff33"], ["122", "Fern Green", "#33cc33"], ["124", "Dark Green", "#00804d"],
  ["126", "Mauve", "#b31a80"], ["127", "Smokey Pink", "#cc6680"], ["128", "Bright Pink", "#ff1a8c"], ["132", "Medium Blue", "#0080e6"],
  ["134", "Golden Amber", "#ff9e5c"], ["135", "Deep Golden Amber", "#ff6626"], ["136", "Pale Lavender", "#e3c7ff"], ["137", "Special Lavender", "#c7a3ff"],
  ["138", "Pale Green", "#e6ffb3"], ["139", "Primary Green", "#00b31a"], ["141", "Bright Blue", "#0099ff"], ["142", "Pale Violet", "#b399ff"],
  ["143", "Pale Navy Blue", "#3d80b3"], ["144", "No Colour Blue", "#cce6ff"], ["147", "Apricot", "#ffad80"], ["148", "Bright Rose", "#ff2e66"],
  ["151", "Gold Tint", "#ffd1b3"], ["152", "Pale Gold", "#ffd9b8"], ["153", "Pale Salmon", "#ffccc7"], ["154", "Pale Rose", "#ffd9d9"],
  ["156", "Chocolate", "#cc9966"], ["157", "Pink", "#ff6699"], ["158", "Deep Orange", "#ff5c00"], ["159", "No Colour Straw", "#fff5e0"],
  ["161", "Slate Blue", "#4d99ff"], ["162", "Bastard Amber", "#ffc7a3"], ["164", "Flame Red", "#ff3300"], ["165", "Daylight Blue", "#3399ff"],
  ["170", "Deep Lavender", "#b366ff"], ["174", "Dark Steel Blue", "#66b3ff"], ["176", "Loving Amber", "#ffb3a3"], ["179", "Chrome Orange", "#ff9933"],
  ["180", "Dark Lavender", "#8033ff"], ["181", "Congo Blue", "#1a00b3"], ["182", "Light Red", "#ff1a1a"], ["183", "Moonlight Blue", "#00b3ff"],
  ["184", "Cosmetic Peach", "#ffd1c2"], ["195", "Zenith Blue", "#0033cc"], ["197", "Alice Blue", "#6680ff"], ["212", "LCT Yellow (Y1)", "#fff2cc"],
  ["216", "White Diffusion", "#f2f2f2"], ["250", "Half White Diffusion", "#f7f7f7"], ["251", "Quarter White Diffusion", "#fafafa"],
  ["400", "LEELux", "#f5f5f5"], ["410", "Opal Frost", "#f5f5f5"], ["452", "Sixteenth White", "#fcfcfc"], ["500", "Double New Colour Blue", "#99c2ff"],
  ["501", "New Colour Blue", "#b3d1ff"], ["502", "Half New Colour Blue", "#cce0ff"], ["503", "Quarter New Colour Blue", "#e0edff"],
  ["700", "Perfect Lavender", "#a366ff"], ["701", "Provence", "#b380ff"], ["702", "Special Pale Lavender", "#e0ccff"], ["703", "Cold Lavender", "#c2b3ff"],
  ["704", "Lily", "#e6b3ff"], ["705", "Lily Frost", "#efd1ff"], ["706", "King Fals Lavender", "#8c66ff"], ["707", "Ultimate Violet", "#6619ff"],
  ["708", "Cool Lavender", "#d1d1ff"], ["709", "Electric Lilac", "#b3b3ff"], ["710", "Spir Special Blue", "#6680ff"], ["711", "Cold Blue", "#99b3e6"],
  ["712", "Bedford Blue", "#5c99ff"], ["713", "J.Winter Blue", "#0033b3"], ["714", "Elysian Blue", "#3366ff"], ["715", "Cabana Blue", "#0040ff"],
  ["716", "Mikkel Blue", "#0019e6"], ["717", "Shanklin Frost", "#d6e6ff"], ["718", "Half Shanklin Frost", "#e6f0ff"], ["719", "Colour Wash Blue", "#80b3ff"],
  ["720", "Durham Daylight Frost", "#e6f0ff"], ["721", "Berry Blue", "#0066ff"], ["722", "Bray Blue", "#0080cc"], ["723", "Virgin Blue", "#3380ff"],
  ["724", "Ocean Blue", "#00b3e6"], ["725", "Old Steel Blue", "#a3c2e6"], ["728", "Steel Green", "#a3e0c2"], ["729", "Scuba Blue", "#00b3b3"],
  ["730", "Liberty Green", "#99ffcc"], ["731", "Dirty Ice", "#d6f0d6"], ["733", "Damp Squib", "#b3d1b3"], ["735", "Velvet Green", "#00804d"],
  ["736", "Twickenham Green", "#00b34d"], ["738", "JAS Green", "#99ff00"], ["740", "Aurora Borealis Green", "#668033"], ["741", "Mustard Yellow", "#cc9900"],
  ["742", "Bram Brown", "#b36633"], ["746", "Brown", "#994d1a"], ["747", "Easy White", "#fff2e6"], ["763", "Wheat", "#ffe0a3"],
  ["764", "Sun Colour Straw", "#ffe6b3"], ["765", "LEE Yellow", "#ffe066"], ["767", "Oklahoma Yellow", "#ffd633"], ["768", "Egg Yolk Yellow", "#ffb300"],
  ["770", "Burnt Yellow", "#ffa31a"], ["773", "Cardbox Amber", "#ffbf80"], ["774", "Soft Amber Key 1", "#ffd9b3"], ["775", "Soft Amber Key 2", "#ffcca3"],
  ["776", "Nectarine", "#ffa380"], ["777", "Rust", "#e65c1a"], ["778", "Millennium Gold", "#ff8000"], ["779", "Bastard Pink", "#ffb3a3"],
  ["780", "AS Golden Amber", "#ff8033"], ["781", "Terry Red", "#ff3300"], ["787", "Marius Red", "#b3001a"], ["789", "Blood Red", "#990014"],
  ["790", "Moroccan Pink", "#ffb3c2"], ["791", "Moroccan Frost", "#ffccd6"], ["793", "Vanity Fair", "#ff3399"], ["794", "Pretty 'n Pink", "#ff99cc"],
  ["795", "Magical Magenta", "#e6008c"], ["797", "Deep Purple", "#8000b3"], ["798", "Chrysalis Pink", "#b366cc"], ["799", "Special KH Lavender", "#6633cc"],
];

export const GELS: Gel[] = [
  ...R.map(([code, name, hex, kelvin, gm]) => ({ id: `rosco-${code}`, brand: "Rosco" as const, code, name, hex, ...(kelvin ? { kelvin } : {}), ...(gm !== undefined ? { gm } : {}) })),
  ...L.map(([code, name, hex, kelvin, gm]) => ({ id: `lee-${code}`, brand: "LEE" as const, code, name, hex, ...(kelvin ? { kelvin } : {}), ...(gm !== undefined ? { gm } : {}) })),
];
export const GEL_BY_ID: Record<string, Gel> = Object.fromEntries(GELS.map((g) => [g.id, g]));

export function hexToHs(hex: string): { h: number; s: number } {
  const n = parseInt(hex.replace("#", ""), 16) || 0;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0 };
}
