"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarClock, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { MetricGrid } from "@/components/profile/metric-grid";
import { ProviderGlyph } from "@/components/ui/brand-icons";
import { SafeImage } from "@/components/ui/safe-image";
import { useDateFormat, useI18n } from "@/lib/i18n/context";
import type { PublicProfile } from "@/lib/providers/types";

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  const { t } = useI18n();
  const dateTime = useDateFormat();
  const platformLabel = profile.platform === "instagram" ? t.platform.instagram : t.platform.facebook;

  return (
    <div className="rounded-card-lg border border-line bg-paper-2 p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <SafeImage
          src={profile.profilePictureUrl}
          alt={profile.displayName ?? profile.username}
          fallbackLabel={t.profile.imageUnavailable}
          className="h-16 w-16 shrink-0 rounded-2xl border border-line sm:h-20 sm:w-20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              <ProviderGlyph platform={profile.platform} className="h-3.5 w-3.5" />
              {platformLabel}
            </Badge>
            {profile.demo ? <Badge tone="demo">{t.demo.badge}</Badge> : null}
            {profile.verified ? (
              <Badge tone="ok">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t.profile.verified}
              </Badge>
            ) : null}
            <Badge tone="neutral">{profile.accountKind === "page" ? t.profile.page : t.profile.professional}</Badge>
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold tracking-[-0.02em] text-ink">
            {profile.displayName ?? `@${profile.username}`}
          </h2>
          <p className="text-sm text-ink-3">@{profile.username}</p>
          {profile.biography ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{profile.biography}</p>
          ) : null}
          {profile.website ? (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-sm text-accent hover:underline"
            >
              {profile.website}
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <MetricGrid metrics={profile.metrics} />
      </div>

      {Object.keys(profile.metrics).length === 0 ? (
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
          <ShieldQuestion className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t.profile.metricsMissing}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {t.profile.lastSuccessfulUpdate}: {dateTime.format(new Date(profile.fetchedAt))}
        </span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate">{t.profile.dataSource}: {profile.source}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={profile.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 rounded-full text-xs font-medium text-accent hover:underline"
        >
          {t.profile.openOriginal.replace("{platform}", platformLabel)}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <CopyButton value={profile.canonicalUrl} label={t.search.copyLink} />
      </div>
    </div>
  );
}
