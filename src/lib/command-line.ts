// Console command line: "1 + 3 + 5 @ 80", "1 THRU 10 @ FULL", "2 THRU 8 - 4", "@ 50".
// Fixture numbers are console positions (1-based). Browser-safe and pure.

export interface CommandResult {
  /** fixture numbers to select; undefined keeps the current selection */
  select?: number[];
  /** intensity 0..1; undefined leaves levels alone */
  level?: number;
  /** colour temperature in kelvin */
  cct?: number;
  error?: string;
}

export function tokenize(cmd: string): string[] {
  return cmd.toUpperCase().replace(/THRU|>/g, " THRU ").replace(/CCT/g, " CCT ").replace(/([+\-@])/g, " $1 ").split(/\s+/).filter(Boolean);
}

export function parseCommand(cmd: string, count: number): CommandResult {
  const all = tokenize(cmd);
  const ci = all.indexOf("CCT");
  const t = ci < 0 ? all : all.slice(0, ci);
  let cct: number | undefined;
  if (ci >= 0) {
    const k = Number(all.slice(ci + 1).join("").replace(/K$/, ""));
    if (!Number.isFinite(k) || k < 1000 || k > 20000) return { error: "CCT needs kelvin, e.g. CCT 3200" };
    cct = Math.round(k);
    if (!t.length) return { cct };
  }
  if (!t.length) return { error: "Empty command" };
  const at = t.indexOf("@");
  const selTokens = at < 0 ? t : t.slice(0, at);
  const lvlTokens = at < 0 ? [] : t.slice(at + 1);
  const res: CommandResult = cct != null ? { cct } : {};

  if (selTokens.length) {
    const set = new Set<number>();
    let mode: "+" | "-" = "+";
    for (let i = 0; i < selTokens.length; i++) {
      const tok = selTokens[i]!;
      if (tok === "+" || tok === "-") { mode = tok; continue; }
      const a = Number(tok);
      if (!Number.isInteger(a)) return { error: `Unknown "${tok}"` };
      let nums = [a];
      if (selTokens[i + 1] === "THRU") {
        const b = Number(selTokens[i + 2]);
        if (!Number.isInteger(b)) return { error: "THRU needs an end number" };
        nums = [];
        for (let n = Math.min(a, b); n <= Math.max(a, b); n++) nums.push(n);
        i += 2;
      }
      for (const n of nums) if (n >= 1 && n <= count) (mode === "+" ? set.add(n) : set.delete(n));
    }
    res.select = [...set].sort((x, y) => x - y);
    if (!res.select.length) return { error: "No such lights" };
  }

  if (at >= 0) {
    const v = lvlTokens.join("");
    if (v === "FULL") res.level = 1;
    else if (v === "OUT") res.level = 0;
    else {
      const n = Number(v);
      if (!v || !Number.isFinite(n)) return { error: "Level needs a number, FULL or OUT" };
      res.level = Math.max(0, Math.min(100, n)) / 100;
    }
  }
  return res;
}
