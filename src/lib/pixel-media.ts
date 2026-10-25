// Video sources for pixel layers. Files live in this browser's IndexedDB (too big for project data);
// frames are sampled down to the layer's pixel map. Browser-only work happens lazily inside calls.
const DB = "nox-pixel-video", STORE = "video";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => { const q = fn(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}

interface Src { el: HTMLVideoElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; data: Uint8ClampedArray | null; at: number }
const sources = new Map<string, Src | "loading" | "missing">();

function attach(id: string, blob: Blob) {
  const el = document.createElement("video");
  el.src = URL.createObjectURL(blob);
  el.muted = true; el.loop = true; el.playsInline = true;
  void el.play().catch(() => { /* starts on next interaction */ });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  sources.set(id, { el, canvas, ctx, w: 0, h: 0, data: null, at: -1 });
}

export async function saveVideo(blob: Blob): Promise<string> {
  const id = `v-${Math.random().toString(36).slice(2, 10)}`;
  await tx("readwrite", (s) => s.put(blob, id));
  attach(id, blob);
  return id;
}
export const deleteVideo = (id: string) => { const s = sources.get(id); if (s && typeof s === "object") { s.el.pause(); URL.revokeObjectURL(s.el.src); } sources.delete(id); return tx("readwrite", (s) => s.delete(id)); };
export const videoMissing = (id?: string) => !!id && sources.get(id) === "missing";

/** RGBA frame of the video scaled to W×H (cover fit), or null while loading. */
export function videoFrame(id: string | undefined, W: number, H: number): Uint8ClampedArray | null {
  if (!id || typeof document === "undefined") return null;
  const s = sources.get(id);
  if (!s) {
    sources.set(id, "loading");
    void tx<Blob | undefined>("readonly", (st) => st.get(id) as IDBRequest<Blob | undefined>)
      .then((b) => (b ? attach(id, b) : sources.set(id, "missing"))).catch(() => sources.set(id, "missing"));
    return null;
  }
  if (typeof s !== "object" || s.el.readyState < 2) return null;
  if (s.el.paused) void s.el.play().catch(() => {});
  const t = s.el.currentTime;
  if (s.data && s.w === W && s.h === H && s.at === t) return s.data;
  if (s.canvas.width !== W || s.canvas.height !== H) { s.canvas.width = W; s.canvas.height = H; }
  const vw = s.el.videoWidth || 1, vh = s.el.videoHeight || 1, k = Math.max(W / vw, H / vh);
  const dw = vw * k, dh = vh * k;
  // Full-resolution frame averaged down (high-quality smoothing) so fine detail never flickers on the lights.
  s.ctx.imageSmoothingEnabled = true; s.ctx.imageSmoothingQuality = "high";
  s.ctx.drawImage(s.el, (W - dw) / 2, (H - dh) / 2, dw, dh);
  s.data = s.ctx.getImageData(0, 0, W, H).data; s.w = W; s.h = H; s.at = t;
  return s.data;
}
