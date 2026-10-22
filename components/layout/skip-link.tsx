"use client";

import { useI18n } from "@/lib/i18n/context";

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-accent-ink"
    >
      {t.nav.skip}
    </a>
  );
}
