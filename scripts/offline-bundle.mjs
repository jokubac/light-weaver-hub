// Downloads the published NOX app (HTML + every JS/CSS chunk it can reach) into a
// folder the Android/iOS apps bundle, so the installed app opens without internet.
// Usage: node scripts/offline-bundle.mjs [siteUrl] [outDir]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = (process.argv[2] || "https://light-weaver-hub.lovable.app").replace(/\/$/, "");
const OUT = process.argv[3] || "offline-app";

const seen = new Set();
const queue = [];
const add = (p) => { if (!seen.has(p)) { seen.add(p); queue.push(p); } };

const html = await (await fetch(SITE + "/")).text();
if (!html.includes("<html")) throw new Error("Published site did not return HTML");
const refs = (text, base) => {
  const out = [];
  for (const m of text.matchAll(/["'(]((?:\/|\.\/|\.\.\/)?assets\/[^"'()\s?#]+)/g)) out.push(new URL(m[1], SITE + base).pathname);
  for (const m of text.matchAll(/["'(](\.\/[\w.-]+\.(?:js|css|woff2?|png|jpg|svg))/g)) out.push(new URL(m[1], SITE + base).pathname);
  return out;
};
refs(html, "/").forEach(add);
["/favicon.png", "/icon-512.png", "/manifest.webmanifest", "/crmx-bridge.mjs"].forEach(add);

while (queue.length) {
  const p = queue.shift();
  const r = await fetch(SITE + p);
  if (!r.ok) { console.warn("skip", p, r.status); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  const file = join(OUT, p);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  if (/\.(js|css)$/.test(p)) refs(buf.toString("utf8"), p).forEach(add);
}
await writeFile(join(OUT, "index.html"), html);
console.log(`Bundled ${seen.size} files from ${SITE} into ${OUT}`);
