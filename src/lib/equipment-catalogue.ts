// Curated gaffer equipment catalogue as a category → sub-list → item tree for the equipment list.
export interface CatalogueNode { name: string; items?: string[]; children?: CatalogueNode[] }

const SIZES = ["4x4", "6x6", "8x8", "12x12", "20x20"];
const FABRICS = ["Full silk", "1/2 silk", "1/4 silk", "Full grid cloth", "1/2 grid cloth", "1/4 grid cloth", "Light grid", "Muslin (bleached)", "Muslin (unbleached)", "Ultrabounce", "Ultrabounce gold/silver", "Black solid", "Double solid (black/white)", "Single net", "Double net", "Lavender net", "Black/white griffolyn", "Magic cloth", "Chroma green", "Chroma blue", "Rag / T-cloth", "Day/night", "Silver lamé", "Gold lamé", "Checkerboard silver/white", "Soft frost", "Opal", "Hampshire frost"];
const fabricSize = (s: string): CatalogueNode => ({ name: s, items: FABRICS.map((f) => `${s} ${f}`) });

export const EQUIPMENT_CATALOGUE: CatalogueNode[] = [
  { name: "Grip", children: [
    { name: "Clamps", items: ["Barrel clamp", "Super clamp (Manfrotto 035)", "Cardellini clamp", "Mafer clamp", "Scissor clamp", "Pipe clamp 48 mm", "Beadboard holder", "Big Ben clamp", "Platypus clamp", "Duckbill", "C-clamp 6\"", "C-clamp 10\"", "Chain vise grip", "Doorway clamp", "Quacker clamp", "Wall plate", "Gaffer grip", "Pole cat clamp", "Truss clamp (half coupler)", "Swivel coupler"] },
    { name: "Heads & arms", items: ["Grip head", "Gobo arm 40\"", "Gobo arm 20\"", "Baby pin adapter", "Spud adapter", "Junior receiver", "Baby to junior adapter", "Offset arm", "Lollipop", "Baby offset", "Junior offset", "Side arm", "Mini boom arm", "Matthellini", "Avenger D200 boom"] },
    { name: "Flags & nets", items: ["Floppy 4x4", "Flag 12x18", "Flag 18x24", "Flag 24x36", "Flag 30x36", "Flag 4x4 solid", "Single net 18x24", "Single net 24x36", "Double net 18x24", "Double net 24x36", "Silk 18x24", "Silk 24x36", "Lavender net 24x36", "Cutter 10x42", "Cutter 18x48", "Cutter 24x72", "Dot & finger set", "Flex arm + dots", "Open-end net set"] },
    { name: "Bounce", items: ["Polyboard / bead board 4x8", "Beadboard 4x4", "Reflector 5-in-1", "Bounce card", "Shiny board (hard/soft)", "Mirror board", "Foamcore frame", "V-flat white/black", "Book light frame"] },
    { name: "Weights", items: ["Sandbag 7 kg", "Sandbag 10 kg", "Sandbag 15 kg", "Shot bag", "Water weight 20 L", "Apple box full", "Apple box 1/2", "Apple box 1/4", "Apple box pancake", "Apple box set", "Wedges", "Cribbing", "Step block", "Ratchet strap"] },
    { name: "Dollies & carts", items: ["Western dolly", "Doorway dolly", "Furniture dolly", "Magliner", "Taco cart"] },
  ] },
  { name: "Stands", children: [
    { name: "C-stands", items: ["C-stand 40\"", "C-stand 20\"", "Turtle base C-stand", "Rocky mountain C-stand", "Low boy C-stand", "C-stand black"] },
    { name: "Combo & roller", items: ["Combo stand (junior)", "Roller stand (low)", "Roller stand (high)", "Low boy combo", "Mombo combo", "Overhead (high roller)", "Low combo 3 riser"] },
    { name: "Baby stands", items: ["Baby stand", "Light stand (Manfrotto)", "Low stand / turtle", "Baby plate", "Pigeon plate", "Kit stand"] },
    { name: "Wind-up & crank", items: ["Wind-up stand", "Crank-up stand", "Mega boom", "Wind-up 5 m", "Wind-up 6.5 m", "Genie / tower lift", "Litepanel tripod"] },
    { name: "Booms", items: ["Mini boom", "Boom arm + counterweight", "Menace arm", "Mega boom 4 m"] },
  ] },
  { name: "Rigging", children: [
    { name: "Truss", items: ["Truss 0.5 m", "Truss 1 m", "Truss 2 m", "Truss 3 m", "Truss corner 2-way", "Truss corner 3-way", "Truss base plate", "Truss tower", "Truss spigot pins"] },
    { name: "Poles & spreaders", items: ["Autopole (polecat) short", "Autopole (polecat) long", "Wall spreader", "Speed rail 1 m", "Speed rail 2 m", "Speed rail 4 m", "Speed rail 6 m", "Trapeze", "Goal post", "Baby pipe hanger"] },
    { name: "Hardware", items: ["Safety cable", "Shackle", "Ratchet strap", "Chain hoist 500 kg", "Chain hoist 1 t", "Round sling", "Steel wire rope", "Eye bolt", "Rigging plate", "Scaffold coupler"] },
  ] },
  { name: "Frames", children: [
    { name: "Frames", items: SIZES.map((s) => `Frame ${s}`).concat(["Frame 6x12", "Frame 8x16", "Frame 12x20", "Frame 20x40", "Butterfly kit 6x6", "Butterfly kit 8x8", "Butterfly kit 12x12", "Overhead kit 20x20", "Frame ears / corners", "Frame stand adapters"]) },
  ] },
  { name: "Fabrics", children: SIZES.map(fabricSize).concat([{ name: "6x12 / 12x20", items: ["6x12 Muslin", "6x12 Ultrabounce", "6x12 Black solid", "12x20 Full silk", "12x20 Ultrabounce", "12x20 Black solid", "12x20 Full grid cloth", "20x40 Black solid", "20x40 Ultrabounce", "20x40 Full silk"] }]) },
  { name: "Cables & power", children: [
    { name: "1 phase", items: ["Schuko extension 5 m", "Schuko extension 10 m", "Schuko extension 25 m", "Cable drum Schuko 25 m", "16A CEE 1ph 5 m", "16A CEE 1ph 10 m", "16A CEE 1ph 25 m", "32A CEE 1ph 10 m", "32A CEE 1ph 25 m", "Power strip 6-way", "Schuko splitter", "16A CEE → Schuko adapter", "Schuko → 16A CEE adapter", "Powercon extension 5 m", "Powercon → Schuko", "True1 extension"] },
    { name: "3 phase", items: ["16A CEE 3ph 10 m", "16A CEE 3ph 25 m", "32A CEE 3ph 10 m", "32A CEE 3ph 25 m", "63A CEE 3ph 10 m", "63A CEE 3ph 25 m", "125A CEE 3ph 25 m", "Powerlock set 10 m", "Powerlock set 25 m", "Socapex 19-pin 25 m", "Socapex breakout", "32A 3ph → 3× 16A 1ph splitter"] },
    { name: "Distribution", items: ["Distro 16A → Schuko 6-way", "Distro 32A → 16A/Schuko", "Distro 63A → 32A/16A", "Distro 125A → 63A/32A", "Distro 400A Powerlock", "RCD / GFCI box", "Cable ramp", "Cable crossover", "Cable mat", "Power meter / analyser"] },
    { name: "Generators", items: ["Generator 2.2 kVA (Honda)", "Generator 3 kVA", "Generator 6 kVA", "Generator 12 kVA", "Generator 20 kVA", "Generator 30 kVA", "Generator 60 kVA", "Generator 100 kVA", "Generator 150 kVA", "Generator 250 kVA", "Fuel can 20 L", "Earth rod"] },
    { name: "Dimmers", items: ["Dimmer 1 kW", "Dimmer 2 kW", "Dimmer 5 kW", "Dimmer pack 4×2.5 kW", "Dimmer pack 6×2.5 kW", "Dimmer pack 12×2.5 kW", "Variac 2 kW", "Hand squeezer", "DMX switch pack"] },
  ] },
  { name: "DMX & data", children: [
    { name: "Wireless", items: ["CRMX transmitter", "CRMX receiver", "LumenRadio TimoTwo", "Ratpac AKS", "Astera ART7 / AsteraBox", "Art-Net node", "sACN node 4-port", "Wi-Fi router", "Access point outdoor", "Network switch 8-port"] },
    { name: "Cables", items: ["DMX 5-pin 1 m", "DMX 5-pin 3 m", "DMX 5-pin 10 m", "DMX 5-pin 25 m", "DMX 3-pin 10 m", "DMX 3→5 pin adapter", "DMX 5→3 pin adapter", "DMX terminator", "DMX splitter 4-way", "Ethernet CAT6 5 m", "Ethernet CAT6 25 m", "Ethernet CAT6 50 m", "Ethercon drum 75 m"] },
    { name: "Control", items: ["Lighting console", "iPad + stand", "MIDI controller", "Stream Deck", "Laptop + bridge"] },
  ] },
  { name: "Modifiers", children: [
    { name: "Softboxes", items: ["Softbox / lantern", "Chimera small", "Chimera medium", "Chimera large", "Octabox 120", "Octabox 150", "Egg crate grid", "Lantern 65 cm", "Space light skirt", "Snapbag", "Light dome II", "Light dome 150"] },
    { name: "Hard light", items: ["Fresnel attachment", "Spotlight / leko attachment", "Barn doors", "Snoot", "Scrim set", "Gobo holder", "Gobo set", "Iris"] },
    { name: "Gel rolls", items: ["Gel CTO full roll", "Gel CTO 1/2 roll", "Gel CTO 1/4 roll", "Gel CTB full roll", "Gel CTB 1/2 roll", "Gel CTB 1/4 roll", "Plus green roll", "Minus green roll", "ND 0.3 roll", "ND 0.6 roll", "ND 0.9 roll"] },
    { name: "Diffusion rolls", items: ["Diffusion 216 roll", "Diffusion 250 roll", "Diffusion 251 roll", "Opal 410 roll", "Hampshire frost roll", "Grid cloth roll", "Light grid roll", "Spun roll", "Bleached muslin roll"] },
  ] },
  { name: "Batteries", children: [
    { name: "Batteries", items: ["V-mount 98 Wh", "V-mount 150 Wh", "V-mount 290 Wh", "Gold mount 150 Wh", "Block battery 26V", "Instagrid One", "Instagrid One max", "EcoFlow power station", "D-tap cable", "Battery plate V-mount"] },
    { name: "Chargers", items: ["Battery charger 2-way", "Battery charger 4-way", "Instagrid charger", "AA/AAA charger"] },
  ] },
  { name: "Expendables", children: [
    { name: "Tape", items: ["Black gaffer tape 50 mm", "White gaffer tape 50 mm", "Grey gaffer tape 50 mm", "Black gaffer tape 25 mm", "Paper tape", "Spike tape (colours)", "Double-sided tape", "Electrical tape", "Duct tape", "Glow tape", "Snot tape / transfer tape"] },
    { name: "Wrap & board", items: ["Blackwrap (cinefoil)", "Depron sheet", "Foamcore white", "Foamcore black", "Foamcore black/white", "Duvetyne roll", "Showcard", "Bobbinet", "Aluminium foil", "Gel sheets assortment"] },
    { name: "Clips", items: ["Wooden clothes pins (C-47)", "Spring clamps A1", "Spring clamps A2", "Spring clamps A3", "Bulldog clips", "Binder clips", "Grifflon clips"] },
    { name: "Misc", items: ["Zip ties", "Velcro cable ties", "Batteries AA/AAA", "Batteries 9V", "Gloves", "Sharpies", "Dulling spray", "Streaks 'n Tips", "Hazer fluid", "Bin bags", "Cable labels"] },
  ] },
  { name: "Practicals & effects", children: [
    { name: "Practicals", items: ["Practical bulb E27 kit", "Dimmable LED bulbs", "Festoon string", "Chinese lantern + socket", "Dimmer squeezer inline", "Edison smart bulbs"] },
    { name: "Atmosphere", items: ["Hazer", "Smoke machine", "Fan (effects)", "Rain bar", "Flicker box", "Lightning strike"] },
  ] },
  { name: "Misc", children: [
    { name: "Ropes & hardware", items: ["Rope (sash cord)", "Carabiners", "Bungee cords", "Tie-line", "Pulley", "Climbing rope 20 m", "Ratchet strap"] },
    { name: "Tools", items: ["Ladder 4 step", "Ladder 6 step", "Ladder 10 step", "Ladder 12 step", "Tool kit", "Flashlight", "Head torch", "Multimeter", "Light meter", "Colour meter", "Cordless drill", "Radio + earpiece"] },
    { name: "Cart", items: ["Lighting cart", "Grip cart", "Cable crate", "Expendables box", "Gel cart"] },
    { name: "Safety", items: ["Fire extinguisher", "First aid kit", "Hi-vis vest", "Safety barrier", "Hard hat", "Cable warning sign"] },
  ] },
];
