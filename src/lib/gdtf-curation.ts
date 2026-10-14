// Professional fixture brand whitelist and dedupe rules for the bundled GDTF library.
// Keys are lowercase, punctuation-free brand names as found in GDTF files.
export const BRAND_ALIASES: Record<string, string> = {
  // Cinema / TV
  arri: "ARRI", astera: "Astera", asteraledtechnology: "Astera", asteraled: "Astera",
  aputure: "Aputure", amaran: "Amaran", nanlux: "Nanlux", nanlite: "Nanlite",
  creamsource: "Creamsource", outsight: "Creamsource", kinoflo: "Kino Flo", litepanels: "Litepanels",
  quasarscience: "Quasar Science", quasar: "Quasar Science", dmglumiere: "DMG Lumière", dmg: "DMG Lumière",
  rosco: "Rosco", velvet: "Velvet", velvetlight: "Velvet", aladdin: "Aladdin", prolycht: "Prolycht",
  godox: "Godox", zylight: "Zylight", cineo: "Cineo", cineolighting: "Cineo", hive: "Hive Lighting",
  hivelighting: "Hive Lighting", fiilex: "Fiilex", digitalsputnik: "Digital Sputnik", sumolight: "SumoLight",
  ledgo: "Ledgo", fluotec: "Fluotec", bbslighting: "BB&S", bbs: "BB&S", mole: "Mole-Richardson",
  molerichardson: "Mole-Richardson", dedolight: "Dedolight", dedo: "Dedolight", lupo: "Lupo",
  kinotehnik: "Kinotehnik", ikan: "Ikan", intellytech: "Intellytech", cameo: "Cameo",
  // Theatre / touring / rental
  robe: "Robe", robelighting: "Robe", robeshowlighting: "Robe", anolis: "Anolis",
  martin: "Martin", martinprofessional: "Martin", martinbyharman: "Martin", claypaky: "Clay Paky",
  etc: "ETC", electronictheatrecontrols: "ETC", highendsystems: "High End Systems", ayrton: "Ayrton",
  glp: "GLP", germanlightproducts: "GLP", varilite: "Vari-Lite", chauvetprofessional: "Chauvet Professional",
  chauvet: "Chauvet Professional", elation: "Elation", elationprofessional: "Elation", prolights: "Prolights",
  sgm: "SGM", sgmlight: "SGM", robertjuliat: "Robert Juliat", jblighting: "JB-Lighting",
  acme: "ACME", ademar: "Ade", strong: "Strong", altman: "Altman", altmanlighting: "Altman",
  selecon: "Selecon", strand: "Strand", strandlighting: "Strand", philipsstrand: "Strand",
  philipsselecon: "Selecon", desisti: "DeSisti", spotlight: "Spotlight", ldr: "LDR",
  coemar: "Coemar", griven: "Griven", tmb: "TMB", solaris: "TMB", portman: "Portman",
  portmanlights: "Portman", showline: "Showline", lightsky: "Light Sky", ehrgeiz: "Ehrgeiz",
  chromaq: "Chroma-Q", chromaqlighting: "Chroma-Q", briteq: "Briteq", jdc: "GLP",
  dts: "DTS", dtslighting: "DTS", ghost: "Ghost", colorkinetics: "Color Kinetics",
  traxon: "Traxon", lumenradio: "LumenRadio", claypakyspa: "Clay Paky", efflux: "Efflux",
  ledsistem: "Ledsistem", minuit: "Minuit Une", minuitune: "Minuit Une", cyclopean: "Cyclopean",
  fos: "", showtec: "Showtec", highlite: "Showtec", infinity: "Infinity", proel: "Proel",
  sagitter: "Sagitter", ledj: "LEDJ", equinox: "", wolfmix: "", astralpro: "",
  kvant: "Kvant", ludwig: "", luxibel: "Luxibel", stage: "", exalux: "Exalux",
  ambersky: "", lightpower: "Light Power", silverstar: "Silver Star", ekpro: "",
  claypakylighting: "Clay Paky", wildsun: "", cosmos: "",
};

const key = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** Returns the canonical professional brand name or null when the brand is not curated. */
export function canonicalBrand(raw: string): string | null {
  const v = BRAND_ALIASES[key(raw)];
  return v ? v : null;
}

/** Model identity for dedupe: drops brand repeats and orientation/version noise. */
export function modelKey(brand: string, model: string): string {
  let m = key(model);
  for (const b of [brand, ...Object.entries(BRAND_ALIASES).filter(([, v]) => v === brand).map(([k]) => k)]) {
    const bk = key(b);
    if (bk && m.startsWith(bk) && m.length > bk.length) m = m.slice(bk.length);
  }
  m = m.replace(/(centerinsertion|centreinsertion|90tocam|v\d+|rev\d+)$/g, "");
  if (brand === "Astera") m = m.replace(/^(fp\d|ax\d|ast[a-z]+|af\d+)(?=[a-z]{3,})/, "").replace(/tube$/, "");
  return m;
}

/** Higher is a more complete profile: modes, channels, icon, physical data. */
export function profileScore(d: { modes?: { channels?: unknown[] }[]; icon?: string; cct?: unknown; watts?: number }): number {
  const modes = d.modes ?? [];
  const ch = modes.reduce((n, m) => n + (m.channels?.length ?? 0), 0);
  return modes.length * 1000 + Math.min(ch, 999) + (d.icon ? 500 : 0) + (d.cct ? 200 : 0) + (d.watts ? 50 : 0);
}
