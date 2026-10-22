"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldQuestion } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";

export type ProfileStateKind =
  | "not-configured"
  | "unauthorized"
  | "rate-limited"
  | "not-found"
  | "unsupported"
  | "unavailable";

export function ProfileState({
  kind,
  platform,
  identifier,
  canonicalUrl,
  missing,
  retryAfterSeconds,
}: {
  kind: ProfileStateKind;
  platform: "instagram" | "facebook";
  identifier: string;
  canonicalUrl: string;
  missing?: string[];
  retryAfterSeconds?: number;
}) {
  const { t } = useI18n();
  const platformLabel = platform === "instagram" ? t.platform.instagram : t.platform.facebook;

  const copy = {
    "not-configured": { tone: "warn" as const, title: t.search.states.notConfiguredTitle, body: t.search.states.notConfiguredBody },
    unauthorized: { tone: "warn" as const, title: t.search.states.unauthorizedTitle, body: t.search.states.unauthorizedBody },
    "rate-limited": { tone: "warn" as const, title: t.search.states.rateLimitedTitle, body: t.search.states.rateLimitedBody },
    "not-found": { tone: "neutral" as const, title: t.search.states.notFoundTitle, body: t.search.states.notFoundBody },
    unsupported: { tone: "neutral" as const, title: t.search.states.unsupportedTitle, body: t.search.states.unsupportedBody },
    unavailable: { tone: "bad" as const, title: t.search.states.unavailableTitle, body: t.search.states.unavailableBody },
  }[kind];

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/search" className="text-xs font-medium text-ink-3 hover:text-ink">← {t.search.back}</Link>
          <Badge tone="neutral">@{identifier}</Badge>
          <Badge tone="accent">{platformLabel}</Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">{copy.title}</h1>
        <div className="mt-4">
          <Alert tone={copy.tone}>
            <p>{copy.body}</p>
            {kind === "not-configured" && missing ? (
              <>
                <p className="mt-2 text-xs font-medium text-ink">{t.search.states.notConfiguredSteps}:</p>
                <ul className="mt-1.5 space-y-1 text-xs">
                  {missing.map((item) => (
                    <li key={item}><code className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[0.6875rem]">{item}</code></li>
                  ))}
                </ul>
              </>
            ) : null}
            {kind === "rate-limited" && retryAfterSeconds ? (
              <p className="mt-2 text-xs text-ink-3">retry-after: {retryAfterSeconds}s</p>
            ) : null}
          </Alert>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={canonicalUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass({ variant: "secondary", size: "sm" })}>
            {t.profile.openOriginal.replace("{platform}", platformLabel)}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/search" className={buttonClass({ variant: "ghost", size: "sm" })}>{t.search.newSearch}</Link>
          <Link href="/settings" className={buttonClass({ variant: "ghost", size: "sm" })}>{t.nav.settings}</Link>
        </div>

        <div className="mt-8 flex items-start gap-2 rounded-xl border border-dashed border-line-2 bg-paper-2/60 px-4 py-3 text-xs leading-relaxed text-ink-3">
          <ShieldQuestion className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t.home.accessNote}</span>
        </div>
      </div>
    </div>
  );
}
