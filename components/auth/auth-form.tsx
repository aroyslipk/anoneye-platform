"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Wordmark } from "@/components/ui/logo";
import { useI18n } from "@/lib/i18n/context";
import { postJson } from "@/lib/client/api";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  nextPath,
  authConfigured,
  siteUrl,
}: {
  mode: Mode;
  nextPath: string;
  authConfigured: boolean;
  siteUrl: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  const isLogin = mode === "login";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const outcome = await postJson<{ requiresEmailConfirmation?: boolean }>(
      isLogin ? "/api/auth/login" : "/api/auth/signup",
      isLogin ? { email, password } : { email, password, displayName: displayName.trim() || undefined },
    );
    setPending(false);
    if (!outcome.ok) {
      switch (outcome.error.code) {
        case "unauthorized":
          setError(t.auth.invalidCredentials);
          break;
        case "conflict":
          setError(t.auth.emailTaken);
          break;
        case "not_configured":
          setError(t.auth.notConfiguredBody);
          break;
        case "rate_limited":
          setError(t.errors.rateLimited);
          break;
        case "invalid_input":
          setError(t.auth.weakPassword);
          break;
        case "network_error":
          setError(t.errors.network);
          break;
        default:
          setError(t.auth.genericError);
      }
      return;
    }
    if (!isLogin && outcome.data.requiresEmailConfirmation) {
      setConfirmation(true);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="shell flex min-h-[calc(100dvh-12rem)] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex justify-center"><Wordmark /></div>
        <div className="rounded-card-lg border border-line bg-paper-2 p-6 shadow-raised sm:p-7">
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">
            {isLogin ? t.auth.loginTitle : t.auth.signupTitle}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
            {isLogin ? t.auth.loginSubtitle : t.auth.signupSubtitle}
          </p>

          {!authConfigured ? (
            <div className="mt-4">
              <Alert tone="warn" title={t.auth.notConfiguredTitle}>{t.auth.notConfiguredBody}</Alert>
            </div>
          ) : null}

          {confirmation ? (
            <div className="mt-4">
              <Alert tone="ok" title={t.auth.confirmEmailTitle}>
                {t.auth.confirmEmailBody.replace("{site}", siteUrl)}
              </Alert>
              <Link href="/login" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                {t.auth.signIn}
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {!isLogin ? (
                <Field id="displayName" label={t.auth.displayName} hint={t.settings.displayNameHint}>
                  <Input
                    id="displayName"
                    name="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="nickname"
                    maxLength={80}
                  />
                </Field>
              ) : null}

              <Field id="email" label={t.auth.email} required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="ps-9"
                    placeholder="you@example.com"
                    maxLength={254}
                  />
                </div>
              </Field>

              <Field id="password" label={t.auth.password} hint={isLogin ? undefined : t.auth.passwordHint} required>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={isLogin ? 1 : 8}
                    maxLength={128}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="ps-9 pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t.auth.passwordHide : t.auth.passwordShow}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 hover:text-ink focus-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              {error ? <Alert tone="bad" live>{error}</Alert> : null}

              <Button type="submit" className="w-full" disabled={pending || !authConfigured}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {pending ? (isLogin ? t.auth.signingIn : t.auth.signingUp) : isLogin ? t.auth.signIn : t.auth.signUp}
                {!pending ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </Button>

              <p className="text-center text-xs text-ink-3">
                {isLogin ? t.auth.noAccount : t.auth.haveAccount}{" "}
                <Link
                  href={`${isLogin ? "/signup" : "/login"}?next=${encodeURIComponent(nextPath)}`}
                  className="font-medium text-accent hover:underline"
                >
                  {isLogin ? t.auth.signUp : t.auth.signIn}
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="mt-4 space-y-2 px-1 text-[0.6875rem] leading-relaxed text-ink-3">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t.auth.secureNote}
          </p>
          <p>{t.auth.termsNote}</p>
          <Link href="/" className="inline-block font-medium text-ink-2 hover:text-ink">← {t.auth.backHome}</Link>
        </div>
      </div>
    </div>
  );
}
