// Timeline soundtracks are kept in the browser's IndexedDB (too large for project JSON).
const DB = "nox-timeline-audio", STORE = "audio";
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
export const saveAudio = (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key));
export const loadAudio = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteAudio = (key: string) => tx("readwrite", (s) => s.delete(key));

/** Peak amplitudes (0..1) for drawing a waveform. */
export async function peaks(blob: Blob, n = 2000): Promise<{ peaks: number[]; duration: number }> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const d = buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out: number[] = [];
    for (let i = 0; i < d.length; i += step) { let m = 0; for (let j = i; j < Math.min(d.length, i + step); j++) m = Math.max(m, Math.abs(d[j]!)); out.push(m); }
    return { peaks: out, duration: buf.duration };
  } finally { void ctx.close(); }
}
