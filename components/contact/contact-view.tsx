"use client";

import { Mail } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { useI18n } from "@/lib/i18n/context";

export function ContactView({ contactEmail }: { contactEmail: string }) {
  const { t } = useI18n();
  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-accent">Anoneye</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-ink">{t.contact.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{t.contact.intro}</p>
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-dashed border-line-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-3">
            <Mail className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t.contact.privacyNote}
          </p>
        </div>
        <ContactForm contactEmail={contactEmail} />
      </div>
    </div>
  );
}
