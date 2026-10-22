"use client";

import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/context";

const subscribeNoop = () => () => {};
const clientYear = () => new Date().getFullYear();
const serverYear = () => null;

export function SiteFooter() {
  const { t } = useI18n();
  // Read on the client only: the build must not freeze a prerender-time year.
  const year = useSyncExternalStore(subscribeNoop, clientYear, serverYear);
  return (
    <footer className="mt-16 border-t border-line bg-paper-2/60">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-lg font-semibold tracking-[-0.02em]">Anoneye</span>
          </div>
          <p className="text-sm leading-relaxed text-ink-2">{t.brand.tagline}</p>
          <p className="text-xs leading-relaxed text-ink-3">{t.footer.note}</p>
        </div>

        <nav aria-label={t.footer.product} className="space-y-2.5 text-sm">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-3">{t.footer.product}</h2>
          {[
            { href: "/search", label: t.footer.search },
            { href: "/dashboard", label: t.footer.dashboard },
            { href: "/dashboard/reports", label: t.nav.reports },
            { href: "/settings", label: t.nav.settings },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
              {item.label}
            </Link>
          ))}
        </nav>

        <nav aria-label={t.footer.resources} className="space-y-2.5 text-sm">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-3">{t.footer.resources}</h2>
          <Link href="/#how-data" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.home.howEyebrow}
          </Link>
          <Link href="/#access" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.home.accessEyebrow}
          </Link>
          <Link href="/contact" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.footer.contact}
          </Link>
          <Link href="/#faq" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.home.faqTitle}
          </Link>
        </nav>

        <nav aria-label={t.footer.legal} className="space-y-2.5 text-sm">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-3">{t.footer.legal}</h2>
          <Link href="/privacy" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.footer.terms}
          </Link>
          <Link href="/contact" className="block text-ink-2 transition-colors hover:text-ink focus-ring rounded">
            {t.footer.contact}
          </Link>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-3 py-5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year ? `${year} ` : ""}Anoneye. {t.footer.rights}</p>
          <LanguageSwitch />
        </div>
      </div>
    </footer>
  );
}
