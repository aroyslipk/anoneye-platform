"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  pending = false,
  danger = false,
  confirmDisabled = false,
  children,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  danger?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLButtonElement>('[data-confirm-cancel]');
      el?.focus();
    }, 30);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label={t.common.cancel} className="absolute inset-0 cursor-default" onClick={onCancel} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? "confirm-body" : undefined}
        className="relative w-full max-w-md rounded-card-lg border border-line bg-paper-2 p-5 shadow-float sm:p-6"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-ink">{title}</h2>
        {body ? <div id="confirm-body" className="mt-2 text-sm leading-relaxed text-ink-2">{body}</div> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button data-confirm-cancel variant="ghost" onClick={onCancel} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={pending || confirmDisabled}>
            {pending ? t.common.loading : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
