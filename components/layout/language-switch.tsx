"use client";

import { useI18n } from "@/lib/i18n/context";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      className={cn("inline-flex items-center rounded-full border border-line bg-paper-2 p-0.5", className)}
      role="group"
      aria-label={t.nav.language}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          lang={code}
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide transition-colors focus-ring",
            locale === code ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink",
          )}
        >
          {code === "bn" ? "বাংলা" : "EN"}
        </button>
      ))}
    </div>
  );
}
