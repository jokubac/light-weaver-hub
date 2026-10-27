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
