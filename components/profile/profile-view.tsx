"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ExternalLink, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile/profile-card";
import { MediaGrid } from "@/components/profile/media-grid";
import { useI18n } from "@/lib/i18n/context";
import { postJson } from "@/lib/client/api";
import type { PublicProfile } from "@/lib/providers/types";

export function ProfileView({
  profile,
  signedIn,
  trackedId,
  demoMode,
}: {
  profile: PublicProfile;
  signedIn: boolean;
  trackedId: string | null;
  demoMode: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);

  const platformLabel = profile.platform === "instagram" ? t.platform.instagram : t.platform.facebook;
  const mediaHref = `/profile/${profile.platform}/${encodeURIComponent(profile.identifier)}/media`;

  async function save() {
    setBusy("save");
    setMessage(null);
    const outcome = await postJson("/api/tracked", { platform: profile.platform, identifier: profile.identifier });
    setBusy(null);
    if (outcome.ok) {
      setMessage({ tone: "ok", text: t.profile.saved });
      router.refresh();
    } else {
      setMessage({ tone: "bad", text: t.apiErrors[outcome.error.code] ?? t.profile.saveError });
    }
  }

  async function sync() {
    if (!trackedId) return;
    setBusy("sync");
    setMessage(null);
    const outcome = await postJson(`/api/tracked/${trackedId}/sync`, {});
    setBusy(null);
    if (outcome.ok && (outcome.data as { ok?: boolean }).ok) {
      setMessage({ tone: "ok", text: t.profile.refreshed });
      router.refresh();
    } else if (outcome.ok) {
      setMessage({ tone: "warn", text: t.profile.refreshNotConfigured });
    } else {
      setMessage({ tone: "bad", text: t.apiErrors[outcome.error.code] ?? t.profile.saveError });
    }
  }

  return (
    <div className="shell py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/search" className="text-xs font-medium text-ink-3 hover:text-ink">
          ← {t.profile.back}
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{t.profile.eyebrow}</Badge>
          {profile.demo ? <Badge tone="demo">{t.demo.badge}</Badge> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <ProfileCard profile={profile} />

          <div className="flex flex-wrap items-center gap-2">
            {trackedId ? (
              <Button variant="secondary" onClick={sync} disabled={busy !== null}>
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {busy === "sync" ? t.profile.refreshing : t.profile.refresh}
              </Button>
            ) : signedIn ? (
              <Button onClick={save} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {t.profile.save}
              </Button>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/profile/${profile.platform}/${profile.identifier}`)}`} className={buttonClass({ variant: "primary" })}>
                {t.profile.signInToSave}
              </Link>
            )}
            <Link href={mediaHref} className={buttonClass({ variant: "secondary" })}>
              {t.profile.viewGallery}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={profile.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={buttonClass({ variant: "ghost" })}
            >
              {t.profile.openOriginal.replace("{platform}", platformLabel)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {message ? <Alert tone={message.tone} live>{message.text}</Alert> : null}

          {profile.demo && demoMode ? (
            <Alert tone="warn" title={t.profile.demoTitle}>{t.profile.demoBody}</Alert>
          ) : null}

          <section aria-labelledby="media-heading" className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="media-heading" className="text-sm font-semibold text-ink">{t.profile.mediaTitle}</h2>
              <Link href={mediaHref} className="text-xs font-medium text-accent hover:underline">{t.common.view} →</Link>
            </div>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-3">{t.profile.mediaNote}</p>
            <div className="mt-3">
              <MediaGrid items={profile.media.slice(0, 8)} />
            </div>
            {profile.mediaHasMore ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-paper-3/60 px-3 py-2 text-[0.6875rem] leading-relaxed text-ink-2">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t.profile.mediaLimited}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card-lg border border-line bg-paper-2 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldAlert className="h-4 w-4 text-ink-3" aria-hidden="true" />
              {t.profile.limitationsTitle}
            </h2>
            <ul className="mt-3 space-y-2.5">
              {profile.limitations.map((code) => (
                <li key={code} className="flex gap-2 text-xs leading-relaxed text-ink-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                  {t.limitations[code]}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-[0.625rem] leading-relaxed text-ink-3">
              {t.brand.name} · {t.profile.dataSource}: {profile.source}
            </p>
          </section>

          <section className="rounded-xl border border-dashed border-line-2 bg-paper-2/60 p-4 text-xs leading-relaxed text-ink-2">
            <p className="font-medium text-ink">{t.home.accessTitle}</p>
            <p className="mt-1.5">{t.limitations["stories-not-supported"]}</p>
            <p className="mt-1.5">{t.home.faq[1].a}</p>
            <Link href="/#access" className="mt-2 inline-block font-medium text-accent hover:underline">
              {t.common.learnMore}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
