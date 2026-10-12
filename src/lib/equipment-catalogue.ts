// Curated gaffer equipment catalogue as a category → sub-list → item tree for the equipment list.
export interface CatalogueNode { name: string; items?: string[]; children?: CatalogueNode[] }

export const EQUIPMENT_CATALOGUE: CatalogueNode[] = [
  { name: "Grip", children: [
    { name: "Clamps", items: ["Barrel clamp", "Super clamp", "Cardellini clamp", "Mafer clamp", "Scissor clamp", "Pipe clamp", "Beadboard holder"] },
    { name: "Heads & arms", items: ["Grip head", "Gobo arm 40\"", "Gobo arm 20\"", "Baby pin adapter", "Spud adapter", "Junior receiver"] },
    { name: "Flags & nets", items: ["Floppy 4x4", "Flag 24x36", "Flag 18x24", "Single net 24x36", "Double net 24x36", "Silk 24x36", "Cutter 24x72"] },
    { name: "Bounce", items: ["Polyboard / bead board", "Beadboard 4x8", "Reflector 5-in-1", "Bounce card"] },
    { name: "Weights", items: ["Sandbag 7 kg", "Sandbag 15 kg", "Shot bag", "Apple box set", "Wedges / cribbing"] },
  ] },
  { name: "Stands", children: [
    { name: "C-stands", items: ["C-stand 40\"", "C-stand 20\"", "Turtle base C-stand"] },
    { name: "Combo & roller", items: ["Combo stand (junior)", "Roller stand (low)", "Roller stand (high)", "Low boy combo"] },
    { name: "Baby stands", items: ["Baby stand", "Light stand (Manfrotto)", "Low stand / turtle"] },
    { name: "Wind-up & crank", items: ["Wind-up stand", "Crank-up stand", "Mega boom"] },
  ] },
  { name: "Rigging", children: [
    { name: "Truss", items: ["Truss 1 m", "Truss 2 m", "Truss 3 m", "Truss corner", "Truss base plate"] },
    { name: "Poles & spreaders", items: ["Autopole (polecat)", "Wall spreader", "Speed rail 2 m", "Speed rail 4 m", "Trapeze"] },
    { name: "Hardware", items: ["Safety cable", "Shackle", "Ratchet strap", "Chain hoist", "Menace arm"] },
  ] },
  { name: "Frames", children: [
    { name: "Frames", items: ["Frame 4x4", "Frame 6x6", "Frame 8x8", "Frame 12x12", "Frame 20x20"] },
  ] },
  { name: "Fabrics", children: [
    { name: "4x4", items: ["4x4 Full silk", "4x4 1/2 grid", "4x4 Single net", "4x4 Double net", "4x4 Solid black"] },
    { name: "6x6", items: ["6x6 Muslin", "6x6 Full grid", "6x6 Ultrabounce", "6x6 Black solid"] },
    { name: "8x8", items: ["8x8 Muslin (bleached)", "8x8 Muslin (unbleached)", "8x8 Full grid", "8x8 1/2 grid", "8x8 Silk", "8x8 Ultrabounce", "8x8 Black solid", "8x8 Single net"] },
    { name: "12x12", items: ["12x12 Black solid", "12x12 Muslin (bleached)", "12x12 Full grid", "12x12 1/4 grid", "12x12 Silk", "12x12 Ultrabounce", "12x12 Double net"] },
    { name: "20x20", items: ["20x20 Black solid", "20x20 Silk", "20x20 Full grid", "20x20 Ultrabounce"] },
  ] },
  { name: "Cables & power", children: [
    { name: "1 phase", items: ["Schuko extension 5 m", "Schuko extension 10 m", "16A CEE 1ph 10 m", "16A CEE 1ph 25 m", "32A CEE 1ph 10 m", "32A CEE 1ph 25 m", "Power strip 6-way", "Schuko splitter"] },
    { name: "3 phase", items: ["16A CEE 3ph 10 m", "32A CEE 3ph 10 m", "32A CEE 3ph 25 m", "63A CEE 3ph 25 m", "125A CEE 3ph 25 m", "Powerlock set 25 m"] },
    { name: "Distribution", items: ["Distro 32A → 16A/Schuko", "Distro 63A → 32A/16A", "Distro 125A → 63A/32A", "RCD / GFCI box", "Cable ramp"] },
    { name: "Generators", items: ["Generator 2.2 kVA", "Generator 6 kVA", "Generator 20 kVA", "Generator 60 kVA", "Generator 100 kVA"] },
    { name: "Dimmers", items: ["Dimmer 1 kW", "Dimmer 2 kW", "Dimmer pack 4×2.5 kW", "Variac"] },
  ] },
  { name: "DMX & data", children: [
    { name: "Wireless", items: ["CRMX transmitter", "CRMX receiver", "Art-Net node", "Wi-Fi router"] },
    { name: "Cables", items: ["DMX 5-pin 3 m", "DMX 5-pin 10 m", "DMX 5-pin 25 m", "DMX 3→5 pin adapter", "DMX terminator", "Ethernet CAT6 25 m"] },
  ] },
  { name: "Modifiers", children: [
    { name: "Softboxes", items: ["Softbox / lantern", "Chimera", "Octabox", "Egg crate grid"] },
    { name: "Gel & diffusion", items: ["Gel CTO roll", "Gel CTB roll", "Diffusion 216 roll", "Diffusion 250 roll", "Hampshire frost roll"] },
  ] },
  { name: "Batteries", children: [
    { name: "Batteries", items: ["V-mount 150 Wh", "V-mount 290 Wh", "Gold mount 150 Wh", "Instagrid One", "Battery charger 4-way"] },
  ] },
  { name: "Expendables", children: [
    { name: "Tape", items: ["Black gaffer tape 50 mm", "White gaffer tape 50 mm", "Paper tape", "Spike tape (colours)", "Double-sided tape"] },
    { name: "Wrap & board", items: ["Blackwrap (cinefoil)", "Depron sheet", "Foamcore white", "Foamcore black"] },
    { name: "Clips", items: ["Wooden clothes pins (C-47)", "Spring clamps A1", "Spring clamps A2", "Bulldog clips"] },
    { name: "Misc", items: ["Zip ties", "Batteries AA/AAA", "Gloves", "Sharpies"] },
  ] },
  { name: "Misc", children: [
    { name: "Ropes & hardware", items: ["Rope (sash cord)", "Carabiners", "Bungee cords", "Tie-line"] },
    { name: "Tools", items: ["Ladder 6 step", "Ladder 10 step", "Tool kit", "Flashlight", "Multimeter"] },
    { name: "Cart", items: ["Lighting cart", "Grip cart", "Cable crate"] },
  ] },
];
