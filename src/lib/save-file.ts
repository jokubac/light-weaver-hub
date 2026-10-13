// Saves a file on every platform: native share sheet in the installed Android/iOS app,
// share sheet on touch browsers, and a normal download on desktop/Windows app.
function isNative(): boolean {
  const w = globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  try { return !!w.Capacitor?.isNativePlatform?.(); } catch { return false; }
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function safeFileName(name: string, fallback = "nox") {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const res = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: Directory.Cache });
    try { await Share.share({ title: filename, files: [res.uri] }); }
    catch (e) { if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e; }
    return;
  }
  const file = new File([blob], filename, { type: blob.type });
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
