"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  Database,
  Globe2,
  Link2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { CAPABILITIES } from "@/lib/providers/capabilities";
import { DEMO_IDS } from "@/lib/providers/demo";
import type { CapabilityStatus } from "@/lib/providers/types";

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-[1.65rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">{title}</h2>
      {children ? <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{children}</p> : null}
    </div>
  );
}

function StatusPill({ status }: { status: CapabilityStatus }) {
  const { t } = useI18n();
  const tone = status === "available" ? "ok" : status === "requires-config" ? "warn" : status === "unsupported" ? "neutral" : "bad";
  return (
    <Badge tone={tone} dot>
      {t.home.statusLabels[status]}
    </Badge>
  );
}

export function LandingPage({ demoMode }: { demoMode: boolean }) {
  const { t } = useI18n();
  const demoId = DEMO_IDS[0];

  const capabilityPreview = [
    CAPABILITIES.instagram.find((c) => c.id === "parse-input"),
    CAPABILITIES.instagram.find((c) => c.id === "profile-lookup"),
    CAPABILITIES.instagram.find((c) => c.id === "visitor-identity"),
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <div className="overflow-hidden">
      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,var(--accent-soft)_0%,transparent_70%)]"
        />
        <div className="shell grid gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="max-w-2xl motion-safe:animate-rise">
            {demoMode ? (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet/30 bg-accent-soft px-3 py-1 text-[0.6875rem] font-semibold text-violet">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t.common.demoMode}
              </div>
            ) : (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 px-3 py-1 text-[0.6875rem] font-medium text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
                {t.home.eyebrow}
              </div>
            )}
            <h1 className="text-[2.35rem] font-semibold leading-[1.12] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[3.4rem]">
              {t.home.heading1}
              <span className="mt-1 block bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">
                {t.home.heading2}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-ink-2 sm:text-lg">{t.home.lede}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/search" className={buttonClass({ size: "lg" })}>
                <Search className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
                {t.home.finalCtaButton}
              </Link>
              <Link href="#how-data" className={buttonClass({ variant: "secondary", size: "lg" })}>
                {t.home.ctaHow}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-8 grid gap-2.5 text-sm text-ink-2 sm:grid-cols-3">
              {[t.home.trust1, t.home.trust2, t.home.trust3].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>

            {demoMode ? (
              <p className="mt-6 rounded-xl border border-dashed border-line-2 bg-paper-2/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink-2">
                {t.home.demoHint.replace("{identifier}", demoId)}
              </p>
            ) : null}
          </div>

          {/* Interface preview — deliberately contains no fabricated numbers */}
          <div className="relative motion-safe:animate-rise">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-accent/15 via-violet/10 to-transparent blur-2xl" aria-hidden="true" />
            <div className="rounded-card-lg border border-line bg-paper-2 p-5 shadow-float sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                <Wordmark compact />
                <Badge tone="neutral">{t.common.demo}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {[
                  { label: t.profile.followers, icon: Globe2 },
                  { label: t.profile.mediaCount, icon: BarChart3 },
                  { label: t.reports.observations, icon: Database },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-line bg-paper px-3 py-2.5">
                    <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                    <p className="mt-2 text-lg font-semibold tabular-nums text-ink-3">—</p>
                    <p className="truncate text-[0.625rem] uppercase tracking-wide text-ink-3">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-line bg-paper p-3.5">
                <div className="flex items-center justify-between text-[0.6875rem] text-ink-3">
                  <span>{t.dashboard.chartTitle}</span>
                  <span>{t.reports.chartTitle}</span>
                </div>
                <svg viewBox="0 0 320 96" className="mt-2 h-24 w-full" role="img" aria-label={t.dashboard.chartNote}>
                  <g stroke="var(--line)" strokeWidth="1">
                    {[24, 48, 72].map((y) => (
                      <line key={y} x1="0" y1={y} x2="320" y2={y} strokeDasharray="3 5" />
                    ))}
                  </g>
                  <path d="M6 74 L54 66 L102 70 L150 52 L198 58 L246 40 L314 46" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" strokeDasharray="5 5" />
                  {[[6, 74], [102, 70], [246, 40]].map(([x, y]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="var(--paper-2)" stroke="var(--accent)" strokeWidth="2" />
                  ))}
                </svg>
                <p className="mt-1 text-[0.625rem] leading-relaxed text-ink-3">{t.reports.missingLegend}</p>
              </div>

              <div className="mt-4 space-y-2">
                {[t.reports.daily, t.reports.weekly].map((label, index) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-line/70 px-3 py-2 text-xs">
                    <span className="text-ink-2">{label}</span>
                    <span className="flex gap-3 tabular-nums text-ink-3">
                      <span>—</span>
                      <span>{index === 0 ? t.reports.missing : t.reports.zero}</span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 flex items-start gap-2 text-[0.625rem] leading-relaxed text-ink-3">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t.common.na} · {t.home.accessEyebrow} · {t.demo.banner}
              </p>
            </div>
            <p className="mt-3 text-center text-[0.6875rem] text-ink-3">{t.brand.tagline}</p>
          </div>
        </div>

        {/* Capability strip */}
        <div className="shell">
          <div className="grid gap-3 rounded-card-lg border border-line bg-paper-2/70 p-4 sm:grid-cols-3 sm:p-5">
            {capabilityPreview.map((capability) => (
              <div key={capability.id} className="flex flex-col gap-2 rounded-xl border border-line/70 bg-paper px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {capability.id === "parse-input"
                      ? t.capabilities.ids["parse-input"]
                      : capability.id === "profile-lookup"
                        ? t.capabilities.ids["profile-lookup"]
                        : t.capabilities.ids["visitor-identity"]}
                  </span>
                  <StatusPill status={capability.status} />
                </div>
                <p className="text-xs leading-relaxed text-ink-3">
                  {capability.id === "parse-input"
                    ? t.search.hint
                    : capability.id === "profile-lookup"
                      ? t.search.states.notConfiguredBody
                      : t.home.faq[1].a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="shell py-16 sm:py-20">
        <SectionHeading eyebrow={t.home.featuresEyebrow} title={t.home.featuresTitle} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {t.home.features.map((feature, index) => {
            const Icon = [Link2, BadgeCheck, Database, BarChart3][index] ?? Link2;
            return (
              <article key={feature.title} className="group rounded-card-lg border border-line bg-paper-2 p-5 shadow-card transition-colors hover:border-accent/30 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <StatusPill status={feature.status} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------------- How data works ---------------- */}
      <section id="how-data" className="scroll-mt-20 border-y border-line bg-paper-2/60 py-16 sm:py-20">
        <div className="shell">
          <SectionHeading eyebrow={t.home.howEyebrow} title={t.home.howTitle} />
          <ol className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {t.home.steps.map((step, index) => (
              <li key={step.title} className="relative rounded-card-lg border border-line bg-paper p-5">
                <span className="text-[0.6875rem] font-semibold tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-dashed border-line-2 px-4 py-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t.home.accessNote}</span>
            <Link href="/privacy" className="font-medium text-accent hover:underline">
              {t.footer.privacy}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- Access rules ---------------- */}
      <section id="access" className="shell scroll-mt-20 py-16 sm:py-20">
        <SectionHeading eyebrow={t.home.accessEyebrow} title={t.home.accessTitle} />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-card-lg border border-ok/25 bg-ok-soft/40 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ok">
              <Check className="h-4 w-4" aria-hidden="true" />
              {t.home.accessTitle}
            </h3>
            <ul className="mt-4 space-y-3">
              {t.home.accessDo.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card-lg border border-bad/20 bg-bad-soft/40 p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-bad">
              <X className="h-4 w-4" aria-hidden="true" />
              {t.common.none}
            </h3>
            <ul className="mt-4 space-y-3">
              {t.home.accessDont.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 max-w-3xl rounded-xl bg-paper-3/60 px-4 py-3 text-xs leading-relaxed text-ink-2">{t.home.accessNote}</p>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-paper-2/60 py-16 sm:py-20">
        <div className="shell grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading eyebrow={t.home.faqEyebrow} title={t.home.faqTitle} />
          <div className="divide-y divide-line rounded-card-lg border border-line bg-paper">
            {t.home.faq.map((entry) => (
              <details key={entry.q} className="group px-5 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-ink focus-ring rounded">
                  {entry.q}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="pb-4 pe-8 text-[0.8125rem] leading-relaxed text-ink-2">{entry.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="shell py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-card-lg border border-accent/20 bg-gradient-to-br from-accent-soft via-paper-2 to-paper px-6 py-10 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -end-16 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{t.home.finalCtaTitle}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-2 sm:text-base">{t.home.finalCtaBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/search" className={buttonClass({ size: "lg" })}>
                {t.home.finalCtaButton}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/signup" className={buttonClass({ variant: "secondary", size: "lg" })}>
                {t.nav.signup}
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t.home.accessNote}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
