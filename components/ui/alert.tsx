import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AlertTone = "info" | "ok" | "warn" | "bad" | "neutral";

const TONE: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-accent/25 bg-accent-soft/60 text-ink", icon: <Info className="text-accent" /> },
  ok: { box: "border-ok/25 bg-ok-soft/70 text-ink", icon: <CheckCircle2 className="text-ok" /> },
  warn: { box: "border-warn/30 bg-warn-soft/75 text-ink", icon: <TriangleAlert className="text-warn" /> },
  bad: { box: "border-bad/25 bg-bad-soft/70 text-ink", icon: <CircleAlert className="text-bad" /> },
  neutral: { box: "border-line bg-paper-2 text-ink", icon: <ShieldAlert className="text-ink-3" /> },
};

export function Alert({
  tone = "info",
  title,
  children,
  actions,
  className,
  live = false,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  live?: boolean;
}) {
  const config = TONE[tone];
  return (
    <div
      className={cn("flex gap-3 rounded-2xl border p-4 text-sm", config.box, className)}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <span className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">
        {config.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children ? <div className="leading-relaxed text-ink-2 [&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
        {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
      </div>
    </div>
  );
}
