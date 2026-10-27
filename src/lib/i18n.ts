// Multi-language support for the NOX console UI.
// Dictionaries live in src/lib/i18n/<code>.json and map the English UI string
// to its translation; a missing entry falls back to the English string itself.
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

const modules = import.meta.glob("./i18n/*.json", { eager: true, import: "default" }) as Record<string, Record<string, string>>;
const dicts = new Map<string, Record<string, string>>();
for (const [path, dict] of Object.entries(modules)) {
  const code = path.replace(/^.*\/i18n\//, "").replace(/\.json$/, "");
  dicts.set(code, dict);
}

let lang = "en";
let version = 0;
const listeners = new Set<() => void>();

export function getLang(): string {
  return lang;
}

export function isRtl(code = lang): boolean {
  return !!LANGS.find((l) => l.code === code)?.rtl;
}

/** Translate a UI string. Keys are the English strings themselves. */
export function t(key: string): string {
  if (lang === "en") return key;
  return dicts.get(lang)?.[key] ?? key;
}

export function setLang(code: string) {
  if (!LANGS.some((l) => l.code === code) || code === lang) return;
  lang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* private mode */ }
  version++;
  for (const fn of listeners) fn();
}

/** Read the saved language on the client. Call once from a mount effect. */
export function loadSavedLang() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch { /* private mode */ }
  if (saved && saved !== lang && LANGS.some((l) => l.code === saved)) {
    lang = saved;
    version++;
    for (const fn of listeners) fn();
  }
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function langVersion(): number {
  return version;
}
