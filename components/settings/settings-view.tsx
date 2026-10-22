"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  KeyRound,
  Languages,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Unplug,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";
import { deleteJson, patchJson, postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import type { ConnectedAccount } from "@/lib/db/types";
import type { ConfigStatus } from "@/lib/env";

export interface SettingsUser {
  id: string;
  email: string;
  displayName?: string;
}

function StatusBadge({ value }: { value: "configured" | "missing" | "invalid" }) {
  const { t } = useI18n();
  const tone = value === "configured" ? "ok" : value === "invalid" ? "bad" : "warn";
  return (
    <Badge tone={tone} dot>
      {value === "configured" ? t.settings.enabled : value === "invalid" ? t.settings.invalid : t.settings.missing}
    </Badge>
  );
}

export function SettingsView({
  user,
  profile,
  accounts,
  config,
  backend,
  oauth,
}: {
  user: SettingsUser;
  profile: { displayName?: string; locale: "bn" | "en"; theme: "light" | "dark" | "system" } | null;
  accounts: ConnectedAccount[];
  config: ConfigStatus;
  backend: "supabase" | "local" | "unconfigured";
  oauth?: { status: string; count?: string };
}) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? user.displayName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [danger, setDanger] = useState<"data" | "account" | null>(null);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [dangerNotice, setDangerNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const oauthReady = config.metaOAuth === "configured";

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    const outcome = await patchJson("/api/settings/profile", { displayName: displayName.trim() || null });
    setSavingProfile(false);
    if (!outcome.ok) {
      setProfileNotice({ tone: "bad", text: t.apiErrors[outcome.error.code] ?? t.settings.profileError });
      return;
    }
    setProfileNotice({ tone: "ok", text: t.settings.saved });
    router.refresh();
  }

  function persistPreference(next: { locale?: "bn" | "en"; theme?: "light" | "dark" | "system" }) {
    void patchJson("/api/settings/profile", next).catch(() => undefined);
  }

  function changeLocale(next: "bn" | "en") {
    setLocale(next);
    persistPreference({ locale: next });
  }

  function changeTheme(next: "light" | "dark") {
    setTheme(next);
    persistPreference({ theme: next });
  }

  async function disconnect() {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    const outcome = await postJson("/api/oauth/meta/disconnect", { id: disconnectTarget.id });
    setDisconnecting(false);
    setDisconnectTarget(null);
    if (!outcome.ok) {
      setDangerNotice({ tone: "bad", text: t.apiErrors[outcome.error.code] ?? t.settings.oauthError });
      return;
    }
    router.refresh();
  }

  async function signOut() {
    await postJson("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  }

  async function deleteData() {
    if (!danger) return;
    setDeleting(true);
    const outcome = await deleteJson("/api/account", { confirm: "DELETE", mode: danger });
    setDeleting(false);
    if (!outcome.ok) {
      setDangerNotice({ tone: "bad", text: t.apiErrors[outcome.error.code] ?? t.settings.deletionError });
      setDanger(null);
      return;
    }
    setDanger(null);
    setConfirmWord("");
    if (danger === "account") {
      router.push("/");
      router.refresh();
      return;
    }
    setDangerNotice({ tone: "ok", text: t.settings.dataDeleted });
    router.refresh();
  }

  return (
    <div className="shell py-8 sm:py-10">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.settings.subtitle}</p>
      </div>

      {oauth ? (
        <div className="mt-4 max-w-3xl">
          {oauth.status === "connected" ? (
            <Alert tone="ok" title={t.settings.connections}>
              {t.settings.oauthConnected.replace("{count}", oauth.count ?? "1")}
            </Alert>
          ) : (
            <Alert tone="bad" title={t.settings.oauthError}>
              {(t.settings.oauthReasons as Record<string, string | undefined>)[oauth.status] ?? t.settings.oauthReasons.unexpected}
            </Alert>
          )}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Account */}
        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">{t.settings.account}</h2>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-3">{t.settings.accountEmail}</dt>
              <dd className="truncate font-medium text-ink">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-3">{t.settings.accountId}</dt>
              <dd className="truncate font-mono text-[0.625rem] text-ink-3">{user.id}</dd>
            </div>
          </dl>
          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <Field id="displayName" label={t.settings.displayName} hint={t.settings.displayNameHint}>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                autoComplete="nickname"
              />
            </Field>
            {profileNotice ? <Alert tone={profileNotice.tone} live>{profileNotice.text}</Alert> : null}
            <Button type="submit" size="sm" disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {savingProfile ? t.common.saving : t.settings.saveProfile}
            </Button>
          </form>
        </section>

        {/* Appearance */}
        <section className="rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">{t.settings.appearance}</h2>

          <div className="mt-4">
            <p className="text-xs font-medium text-ink-2">{t.settings.theme}</p>
            <div className="mt-1.5 inline-flex rounded-full border border-line bg-paper p-0.5" role="group" aria-label={t.settings.theme}>
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeTheme(option)}
                  aria-pressed={theme === option}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium focus-ring",
                    theme === option ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {option === "light" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {option === "light" ? t.settings.themeLight : t.settings.themeDark}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              {t.settings.language}
            </p>
            <div className="mt-1.5 inline-flex rounded-full border border-line bg-paper p-0.5" role="group" aria-label={t.settings.language}>
              {(["bn", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeLocale(option)}
                  aria-pressed={locale === option}
                  lang={option}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium focus-ring",
                    locale === option ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {option === "bn" ? t.settings.languageBn : t.settings.languageEn}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-3">{t.settings.preferenceNote}</p>
          <button type="button" onClick={signOut} className={buttonClass({ variant: "ghost", size: "sm", className: "mt-2 -ms-2" })}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            {t.settings.signOut}
          </button>
        </section>
      </div>

      {/* Connections */}
      <section className="mt-4 rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t.settings.connections}</h2>
          <Badge tone={oauthReady ? "ok" : "warn"}>{oauthReady ? t.common.configured : t.common.notConfigured}</Badge>
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-3">{t.settings.connectHint}</p>

        {!oauthReady ? (
          <div className="mt-3">
            <Alert tone="warn" title={t.settings.connectNotConfigured}>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">
                <li><code className="font-mono">META_APP_ID</code></li>
                <li><code className="font-mono">META_APP_SECRET</code></li>
                <li><code className="font-mono">META_REDIRECT_URI</code></li>
                <li><code className="font-mono">TOKEN_ENCRYPTION_KEY</code></li>
              </ul>
            </Alert>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/api/oauth/meta/start?platform=instagram" className={buttonClass({ variant: "secondary", size: "sm" })}>
              {t.settings.connectInstagram}
            </Link>
            <Link href="/api/oauth/meta/start?platform=facebook" className={buttonClass({ variant: "ghost", size: "sm" })}>
              {t.settings.connectFacebook}
            </Link>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="mt-4 text-xs text-ink-3">{t.settings.noConnections}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{account.displayName ?? account.providerAccountId}</p>
                  <p className="text-[0.625rem] text-ink-3">
                    {account.platform === "instagram" ? t.platform.instagram : t.platform.facebook} · {account.providerAccountId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={account.status === "connected" ? "ok" : account.status === "expired" ? "warn" : "bad"}>
                    {account.status === "connected" ? t.settings.connectedStatus : account.status === "expired" ? t.settings.expiredStatus : t.settings.revokedStatus}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setDisconnectTarget(account)}>
                    <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.settings.disconnect}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Configuration */}
      <section className="mt-4 rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <KeyRound className="h-4 w-4 text-ink-3" aria-hidden="true" />
            {t.settings.config}
          </h2>
          <span className="text-[0.625rem] text-ink-3">{t.settings.configNote}</span>
        </div>

        <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.backend}</dt>
            <dd>
              <Badge tone={backend === "supabase" ? "ok" : backend === "local" ? "warn" : "bad"}>
                {backend === "supabase" ? t.dashboard.backendSupabase : backend === "local" ? t.dashboard.backendLocal : t.dashboard.backendUnconfigured}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.supabase}</dt>
            <dd><StatusBadge value={config.supabase} /></dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.metaOAuth}</dt>
            <dd><StatusBadge value={config.metaOAuth} /></dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.metaServerToken}</dt>
            <dd><StatusBadge value={config.metaServerToken} /></dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.demoMode}</dt>
            <dd><Badge tone={config.demoMode ? "warn" : "neutral"}>{config.demoMode ? t.settings.enabled : t.settings.disabled}</Badge></dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5">
            <dt className="text-ink-3">{t.settings.mediaDownload}</dt>
            <dd><Badge tone={config.mediaDownload ? "warn" : "neutral"}>{config.mediaDownload ? t.settings.enabled : t.settings.disabled}</Badge></dd>
          </div>
        </dl>

        {config.mediaDownload ? (
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-3">{t.limitations["media-url-may-be-omitted"]}</p>
        ) : null}

        {config.issues.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {config.issues.map((issue) => (
              <p key={issue.key} className="flex items-start gap-2 rounded-lg bg-warn-soft/60 px-3 py-2 text-xs text-ink-2">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                <span><code className="font-mono">{issue.key}</code>: {issue.message}</span>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[0.6875rem] text-ink-3">{t.settings.noIssues}</p>
        )}

        {backend === "local" ? (
          <p className="mt-2 rounded-lg bg-warn-soft/50 px-3 py-2 text-[0.6875rem] leading-relaxed text-ink-2">{t.settings.localBackendWarning}</p>
        ) : null}
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-3">{t.settings.tokenNotice}</p>
        <Link href="/#access" className={buttonClass({ variant: "ghost", size: "sm", className: "mt-2 -ms-2" })}>
          {t.settings.setupGuide}
        </Link>
      </section>

      {/* Privacy */}
      <section className="mt-4 rounded-card-lg border border-line bg-paper-2 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">{t.settings.privacy}</h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-2">{t.settings.privacyBody}</p>

        {dangerNotice ? (
          <div className="mt-3"><Alert tone={dangerNotice.tone} live>{dangerNotice.text}</Alert></div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/account/export" download className={buttonClass({ variant: "secondary", size: "sm" })}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t.settings.exportData}
          </a>
          <Button variant="ghost" size="sm" onClick={() => setDanger("data")}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t.settings.deleteData}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDanger("account")}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t.settings.deleteAccount}
          </Button>
        </div>
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-3">{t.settings.exportHint}</p>
      </section>

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        title={t.settings.disconnectConfirmTitle}
        body={t.settings.disconnectConfirmBody}
        confirmLabel={t.settings.disconnect}
        onCancel={() => setDisconnectTarget(null)}
        onConfirm={disconnect}
        pending={disconnecting}
        danger
      />

      <ConfirmDialog
        open={danger !== null}
        title={danger === "account" ? t.settings.deleteAccountConfirmTitle : t.settings.deleteDataConfirmTitle}
        body={danger === "account" ? t.settings.deleteAccountConfirmBody : t.settings.deleteDataConfirmBody}
        confirmLabel={danger === "account" ? t.settings.deleteAccountConfirmCta : t.settings.deleteDataConfirmCta}
        onCancel={() => {
          setDanger(null);
          setConfirmWord("");
        }}
        onConfirm={deleteData}
        pending={deleting}
        danger
        confirmDisabled={confirmWord !== "DELETE"}
      >
        <div className="space-y-2">
          <p className="text-xs text-ink-2">{t.settings.deleteConfirmPhrase}</p>
          <Input
            value={confirmWord}
            onChange={(event) => setConfirmWord(event.target.value)}
            placeholder="DELETE"
            aria-label={t.settings.deleteConfirmPhrase}
            autoComplete="off"
          />
          {confirmWord !== "DELETE" ? <p className="text-[0.6875rem] text-ink-3">{t.settings.deleteConfirmMismatch}</p> : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
