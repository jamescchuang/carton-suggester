import { createContext, useContext, useEffect, useState } from "react";
import enRaw from "./locales/en.properties?raw";
import zhRaw from "./locales/zh-Hant.properties?raw";

// Minimal Java-style .properties parser: `key = value`, ignoring blank lines
// and comments (# or !). The first `=` separates key from value.
export function parseProperties(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const DICTS = {
  en: parseProperties(enRaw),
  "zh-Hant": parseProperties(zhRaw),
};

// Each label is written in its own script, regardless of the active locale.
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "zh-Hant", label: "繁體中文" },
];

const STORAGE_KEY = "locale";

function detectLocale() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && DICTS[saved]) return saved;
  const nav = navigator.language || "";
  if (nav.toLowerCase().startsWith("zh")) return "zh-Hant";
  return "en";
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  function setLocale(code) {
    if (DICTS[code]) setLocaleState(code);
  }

  // Translate `key`, substituting {placeholder} tokens from `vars`.
  // Falls back to English, then to the raw key.
  function t(key, vars) {
    let str = DICTS[locale][key] ?? DICTS.en[key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replaceAll(`{${name}}`, String(value));
      }
    }
    return str;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
