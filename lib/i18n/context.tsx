"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, dictionaries, isLocale, type Dictionary, type Locale } from "./dictionaries";

const STORAGE_KEY = "anoneye.locale";

interface I18nValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render always use the default locale so markup matches.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored) && stored !== DEFAULT_LOCALE) setLocaleState(stored);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(() => ({ locale, t: dictionaries[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Locale-aware number formatting (Bangla digits when the UI is in Bangla). */
export function useNumberFormat() {
  const { locale } = useI18n();
  return useMemo(() => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US"), [locale]);
}

export function useDateFormat(options?: Intl.DateTimeFormatOptions) {
  const { locale } = useI18n();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", options ?? { dateStyle: "medium", timeStyle: "short" }),
    [locale, options],
  );
}
