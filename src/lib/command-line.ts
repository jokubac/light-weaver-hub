// Console command line: "1 + 3 + 5 @ 80", "1 THRU 10 @ FULL", "2 THRU 8 - 4", "@ 50".
// Fixture numbers are console positions (1-based). Browser-safe and pure.

export interface CommandResult {
  /** fixture numbers to select; undefined keeps the current selection */
  select?: number[];
  /** intensity 0..1; undefined leaves levels alone */
  level?: number;
  /** colour temperature in kelvin */
  cct?: number;
  levelDelta?: number;
  cctDelta?: number;
  /** ODD / EVEN / NTH with no numbers: thin the current selection (every `step`th, starting at `offset`) */
  pattern?: { step: number; offset: number };
  /** "REC …": store the typed selection (or the current one). kind defaults to a cue. */
  rec?: { kind: "cue" | "look" | "fx" | "timeline"; n?: number; mode?: "merge" | "overwrite" };
  error?: string;
}

/** Split "1 THRU 4 REC 5 MERGE" into the selection part and the REC target. */
export function parseRec(tokens: string[]): CommandResult["rec"] | { error: string } {
  const r = tokens.slice(tokens.indexOf("REC") + 1);
  let kind: "cue" | "look" | "fx" | "timeline" = "cue";
  if (r[0] && ["CUE", "LOOK", "FX", "TIMELINE", "SEQUENCE"].includes(r[0])) const kw = r.shift()!; kind = (kw === "SEQUENCE" ? "timeline" : kw.toLowerCase()) as typeof kind;
  let n: number | undefined;
  if (r[0] && /^\d+(\.\d+)?$/.test(r[0])) n = Number(r.shift());
  let mode: "merge" | "overwrite" | undefined;
  if (r[0] === "MERGE" || r[0] === "OVERWRITE") mode = r.shift()!.toLowerCase() as typeof mode;
  if (r.length) return { error: `Unknown "${r[0]}" after REC` };
  if (mode && kind !== "cue") return { error: "MERGE / OVERWRITE only apply to cues" };
  if (mode && n == null) return { error: "MERGE / OVERWRITE need a cue number, e.g. REC 5 MERGE" };
  return { kind, ...(n != null ? { n } : {}), ...(mode ? { mode } : {}) };
}

export function tokenize(cmd: string): string[] {
  return cmd.toUpperCase().replace(/THRU|>/g, " THRU ").replace(/CCT/g, " CCT ").replace(/([+\-@])/g, " $1 ").split(/\s+/).filter(Boolean);
}

export function parseCommand(cmd: string, count: number): CommandResult {
  const toks = tokenize(cmd);
  const ri = toks.indexOf("REC");
  if (ri >= 0) {
    const rec = parseRec(toks);
    if (rec && "error" in rec) return { error: rec.error };
    if (ri === 0) return { rec: rec! };
    const head = parseCommand(toks.slice(0, ri).join(" "), count);
    return head.error ? head : { ...head, rec: rec! };
  }
  const all = toks;
  const ci = all.indexOf("CCT");
  const t = ci < 0 ? all : all.slice(0, ci);
  let cct: number | undefined;
  let cctDelta: number | undefined;
  if (ci >= 0) {
    const raw = all.slice(ci + 1).join("").replace(/K$/, "");
    if (!/^[+-]?\d+(\.\d*)?$/.test(raw)) return { error: "CCT needs kelvin, e.g. CCT 3200 or CCT +200" };
    const k = Number(raw);
    if (/^[+-]/.test(raw)) cctDelta = Math.round(k);
    else {
      if (k < 1000 || k > 20000) return { error: "CCT range: 1000–20000 K" };
      cct = Math.round(k);
    }
    if (!t.length) return cctDelta != null ? { cctDelta } : cct != null ? { cct } : {};
  }
  if (!t.length) return { error: "Empty command" };
  if (t.length === 1 && t[0] === "NTH") return { error: "NTH needs a number, e.g. NTH 3" };
  const at = t.indexOf("@");
  const rawSel = at < 0 ? t : t.slice(0, at);
  // trailing ODD / EVEN thin the selection to every other light
  // "NTH 3" keeps every 3rd light of the range (or of the current selection)
  let step = 2;
  let thin = rawSel.includes("ODD") ? 0 : rawSel.includes("EVEN") ? 1 : -1;
  const ni = rawSel.indexOf("NTH");
  if (ni >= 0) {
    step = Number(rawSel[ni + 1]);
    if (!Number.isInteger(step) || step < 1) return { error: "NTH needs a number, e.g. NTH 3" };
    thin = 0;
  }
  const selTokens = rawSel.filter((x, i) => x !== "ODD" && x !== "EVEN" && x !== "NTH" && !(ni >= 0 && i === ni + 1));
  const lvlTokens = at < 0 ? [] : t.slice(at + 1);
  const res: CommandResult = cctDelta != null ? { cctDelta } : cct != null ? { cct } : {};

  if (selTokens.length) {
    const set = new Set<number>();
    let mode: "+" | "-" = "+";
    for (let i = 0; i < selTokens.length; i++) {
      const tok = selTokens[i];
      if (!tok) continue;
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
    if (thin >= 0) res.select = res.select.filter((_, i) => i % step === thin);
    if (!res.select.length) return { error: "No such lights" };
  } else if (thin >= 0) res.pattern = { step, offset: thin };

  if (at >= 0) {
    const v = lvlTokens.join("").replace(/%$/, "");
    if (v === "FULL") res.level = 1;
    else if (v === "OUT") res.level = 0;
    else {
      const n = Number(v);
      if (!/^[+-]?\d+(\.\d*)?$/.test(v) || !Number.isFinite(n)) return { error: "Level needs a number, FULL or OUT" };
      if (/^[+-]/.test(v)) res.levelDelta = n / 100;
      else res.level = Math.max(0, Math.min(100, n)) / 100;
    }
  }
  return res;
}
