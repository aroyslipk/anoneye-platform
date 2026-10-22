"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, dictionaries, isLocale, type Dictionary, type Locale } from "./dictionaries";

const STORAGE_KEY = "anoneye.locale";

interface I18nValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

const listeners = new Set<() => void>();
let initialized = false;
let current: Locale = DEFAULT_LOCALE;

function getSnapshot(): Locale {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) current = stored;
    } catch {
      /* storage unavailable: keep the default */
    }
  }
  return current;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setLocaleGlobal(next: Locale) {
  current = next;
  initialized = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The server and the hydration render both use the default locale, so the
  // markup matches; the stored preference is applied right after hydration.
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: dictionaries[locale], setLocale: setLocaleGlobal }),
    [locale],
  );
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
