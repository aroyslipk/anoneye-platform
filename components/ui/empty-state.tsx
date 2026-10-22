import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-2 bg-paper-2/60 px-6 py-12 text-center", className)}>
      {icon ? <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent [&>svg]:h-6 [&>svg]:w-6">{icon}</span> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">{body}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
