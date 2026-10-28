import { getDef, type PatchedFixture } from "./dmx";
import { groupsOf } from "./fixture-groups";

export type PatchSortKey = "number" | "name" | "fixture" | "mode" | "univ" | "dmx" | "ch" | "group";

/** Sorting never changes canonical console positions. */
export function patchRows(fixtures: PatchedFixture[], sort: { k: PatchSortKey; dir: 1 | -1 } | null) {
  const rows = fixtures.map((fixture, index) => ({ fixture, number: index + 1 }));
  if (!sort) return rows;
  const value = (row: typeof rows[number]): string | number => {
    const f = row.fixture, d = getDef(f.defId), m = d.modes[f.modeIdx];
    switch (sort.k) {
      case "number": return row.number;
      case "name": return f.name;
      case "fixture": return `${d.brand} ${d.model}`;
      case "mode": return m?.name ?? "";
      case "univ": return f.universe;
      case "dmx": return f.address;
      case "ch": return m?.channels ?? 1;
      case "group": return groupsOf(f)[0] ?? "\uffff";
    }
  };
  return rows.sort((a, b) => {
    const x = value(a), y = value(b);
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return cmp * sort.dir || a.number - b.number;
  });
}

export function movePatchFixture(fixtures: PatchedFixture[], uid: string, targetIndex: number): PatchedFixture[] {
  const from = fixtures.findIndex((f) => f.uid === uid);
  if (from < 0 || targetIndex < 0 || targetIndex >= fixtures.length || from === targetIndex) return fixtures;
  const result = [...fixtures];
  const [fixture] = result.splice(from, 1);
  if (!fixture) return fixtures;
  result.splice(targetIndex, 0, fixture);
  return result;
}
/** Moves a block of fixtures (kept in patch order) so its first fixture lands at targetIndex of the remaining list. */
export function movePatchBlock(fixtures: PatchedFixture[], uids: string[], targetIndex: number): PatchedFixture[] {
  const set = new Set(uids);
  const block = fixtures.filter((f) => set.has(f.uid));
  if (!block.length) return fixtures;
  const rest = fixtures.filter((f) => !set.has(f.uid));
  const at = Math.max(0, Math.min(rest.length, targetIndex));
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

/** Indices a dragged block will occupy when dropped on the row at dropIndex (in the current list). */
export function blockLanding(fixtures: PatchedFixture[], uids: string[], dropIndex: number): { insertAt: number; rows: number[] } {
  const set = new Set(uids);
  const before = fixtures.slice(0, dropIndex).filter((f) => !set.has(f.uid)).length;
  const n = fixtures.filter((f) => set.has(f.uid)).length;
  const draggedFirst = fixtures.findIndex((f) => set.has(f.uid));
  const insertAt = dropIndex > draggedFirst ? before + 1 - (set.has(fixtures[dropIndex]?.uid ?? "") ? 1 : 0) : before;
  return { insertAt, rows: Array.from({ length: n }, (_, i) => insertAt + i) };
}

/** Patch sheet clicks: tapping a light adds it to the pick, tapping it again drops only it. */
export function togglePick(picked: string[], uid: string): string[] {
  return picked.includes(uid) ? picked.filter((x) => x !== uid) : [...picked, uid];
}

/** Bulk names: "{n}" is replaced with start + i*step; without it the number is appended. A comma list is used as-is. */
export function renamePattern(pattern: string, count: number, start = 1, step = 1): string[] {
  if (pattern.includes(",")) {
    const list = pattern.split(",").map((s) => s.trim()).filter(Boolean);
    return Array.from({ length: count }, (_, i) => list[i] ?? `${list[list.length - 1] ?? ""} ${i + 1}`);
  }
  return Array.from({ length: count }, (_, i) => {
    const n = String(start + i * step);
    return pattern.includes("{n}") ? pattern.split("{n}").join(n) : `${pattern} ${n}`.trim();
  });
}

/**
 * Uids whose channels overlap another light's. Ranges are sorted per universe, so one pass
 * finds every clash instead of scanning the whole patch once per rendered row.
 */
/** One row that is open as a taller editor: `extra` is the height it adds beyond a plain row. */
export type ExpandedRow = { index: number; extra: number } | null;

/** Real pixel offset of a row: every row is rowH, except the one open as an editor. */
export function patchOffset(index: number, rowH: number, expanded: ExpandedRow = null): number {
  return index * rowH + (expanded && expanded.extra > 0 && index > expanded.index ? expanded.extra : 0);
}

/**
 * Rows inside the visible band of a virtualised sheet. The open editor is measured, not guessed —
 * otherwise the band is computed from the wrong offsets and scrolling throws the row being
 * edited (and with it the on-screen keyboard) out of the page.
 */
export function patchWindow(rows: number, at: number, height: number, rowH: number, overscan = 24, expanded: ExpandedRow = null) {
  const indexAt = (px: number) => {
    if (expanded && expanded.extra > 0) {
      const start = expanded.index * rowH;
      if (px > start && px < start + rowH + expanded.extra) return expanded.index;
      if (px >= start + rowH + expanded.extra) return expanded.index + 1 + Math.floor((px - start - rowH - expanded.extra) / rowH);
    }
    return Math.min(rows, Math.max(0, Math.floor(px / rowH)));
  };
  const top = Math.max(0, at);
  return {
    first: Math.max(0, indexAt(top) - overscan),
    last: Math.min(rows, indexAt(top + Math.max(0, height)) + 1 + overscan),
  };
}

/**
 * Uids whose channels overlap another light's. Ranges are sorted per universe, so one pass
 * finds every clash instead of scanning the whole patch once per rendered row.
 */
export function patchClashes(fixtures: PatchedFixture[]): Set<string> {
  const out = new Set<string>();
  const byUniverse = new Map<number, { uid: string; a: number; b: number }[]>();
  for (const f of fixtures) {
    const ch = Math.max(1, getDef(f.defId).modes[f.modeIdx]?.channels ?? 1);
    const list = byUniverse.get(f.universe) ?? [];
    list.push({ uid: f.uid, a: f.address, b: f.address + ch - 1 });
    byUniverse.set(f.universe, list);
  }
  for (const list of byUniverse.values()) {
    list.sort((x, y) => x.a - y.a || x.b - y.b);
    let prev: { uid: string; a: number; b: number } | null = null;
    for (const item of list) {
      if (prev && item.a <= prev.b) { out.add(item.uid); out.add(prev.uid); }
      if (!prev || item.b > prev.b) prev = item;
    }
  }
  return out;
}
