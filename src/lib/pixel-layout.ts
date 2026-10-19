/** Physical pixel layout [cols, rows] (numbered row by row from top-left) for pixel modes whose profile has no explicit grid. */
const KNOWN: [RegExp, Record<number, [number, number]>][] = [
  [/skypanel.*s30|\bs30c?\b/i, { 2: [2, 1] }],
  [/skypanel.*s60|\bs60(c| pro)?\b/i, { 2: [2, 1], 4: [4, 1] }],
  [/skypanel.*s120|\bs120c?\b/i, { 2: [2, 1], 4: [4, 1] }],
  [/skypanel.*s360|\bs360c?\b/i, { 2: [2, 1], 12: [4, 3] }], // ARRI: 1-4 / 5-8 / 9-12 seen from the front
  [/skypanel-?x/i, { 2: [2, 1], 8: [4, 2], 16: [8, 2], 24: [12, 2] }],
];
const LINEAR = /tube|bar\b|batten|strip|line|linear|pixel ?line|dotline|infinibar|titan|helios|hyperion|pavotube|rainbow|rr\d|ladder|stick|edge|cyc ?bar|\bled ?bar/i;
const MATRIX = /matrix|panel|dot|pix|blinder|tile|square|grid|mat\b|wall|brick|nova|plate/i;

function nearSquare(n: number): [number, number] {
  for (let r = Math.floor(Math.sqrt(n)); r >= 2; r--) if (n % r === 0) return [n / r, r];
  return [n, 1];
}

export function pixelLayout(model: string, modeName: string, px: number): [number, number] | undefined {
  if (px < 2) return undefined;
  for (const [re, map] of KNOWN) if (re.test(model) && map[px]) return map[px];
  const nm = /(\d+)\s*[x×]\s*(\d+)/i.exec(`${modeName} ${model}`);
  if (nm) { const a = +nm[1]!, b = +nm[2]!; if (a * b === px) return [Math.max(a, b), Math.min(a, b)]; }
  if (LINEAR.test(model)) return [px, 1];
  const sq = Math.round(Math.sqrt(px));
  if (sq * sq === px && px >= 4) return [sq, sq];
  if (MATRIX.test(model)) { const g = nearSquare(px); return g[1] > 1 ? g : undefined; }
  return undefined;
}

/** Hexagon rows (pixel count per row, top to bottom), numbered row by row left to right from the front. */
const HEX: [RegExp, Record<number, number[]>][] = [
  [/sumo ?max/i, { 19: [3, 4, 5, 4, 3] }],
];

/** Exact pixel positions for fixtures whose pixels are not a plain rectangle; returns grid + one [x, y] per DMX pixel. */
export function pixelShape(model: string, px: number): { grid: [number, number]; cells: [number, number][] } | undefined {
  for (const [re, map] of HEX) {
    const rows = re.test(model) ? map[px] : undefined;
    if (!rows) continue;
    const wide = Math.max(...rows);
    const cells: [number, number][] = [];
    // half-cell offsets: a doubled grid keeps the honeycomb stagger exact
    rows.forEach((n, y) => { for (let j = 0; j < n; j++) cells.push([wide - n + j * 2, y]); });
    return { grid: [wide * 2 - 1, rows.length], cells };
  }
  return undefined;
}

/** Known manufacturer layouts win over guessed or generic GDTF grids. */
export function knownLayout(model: string, px: number): [number, number] | undefined {
  for (const [re, map] of KNOWN) if (re.test(model) && map[px]) return map[px];
  return undefined;
}
