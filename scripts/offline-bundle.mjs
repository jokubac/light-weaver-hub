// Downloads the published NOX app (HTML + every JS/CSS chunk it can reach) into a
// folder the Android/iOS apps bundle, so the installed app opens without internet.
// Usage: node scripts/offline-bundle.mjs [siteUrl] [outDir]
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE = (process.argv[2] || "https://light-weaver-hub.lovable.app").replace(/\/$/, "");
const OUT = process.argv[3] || "offline-app";

const seen = new Set();
const queue = [];
const add = (p) => { if (!seen.has(p)) { seen.add(p); queue.push(p); } };

const expected = JSON.parse(await readFile(new URL("../public/app-release.json", import.meta.url), "utf8"));
const releaseResponse = await fetch(SITE + "/app-release.json", { cache: "no-store" });
if (!releaseResponse.ok) throw new Error("Publish the current NOX release before building the installed app (app-release.json is missing).");
const published = await releaseResponse.json();
if (published.version !== expected.version) throw new Error(`Publish NOX ${expected.version} first; the site still serves ${published.version}.`);
await mkdir(OUT, { recursive: true });
const pageResponse = await fetch(SITE + "/", { cache: "no-store" });
if (!pageResponse.ok) throw new Error(`Published page failed: ${pageResponse.status}`);
// Hosting injects an "Edit with Lovable" badge (style + link + script); the installed app is standalone, so strip it.
export const stripHostingBadge = (text) => text
  .replace(/<style>(?:(?!<\/style>)[\s\S])*?lovable-badge[\s\S]*?<\/style>/g, "")
  .replace(/<script>(?:(?!<\/script>)[\s\S])*?lovable-badge[\s\S]*?<\/script>/g, "")
  .replace(/<a[^>]*id="lovable-badge"[\s\S]*?<\/a>/g, "");
const html = stripHostingBadge(await pageResponse.text());
if (!html.includes("<html")) throw new Error("Published site did not return HTML");
if (html.includes("lovable-badge")) throw new Error("Could not remove the hosting badge from the offline app");
const refs = (text, base) => {
  const out = [];
  for (const m of text.matchAll(/["'(]((?:\/|\.\/|\.\.\/)?assets\/[^"'()\s?#]+)/g)) out.push(new URL(m[1].startsWith("assets/") ? "/" + m[1] : m[1], SITE + base).pathname);
  for (const m of text.matchAll(/["'(](\.\/[\w.-]+\.(?:js|css|woff2?|png|jpg|svg))/g)) out.push(new URL(m[1], SITE + base).pathname);
  return out;
};
refs(html, "/").forEach(add);
["/app-release.json", "/favicon.png", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest", "/nox-logo.svg", "/crmx-bridge.mjs"].forEach(add);

while (queue.length) {
  const p = queue.shift();
  const r = await fetch(SITE + p, { cache: "no-store" });
  if (!r.ok) throw new Error(`Cannot bundle ${p}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const file = join(OUT, p);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  if (/\.(js|css)$/.test(p)) refs(buf.toString("utf8"), p).forEach(add);
}
await writeFile(join(OUT, "index.html"), html);
console.log(`Bundled ${seen.size} files from ${SITE} into ${OUT}`);
