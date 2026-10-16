/** Physical pixel layout [cols, rows] (numbered row by row from top-left) for pixel modes whose profile has no explicit grid. */
const KNOWN: [RegExp, Record<number, [number, number]>][] = [
  [/skypanel.*s30|\bs30c?\b/i, { 2: [2, 1] }],
  [/skypanel.*s60|\bs60(c| pro)?\b/i, { 2: [2, 1], 4: [4, 1] }],
  [/skypanel.*s120|\bs120c?\b/i, { 2: [2, 1], 4: [4, 1] }],
  [/skypanel.*s360|\bs360c?\b/i, { 2: [2, 1], 12: [6, 2] }],
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
