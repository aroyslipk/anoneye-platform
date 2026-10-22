"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/context";
import { postJson } from "@/lib/client/api";

export function ContactForm({ contactEmail }: { contactEmail: string }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const outcome = await postJson("/api/contact", {
      name: form.name,
      email: form.email,
      subject: form.subject,
      message: form.message,
      website: form.website,
    });
    setPending(false);
    if (!outcome.ok) {
      setError(
        outcome.error.code === "rate_limited"
          ? t.errors.rateLimited
          : outcome.error.code === "network_error"
            ? t.errors.network
            : t.contact.errorBody,
      );
      return;
    }
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "", website: "" });
  }

  return (
    <div className="rounded-card-lg border border-line bg-paper-2 p-5 shadow-card sm:p-6">
      <h2 className="text-sm font-semibold text-ink">{t.contact.formTitle}</h2>

      {sent ? (
        <div className="mt-4 space-y-3">
          <Alert tone="ok" title={t.contact.successTitle}>
            {t.contact.successBody}
          </Alert>
          <Button variant="secondary" size="sm" onClick={() => setSent(false)}>
            {t.contact.formTitle}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="name" label={t.contact.name} required>
              <Input id="name" value={form.name} onChange={(event) => update("name", event.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
            </Field>
            <Field id="contact-email" label={t.contact.email} required>
              <Input id="contact-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required maxLength={254} autoComplete="email" />
            </Field>
          </div>
          <Field id="subject" label={t.contact.subject} required>
            <Input id="subject" value={form.subject} onChange={(event) => update("subject", event.target.value)} required minLength={3} maxLength={120} />
          </Field>
          <Field id="message" label={t.contact.message} hint={t.contact.privacyNote} required>
            <Textarea id="message" value={form.message} onChange={(event) => update("message", event.target.value)} required minLength={10} maxLength={4000} />
          </Field>

          {/* Honeypot: hidden from people, filled by naive bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
          </div>

          {error ? <Alert tone="bad" live>{error}</Alert> : null}

          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {pending ? t.contact.sending : t.contact.send}
          </Button>
        </form>
      )}

      <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[0.6875rem] leading-relaxed text-ink-3">
        {contactEmail ? (
          <p className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <a href={`mailto:${contactEmail}`} className="underline underline-offset-2">{contactEmail}</a>
          </p>
        ) : (
          <p>{t.contact.noEmailConfigured}</p>
        )}
        <p>{t.contact.responseNote}</p>
      </div>
    </div>
  );
}
