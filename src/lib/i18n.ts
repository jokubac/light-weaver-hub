// Multi-language support for the NOX console UI.
// Dictionaries live in src/lib/i18n/<code>.json and map the English UI string
// to its translation; a missing entry falls back to the English string itself.
// Each language file is lazy-loaded on first use to keep the startup bundle small.
export interface LangInfo { code: string; label: string; rtl?: boolean }

export const LANGS: LangInfo[] = [
  { code: "en", label: "English" },
  { code: "lt", label: "Lietuvių" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "uk", label: "Українська" },
  { code: "cs", label: "Čeština" },
  { code: "lv", label: "Latviešu" },
  { code: "et", label: "Eesti" },
  { code: "sv", label: "Svenska" },
  { code: "nb", label: "Norsk" },
  { code: "ru", label: "Русский" },
  { code: "tr", label: "Türkçe" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "vi", label: "Tiếng Việt" },
];

const LANG_KEY = "nox-lang";

const loaders = import.meta.glob("./i18n/*.json") as Record<string, () => Promise<{ default: Record<string, string> }>>;
const loaded = new Map<string, Record<string, string>>();

let lang = "en";
let version = 0;
const listeners = new Set<() => void>();
const pending = new Map<string, Promise<void>>();

function notify() {
  version++;
  for (const fn of listeners) fn();
}

export function getLang(): string {
  return lang;
}

export function isRtl(code = lang): boolean {
  return !!LANGS.find((l) => l.code === code)?.rtl;
}

/** Translate a UI string. Keys are the English strings themselves. */
export function t(key: string): string {
  if (lang === "en") return key;
  return loaded.get(lang)?.[key] ?? key;
}

function valid(code: string): boolean {
  return !!LANGS.some((l) => l.code === code);
}

async function ensureDict(code: string) {
  if (code === "en" || loaded.has(code)) return;
  let p = pending.get(code);
  if (!p) {
    p = (loaders[`./i18n/${code}.json`]?.() ?? Promise.reject(new Error(`no dictionary for ${code}`)))
      .then((m) => { loaded.set(code, m.default); pending.delete(code); });
    pending.set(code, p);
  }
  await p;
}

/** Switch the UI language. Loads the dictionary, saves the choice, re-renders. */
export async function setLang(code: string) {
  if (!valid(code) || code === lang) return;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* private mode */ }
  await ensureDict(code);
  if (lang === code) return;
  lang = code;
  notify();
}

/** Read the saved language on the client. Call once from a mount effect. */
export function loadSavedLang() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch { /* private mode */ }
  if (saved && saved !== lang && valid(saved)) void setLang(saved);
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function langVersion(): number {
  return version;
}
