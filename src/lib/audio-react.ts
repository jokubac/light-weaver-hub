// Sound-reactive PIXEL effects. Audio is analysed locally (never re-encoded); mic/line input is
// requested with echo cancellation, noise suppression and auto gain OFF so the signal stays raw.
import type { PixelLayer } from "./pixels";

export type Band = "bass" | "mid" | "high" | "level";
export interface AudioTarget { on: boolean; band: Band; amount: number }
export interface AudioReact {
  enabled: boolean;
  bright?: AudioTarget; // brightness pulses on beat
  speed?: AudioTarget; // effect speed follows the band
  spin?: AudioTarget; // box rotates with the sound
  size?: AudioTarget; // band width grows with the band
  colour?: AudioTarget; // palette shifts with the band
  // video-only sound FX
  zoom?: AudioTarget; // picture punches in
  hue?: AudioTarget; // colours rotate
  glitch?: AudioTarget; // RGB split + row tearing
  flash?: AudioTarget; // white flash on beat
}
export interface AudioSettings { source: "mic" | "input" | "device" | "file" | "timeline"; deviceId?: string | undefined; outputId?: string | undefined; gain: number; threshold: number; attack: number; release: number }
export interface Levels { bass: number; mid: number; high: number; level: number; beat: boolean }
/** Live sound-driven video effect amounts (0–1). */
export interface VideoFx { zoom: number; hue: number; glitch: number; flash: number }

export const AUDIO_TARGETS: [keyof Omit<AudioReact, "enabled">, string, Band][] = [
  ["bright", "Brightness on beat", "bass"], ["speed", "Speed", "bass"], ["spin", "Spin", "level"], ["size", "Size", "high"], ["colour", "Colour", "high"],
];
export const VIDEO_AUDIO_TARGETS: [keyof Omit<AudioReact, "enabled">, string, Band][] = [
  ["zoom", "Zoom punch", "bass"], ["hue", "Hue shift", "mid"], ["glitch", "Glitch", "high"], ["flash", "Flash on beat", "bass"],
];
export const defaultAudioSettings = (): AudioSettings => ({ source: "mic", gain: 1, threshold: 0.05, attack: 0.02, release: 0.25 });

const ZERO: Levels = { bass: 0, mid: 0, high: 0, level: 0, beat: false };
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let srcNode: AudioNode | null = null;
let stream: MediaStream | null = null;
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let timelineEl: HTMLMediaElement | null = null;
let settings = defaultAudioSettings();
let env: Levels = { ...ZERO };
let lastAt = 0, avgBass = 0;
const rot = new Map<string, number>();
let bins: Uint8Array<ArrayBuffer> | null = null;

let fileEl: HTMLAudioElement | null = null;
let fileUrl: string | null = null;
/** Loads a WAV/AIFF/FLAC/MP3 file for the "file" source. WAV/AIFF/FLAC stay lossless; the file is played as-is. */
export function loadAudioFile(f: File) {
  if (fileUrl) URL.revokeObjectURL(fileUrl);
  fileUrl = URL.createObjectURL(f);
  fileEl ??= new Audio();
  fileEl.loop = true; fileEl.src = fileUrl;
  return f.name;
}
export const audioFileEl = () => fileEl;
export async function listOutputs(): Promise<MediaDeviceInfo[]> {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput"); } catch { return []; }
}
/** Sends played audio (file / TIMELINE) to the chosen output device, untouched. */
async function routeOutput(id?: string) {
  const c = ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
  try { if (c?.setSinkId) await c.setSinkId(id ?? ""); } catch { /* unsupported device */ }
}
export function setTimelineAudio(el: HTMLMediaElement | null) { timelineEl = el; }
export function setAudioSettings(s: Partial<AudioSettings>) { settings = { ...settings, ...s }; }
export const audioRunning = () => !!analyser;

export async function listInputs(): Promise<MediaDeviceInfo[]> {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"); } catch { return []; }
}

export function stopAudio() {
  fileEl?.pause();
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  try { srcNode?.disconnect(); } catch { /* ignore */ }
  srcNode = null; analyser = null; env = { ...ZERO };
}

/** Starts listening. Raw input: no browser processing, no compression. */
export async function startAudio(s: AudioSettings) {
  stopAudio(); settings = s;
  ctx ??= new AudioContext({ latencyHint: "interactive" });
  await routeOutput(s.outputId);
  if (ctx.state === "suspended") await ctx.resume();
  const a = ctx.createAnalyser(); a.fftSize = 1024; a.smoothingTimeConstant = 0;
  if (s.source === "timeline" || s.source === "file") {
    const el = s.source === "file" ? fileEl : timelineEl;
    if (!el) throw new Error(s.source === "file" ? "Choose a WAV or audio file first" : "Load an audio track on the TIMELINE first");
    let node = elementSources.get(el);
    if (!node) { node = ctx.createMediaElementSource(el); node.connect(ctx.destination); elementSources.set(el, node); }
    node.connect(a); srcNode = node;
    if (s.source === "file") await el.play().catch(() => undefined);
  } else if (s.source === "device") {
    // Whatever this computer/tab is playing. Raw: browser processing off. Desktop Chrome/Edge/Windows app only.
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Device audio isn't available here — use a sound card input or a file");
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: "include" } as DisplayMediaStreamOptions);
    stream.getVideoTracks().forEach((t) => t.stop());
    if (!stream.getAudioTracks().length) throw new Error("No sound shared — tick “Share audio” / “Share system audio”");
    const node = ctx.createMediaStreamSource(stream); node.connect(a); srcNode = node;
  } else {
    stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      ...(s.source === "input" && s.deviceId ? { deviceId: { exact: s.deviceId } } : {}),
    } });
    const node = ctx.createMediaStreamSource(stream); node.connect(a); srcNode = node; // not routed to speakers
  }
  analyser = a; bins = new Uint8Array(a.frequencyBinCount);
}

/** Envelope follower: rises at `attack` seconds, falls at `release` seconds. Pure for tests. */
export function follow(prev: number, input: number, dt: number, attack: number, release: number) {
  const tc = input > prev ? attack : release;
  return prev + (input - prev) * (tc <= 0 ? 1 : 1 - Math.exp(-dt / tc));
}

/** Current band levels (0–1), updated at most once per ~8 ms. */
export function levels(): Levels {
  if (!analyser || !bins || !ctx) return ZERO;
  const now = performance.now();
  if (now - lastAt < 8) return env;
  const dt = Math.min(0.1, (now - (lastAt || now)) / 1000); lastAt = now;
  analyser.getByteFrequencyData(bins);
  const hz = ctx.sampleRate / analyser.fftSize;
  const band = (lo: number, hi: number) => { let s = 0, n = 0; for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(bins!.length - 1, Math.ceil(hi / hz)); i++) { s += bins![i]!; n++; } return n ? s / n / 255 : 0; };
  const g = settings.gain, gate = (v: number) => (v < settings.threshold ? 0 : Math.min(1, (v - settings.threshold) / (1 - settings.threshold)));
  const raw = { bass: gate(band(20, 150) * g), mid: gate(band(150, 2000) * g), high: gate(band(2000, 12000) * g) };
  const level = (raw.bass + raw.mid + raw.high) / 3;
  const beat = raw.bass > 0.15 && raw.bass > avgBass * 1.4;
  avgBass = avgBass * 0.95 + raw.bass * 0.05;
  env = {
    bass: follow(env.bass, raw.bass, dt, settings.attack, settings.release),
    mid: follow(env.mid, raw.mid, dt, settings.attack, settings.release),
    high: follow(env.high, raw.high, dt, settings.attack, settings.release),
    level: follow(env.level, level, dt, settings.attack, settings.release), beat,
  };
  return env;
}

/** The layer as the sound shapes it right now. Pure given `lv` and the spin accumulator. */
export function applyAudio(l: PixelLayer & { audio?: AudioReact }, lv: Levels, dt = 1 / 60): PixelLayer {
  const a = l.audio;
  if (!a?.enabled) return l;
  const v = (t?: AudioTarget) => (t?.on ? lv[t.band] * t.amount : 0);
  const out: PixelLayer = { ...l };
  if (a.bright?.on) out.brightness = (l.brightness ?? 1) * (1 - a.bright.amount + v(a.bright));
  if (a.speed?.on) out.speed = l.speed * (1 + v(a.speed) * 4);
  if (a.size?.on) out.size = Math.max(1, l.size * (1 + v(a.size) * 3));
  if (a.colour?.on) out.phase = (l.phase ?? 0) + v(a.colour) * 2;
  if (l.kind === "video" && (a.zoom?.on || a.hue?.on || a.glitch?.on || a.flash?.on)) {
    out.vfx = { zoom: v(a.zoom), hue: v(a.hue), glitch: v(a.glitch), flash: a.flash?.on && lv.beat ? a.flash.amount : 0 };
  }
  if (a.spin?.on) {
    const r = (rot.get(l.id) ?? 0) + v(a.spin) * 360 * dt;
    rot.set(l.id, r % 360);
    out.angle = (l.angle ?? 0) + r;
  }
  return out;
}

let lastSpin = 0;
/** Applies live audio to every sound-enabled layer (no-op when nothing is listening). */
export function withAudio<L extends PixelLayer>(layers: L[]): L[] {
  if (!analyser || !layers.some((l) => (l as { audio?: AudioReact }).audio?.enabled)) return layers;
  const now = performance.now(), dt = Math.min(0.1, (now - (lastSpin || now)) / 1000); lastSpin = now;
  const lv = levels();
  return layers.map((l) => (l.playing ? applyAudio(l, lv, dt) as L : l));
}
