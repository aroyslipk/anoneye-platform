"use client";

import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useDateFormat, useI18n } from "@/lib/i18n/context";
import { LEGAL_CONTENT } from "@/lib/legal";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { t, locale } = useI18n();
  const date = useDateFormat({ dateStyle: "long" });
  const sections = LEGAL_CONTENT[kind][locale];
  const title = kind === "privacy" ? t.legal.privacyTitle : t.legal.termsTitle;
  const intro = kind === "privacy" ? t.legal.privacyIntro : t.legal.termsIntro;

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <Link href="/" className="hover:text-ink">← {t.common.back}</Link>
          <span aria-hidden="true">·</span>
          <span>{t.legal.updated}: {date.format(new Date("2026-10-22T00:00:00.000Z"))}</span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">{intro}</p>

        <div className="mt-5">
          <Alert tone="warn" title={t.legal.draftNotice}>
            <p className="flex items-start gap-2 text-xs">
              <FileWarning className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Anoneye is a starter project; the operator must review and adapt this document before a public launch.
            </p>
          </Alert>
        </div>

        <nav aria-label={t.legal.sections} className="mt-6 rounded-xl border border-line bg-paper-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t.legal.sections}</p>
          <ol className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.heading}>
                <a href={`#section-${index + 1}`} className="text-ink-2 hover:text-accent hover:underline">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="prose-legal mt-8">
          {sections.map((section, index) => (
            <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-20">
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <div className="mt-10 rounded-xl border border-dashed border-line-2 px-4 py-3 text-xs leading-relaxed text-ink-3">
          <p>{t.footer.note}</p>
          <Link href="/contact" className="mt-1 inline-block font-medium text-accent hover:underline">{t.footer.contact}</Link>
        </div>
      </div>
    </div>
  );
}
