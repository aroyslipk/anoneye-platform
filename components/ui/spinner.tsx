import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />
      {label ? <span className="text-sm text-ink-2">{label}</span> : <span className="sr-only">{label ?? "Loading"}</span>}
    </span>
  );
}
