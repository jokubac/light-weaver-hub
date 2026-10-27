/** Every-other / every-Nth selection. Works on the current selection (in its order) or on everything when fewer than 2 are picked. */
export function pickPattern<T>(all: T[], current: T[], pattern: "odd" | "even" | number): T[] {
  const base = current.length > 1 ? all.filter((x) => current.includes(x)) : all;
  const n = pattern === "odd" || pattern === "even" ? 2 : Math.max(1, Math.floor(pattern));
  const offset = pattern === "even" ? 1 : 0;
  return base.filter((_, i) => i % n === offset);
}
