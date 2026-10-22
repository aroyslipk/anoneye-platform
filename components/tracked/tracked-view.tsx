"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { useDateFormat, useI18n, useNumberFormat } from "@/lib/i18n/context";
import { deleteJson, patchJson, postJson } from "@/lib/client/api";
import type { TrackedProfile } from "@/lib/db/types";
import { cn } from "@/lib/utils/cn";

type Filter = "all" | "active" | "paused";

export function TrackedView({
  profiles,
  demoMode,
  limit,
}: {
  profiles: TrackedProfile[];
  demoMode: boolean;
  limit: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const number = useNumberFormat();
  const dateTime = useDateFormat();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrackedProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (filter !== "all" && profile.monitoringStatus !== filter) return false;
      if (!needle) return true;
      return profile.identifier.includes(needle) || (profile.label ?? "").toLowerCase().includes(needle);
    });
  }, [profiles, filter, query]);

  function handleFailure(code: string) {
    setNotice({ tone: "bad", text: t.apiErrors[code] ?? t.tracked.error });
  }

  async function sync(profile: TrackedProfile) {
    setPendingId(profile.id);
    setNotice(null);
    const outcome = await postJson<{ ok?: boolean }>(`/api/tracked/${profile.id}/sync`, {});
    setPendingId(null);
    if (!outcome.ok) return handleFailure(outcome.error.code);
    if (outcome.data.ok) {
      setNotice({ tone: "ok", text: `${t.tracked.refreshed} · @${profile.identifier}` });
      router.refresh();
    } else {
      setNotice({ tone: "warn", text: t.profile.refreshNotConfigured });
    }
  }

  async function togglePause(profile: TrackedProfile) {
    const next = profile.monitoringStatus === "active" ? "paused" : "active";
    setPendingId(profile.id);
    setNotice(null);
    const outcome = await patchJson(`/api/tracked/${profile.id}`, { monitoringStatus: next });
    setPendingId(null);
    if (!outcome.ok) return handleFailure(outcome.error.code);
    setNotice({ tone: "ok", text: next === "paused" ? t.tracked.paused : t.tracked.resumed });
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const outcome = await deleteJson(`/api/tracked/${deleteTarget.id}?confirm=1`);
    setDeleting(false);
    if (!outcome.ok) {
      setDeleteTarget(null);
      return handleFailure(outcome.error.code);
    }
    setDeleteTarget(null);
    setNotice({ tone: "ok", text: t.tracked.removed });
    router.refresh();
  }

  async function seedDemo(profile: TrackedProfile) {
    setPendingId(profile.id);
    setNotice(null);
    const outcome = await postJson<{ inserted?: number }>(`/api/tracked/${profile.id}/demo-history`, {});
    setPendingId(null);
    if (!outcome.ok) return handleFailure(outcome.error.code);
    setNotice({ tone: "warn", text: t.tracked.demoHistoryDone });
    router.refresh();
  }

  return (
    <div className="shell py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">{t.tracked.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-2">{t.tracked.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{t.tracked.limit.replace("{count}", String(profiles.length)).replace("{limit}", String(limit))}</Badge>
          <Link href="/search" className={buttonClass({ size: "sm" })}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {t.tracked.emptyCta}
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="mt-4">
          <Alert tone={notice.tone} live>{notice.text}</Alert>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.tracked.searchPlaceholder}
            aria-label={t.tracked.searchPlaceholder}
            className="ps-9"
          />
        </div>
        <div className="inline-flex rounded-full border border-line bg-paper-2 p-0.5" role="group" aria-label={t.tracked.filterAll}>
          {(["all", "active", "paused"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-ring",
                filter === key ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink",
              )}
            >
              {key === "all" ? t.tracked.filterAll : key === "active" ? t.tracked.filterActive : t.tracked.filterPaused}
            </button>
          ))}
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Search aria-hidden="true" />}
            title={t.tracked.emptyTitle}
            body={t.tracked.emptyBody}
            action={<Link href="/search" className={buttonClass({ size: "sm" })}>{t.tracked.emptyCta}</Link>}
          />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line-2 px-4 py-8 text-center text-sm text-ink-3">{t.tracked.noResults}</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {visible.map((profile) => {
            const busy = pendingId === profile.id;
            const paused = profile.monitoringStatus === "paused";
            return (
              <li key={profile.id} className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/profile/${profile.platform}/${encodeURIComponent(profile.identifier)}`}
                        className="truncate text-sm font-semibold text-ink hover:text-accent"
                      >
                        @{profile.identifier}
                      </Link>
                      <Badge tone={paused ? "warn" : "ok"} dot>{paused ? t.tracked.filterPaused : t.tracked.filterActive}</Badge>
                      <Badge tone="neutral">{profile.platform === "instagram" ? t.platform.instagram : t.platform.facebook}</Badge>
                      {profile.lastSyncStatus && profile.lastSyncStatus !== "succeeded" ? (
                        <Badge tone={profile.lastSyncStatus === "retry_scheduled" ? "warn" : "bad"}>
                          {t.dashboard.syncStatus[profile.lastSyncStatus]}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-3">
                      {t.tracked.colLastSync}: {profile.lastSyncedAt ? dateTime.format(new Date(profile.lastSyncedAt)) : t.tracked.lastSyncedNever}
                      {" · "}
                      {t.tracked.colFollowers}:{" "}
                      {typeof profile.latest?.followers === "number" ? number.format(profile.latest.followers) : "—"}
                      {profile.lastErrorCode ? ` · ${t.tracked.lastError}: ${profile.lastErrorCode}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => sync(profile)} disabled={busy}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                      {t.tracked.refresh}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => togglePause(profile)} disabled={busy} aria-label={paused ? t.tracked.resume : t.tracked.pause} title={paused ? t.tracked.resume : t.tracked.pause}>
                      {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                    <Link
                      href={`/profile/${profile.platform}/${encodeURIComponent(profile.identifier)}`}
                      className={buttonClass({ variant: "ghost", size: "icon" })}
                      aria-label={t.tracked.open}
                      title={t.tracked.open}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    {demoMode && profile.identifier.endsWith(".demo") ? (
                      <Button size="sm" variant="soft" onClick={() => seedDemo(profile)} disabled={busy} title={t.tracked.demoHistoryHint}>
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.tracked.demoHistory}
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(profile)}
                      disabled={busy}
                      aria-label={t.tracked.remove}
                      title={t.tracked.remove}
                      className="text-bad hover:bg-bad-soft"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-[0.6875rem] leading-relaxed text-ink-3">{t.tracked.noProvider}</p>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t.tracked.removeConfirmTitle}
        body={t.tracked.removeConfirmBody}
        confirmLabel={t.tracked.removeConfirmCta}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={deleting}
        danger
      >
        {deleteTarget ? <code className="rounded bg-paper-3 px-2 py-1 font-mono text-xs">@{deleteTarget.identifier}</code> : null}
      </ConfirmDialog>
    </div>
  );
}
