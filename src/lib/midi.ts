// MIDI controller mapping (Web MIDI — Chrome / Edge / Android; not available on iPad Safari).

export interface MidiMap { key: string; target: string; label: string }
export interface MidiMsg { key: string; value: number; isNote: boolean; on: boolean }

const KEY = "crmx-console-midi-v1";
export function loadMidi(): { enabled: boolean; maps: MidiMap[] } {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return { enabled: false, maps: [] };
}
export function saveMidi(m: { enabled: boolean; maps: MidiMap[] }) { localStorage.setItem(KEY, JSON.stringify(m)); }

export function parseMidi(data: Uint8Array): MidiMsg | null {
  const [st = 0, d1 = 0, d2 = 0] = data;
  const type = st & 0xf0, ch = (st & 0x0f) + 1;
  if (type === 0xb0) return { key: `CC ${ch}/${d1}`, value: d2 / 127, isNote: false, on: d2 > 0 };
  if (type === 0x90 || type === 0x80) return { key: `Note ${ch}/${d1}`, value: d2 / 127, isNote: true, on: type === 0x90 && d2 > 0 };
  return null;
}

/** Rebuilds a status byte from the Android MIDI plugin's message ("NoteOn", "NoteOff", "UNKNOWN - -80"). */
export function nativeMidiToBytes(msg: { type: string; note: number; velocity: number }): Uint8Array | null {
  let st: number;
  if (msg.type === "NoteOn") st = 0x90;
  else if (msg.type === "NoteOff") st = 0x80;
  else {
    const raw = Number(msg.type.split(" - ")[1]);
    if (!Number.isFinite(raw)) return null;
    st = raw < 0 ? raw + 256 : raw;
  }
  return new Uint8Array([st, msg.note & 0x7f, msg.velocity & 0x7f]);
}

async function listenNativeMidi(cb: (m: MidiMsg, device: string) => void, onDevices?: (names: string[]) => void) {
  const { MIDI } = await import("capacitor-midi");
  const handles: { remove: () => void }[] = [];
  const open = async (names: string[]) => {
    onDevices?.(names);
    for (let i = 0; i < names.length; i++) await MIDI.openDevice({ deviceNumber: i }).catch(() => {});
  };
  handles.push(await MIDI.addListener("MIDI_MSG_EVENT", (raw) => {
    const bytes = nativeMidiToBytes(raw); const m = bytes && parseMidi(bytes); if (m) cb(m, "USB MIDI");
  }));
  handles.push(await MIDI.addListener("MIDI_CON_EVENT", (d) => { void open(d.value); }));
  await MIDI.initConnectionListener().catch(() => {});
  await open((await MIDI.listMIDIDevices()).value);
  return () => handles.forEach((h) => h.remove());
}

/** Splits a raw CoreMIDI byte stream into 3-byte channel messages (status byte starts each one). */
export function splitMidiBytes(bytes: number[]): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80 && bytes[i] < 0xf0 && i + 2 < bytes.length + 0) out.push(new Uint8Array([bytes[i], bytes[i + 1] ?? 0, bytes[i + 2] ?? 0]));
  }
  return out;
}

async function listenIosMidi(cb: (m: MidiMsg, device: string) => void, onDevices?: (names: string[]) => void) {
  const { registerPlugin } = await import("@capacitor/core");
  type H = { remove: () => Promise<void> };
  const NoxMidi = registerPlugin<{
    start: () => Promise<{ names: string[] }>;
    addListener: (ev: string, fn: (d: any) => void) => Promise<H>;
  }>("NoxMidi");
  const handles = [
    await NoxMidi.addListener("message", (d: { bytes: number[] }) => {
      for (const b of splitMidiBytes(d.bytes)) { const m = parseMidi(b); if (m) cb(m, "MIDI"); }
    }),
    await NoxMidi.addListener("devices", (d: { names: string[] }) => onDevices?.(d.names)),
  ];
  onDevices?.((await NoxMidi.start()).names);
  return () => handles.forEach((h) => void h.remove());
}

/** Subscribes to every MIDI input. Returns an unsubscribe function. */
export async function listenMidi(cb: (m: MidiMsg, device: string) => void, onDevices?: (names: string[]) => void) {
  const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<any> };
  const w = globalThis as unknown as { Capacitor?: { getPlatform?: () => string } };
  if (!nav.requestMIDIAccess && w.Capacitor?.getPlatform?.() === "android") return listenNativeMidi(cb, onDevices);
  if (!nav.requestMIDIAccess && w.Capacitor?.getPlatform?.() === "ios") return listenIosMidi(cb, onDevices);
  if (!nav.requestMIDIAccess) throw new Error("This browser has no MIDI support. Use the installed NOX app, Chrome or Edge.");
  const access = await nav.requestMIDIAccess();
  const bind = () => {
    const names: string[] = [];
    access.inputs.forEach((inp: any) => {
      names.push(inp.name);
      inp.onmidimessage = (e: { data: Uint8Array }) => { const m = parseMidi(e.data); if (m) cb(m, inp.name); };
    });
    onDevices?.(names);
  };
  bind();
  access.onstatechange = bind;
  return () => { access.inputs.forEach((inp: any) => { inp.onmidimessage = null; }); access.onstatechange = null; };
}
