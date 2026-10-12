import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function bundle(version) {
  const out = await mkdtemp(join(tmpdir(), "nox-bundle-test-"));
  const server = createServer((req, res) => {
    if (req.url === "/app-release.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ version }));
    } else if (req.url === "/") res.end("<html><body>NOX</body></html>");
    else res.end("asset");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const child = spawn(process.execPath, ["scripts/offline-bundle.mjs", `http://127.0.0.1:${address.port}`, out]);
    let stderr = "";
    child.stderr.on("data", data => { stderr += data; });
    const code = await new Promise(resolve => child.on("close", resolve));
    return { code, stderr, html: code === 0 ? await readFile(join(out, "index.html"), "utf8") : null };
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(out, { recursive: true, force: true });
  }
}

test("installed app rejects an older published release", async () => {
  const result = await bundle("1.0.0");
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Publish NOX 1\.1\.0 first/);
});

test("installed app bundles the current published release", async () => {
  const result = await bundle("1.1.0");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.html, "<html><body>NOX</body></html>");
});