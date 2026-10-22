"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Info, Loader2, Search, ShieldQuestion, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select } from "@/components/ui/field";
import { ProfileCard } from "@/components/profile/profile-card";
import { useI18n } from "@/lib/i18n/context";
import { detectPlatform } from "@/lib/providers/parse";
import { DEMO_IDS } from "@/lib/providers/demo";
import { PLATFORMS, type ParsedProfileInput, type Platform, type ProviderResult, type PublicProfile } from "@/lib/providers/types";
import { postJson } from "@/lib/client/api";

interface SearchViewProps {
  platform: Platform;
  query: string;
  parsed: ParsedProfileInput | null;
  invalidReason?: string;
  result: ProviderResult<PublicProfile> | null;
  demo: boolean;
  demoMode: boolean;
  signedIn: boolean;
  tracked: boolean;
}

export function SearchView(props: SearchViewProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(props.query);
  const [platform, setPlatform] = useState<Platform>(props.platform);
  const [detected, setDetected] = useState<Platform | null>(null);

  function onInput(next: string) {
    setValue(next);
    const guess = detectPlatform(next);
    setDetected(guess);
    if (guess && guess !== platform) setPlatform(guess);
  }

  const result = props.result;
  const parsed = props.parsed;
  const platformLabel = platform === "instagram" ? t.platform.instagram : t.platform.facebook;

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent">{t.nav.search}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">{t.search.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{t.search.subtitle}</p>

        <form action="/search" method="get" className="mt-7 rounded-card-lg border border-line bg-paper-2 p-4 shadow-card sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field id="q" label={t.search.label} hint={t.search.hint}>
              <Input
                id="q"
                name="q"
                value={value}
                onChange={(event) => onInput(event.target.value)}
                placeholder={t.search.placeholder}
                autoComplete="off"
                maxLength={200}
                required
              />
            </Field>
            <Field id="platform" label={t.platform.choose}>
              <Select
                id="platform"
                name="platform"
                value={platform}
                onChange={(event) => setPlatform(event.target.value as Platform)}
                className="sm:w-40"
              >
                {PLATFORMS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry === "instagram" ? t.platform.instagram : t.platform.facebook}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" className="sm:mb-0.5">
              <Search className="h-4 w-4" aria-hidden="true" />
              {t.search.submit}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {detected ? (
              <span className="inline-flex items-center gap-1.5 text-accent">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {t.search.detected}
              </span>
            ) : null}
            {props.demoMode ? (
              <Badge tone="demo">{t.common.demoMode}</Badge>
            ) : null}
            {props.demoMode ? <span>{t.home.demoHint.replace("{identifier}", DEMO_IDS[0])}</span> : null}
          </div>
        </form>

        {parsed ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-paper-2/60 px-3.5 py-2.5 text-xs text-ink-2">
            <span className="font-medium text-ink-3">{t.search.canonical}:</span>
            <code className="min-w-0 break-all font-mono text-[0.6875rem] text-ink-2">{parsed.canonicalUrl}</code>
            <CopyButton value={parsed.canonicalUrl} label={t.common.copy} />
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {props.invalidReason ? (
            <Alert tone="bad" title={t.errors.validation}>
              {(t.search.errors as Record<string, string | undefined>)[props.invalidReason] ?? t.search.errors["bad-url"]}
            </Alert>
          ) : null}

          {!props.query && !props.invalidReason ? (
            <div className="rounded-card-lg border border-line bg-paper-2 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Info className="h-4 w-4 text-accent" aria-hidden="true" />
                {t.capabilities.title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-2">
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />{t.capabilities.ids["parse-input"]}</li>
                <li className="flex gap-2"><ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />{t.limitations["stories-not-supported"]}</li>
                <li className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />{t.limitations["personal-accounts-not-supported"]}</li>
              </ul>
              <Link href="/#how-data" className={buttonClass({ variant: "ghost", size: "sm", className: "mt-3 -ms-2" })}>
                {t.common.learnMore}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}

          {result?.kind === "not-configured" ? (
            <Alert tone="warn" title={t.search.states.notConfiguredTitle}>
              <p>{t.search.states.notConfiguredBody}</p>
              <p className="mt-2 text-xs font-medium text-ink">{t.search.states.notConfiguredSteps}:</p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {result.missing.map((item) => (
                  <li key={item}><code className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[0.6875rem]">{item}</code></li>
                ))}
              </ul>
              <p className="mt-3 text-xs">{t.search.noConfiguredHint}</p>
            </Alert>
          ) : null}

          {result?.kind === "unauthorized" ? (
            <Alert tone="warn" title={t.search.states.unauthorizedTitle}>{t.search.states.unauthorizedBody}</Alert>
          ) : null}

          {result?.kind === "rate-limited" ? (
            <Alert tone="warn" title={t.search.states.rateLimitedTitle}>
              {t.search.states.rateLimitedBody}
              {result.retryAfterSeconds ? <span className="block text-xs text-ink-3">retry-after: {result.retryAfterSeconds}s</span> : null}
            </Alert>
          ) : null}

          {result?.kind === "not-found" ? (
            <Alert tone="neutral" title={t.search.states.notFoundTitle}>{t.search.states.notFoundBody}</Alert>
          ) : null}

          {result?.kind === "unsupported" ? (
            <Alert tone="neutral" title={t.search.states.unsupportedTitle}>{t.search.states.unsupportedBody}</Alert>
          ) : null}

          {result?.kind === "unavailable" ? (
            <Alert tone="bad" title={t.search.states.unavailableTitle}>{t.search.states.unavailableBody}</Alert>
          ) : null}

          {result?.kind === "invalid-input" ? (
            <Alert tone="bad" title={t.errors.validation}>
              {t.search.errors[result.reason] ?? t.search.errors["bad-url"]}
            </Alert>
          ) : null}

          {result?.kind === "ok" ? (
            <>
              {props.demo ? (
                <Alert tone="warn" title={t.search.demoBadge}>{t.search.demoNote}</Alert>
              ) : null}
              <ProfileCard profile={result.data} />
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/profile/${result.data.platform}/${encodeURIComponent(result.data.identifier)}`}
                  className={buttonClass({ variant: "primary" })}
                >
                  {t.search.viewProfile}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {props.signedIn ? (
                  props.tracked ? (
                    <Link href="/dashboard/tracked" className={buttonClass({ variant: "secondary" })}>
                      {t.profile.tracked}
                    </Link>
                  ) : (
                    <SaveButton platform={result.data.platform} identifier={result.data.identifier} />
                  )
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/profile/${result.data.platform}/${result.data.identifier}`)}`}
                    className={buttonClass({ variant: "secondary" })}
                  >
                    {t.search.signInToSave}
                  </Link>
                )}
                <span className="text-xs text-ink-3">{t.search.saveHint}</span>
              </div>
            </>
          ) : null}

          {result?.kind === "ok" && Object.keys(result.data.metrics).length === 0 ? (
            <p className="text-xs text-ink-3">{t.search.noMetrics}</p>
          ) : null}

          {parsed && result && result.kind !== "ok" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={parsed.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t.search.openOnPlatform.replace("{platform}", platformLabel)}
              </Link>
              <Link href="/search" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {t.search.newSearch}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-line-2 bg-paper-2/50 px-4 py-3 text-xs leading-relaxed text-ink-3">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t.home.accessNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function SaveButton({ platform, identifier }: { platform: Platform; identifier: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    const outcome = await postJson("/api/tracked", { platform, identifier });
    if (outcome.ok) {
      setState("saved");
      return;
    }
    setState("idle");
    setError(outcome.error.retryAfterSeconds ? `${outcome.error.code} (${outcome.error.retryAfterSeconds}s)` : outcome.error.code);
  }

  if (state === "saved") {
    return (
      <Link href="/dashboard/tracked" className={buttonClass({ variant: "secondary" })}>
        <Check className="h-4 w-4 text-ok" aria-hidden="true" />
        {t.profile.tracked}
      </Link>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="secondary" onClick={save} disabled={state === "saving"}>
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {state === "saving" ? t.common.saving : t.search.save}
      </Button>
      {error ? <span className="text-xs text-bad">{t.apiErrors[error.split(" ")[0]] ?? t.common.error}</span> : null}
    </span>
  );
}
