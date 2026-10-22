import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { HeaderShell } from "@/components/layout/header-shell";

/** Async server component: put behind <Suspense> to keep the shell static. */
export async function SiteHeader() {
  // Session reads are request-time data; keep them out of prerender attempts.
  await connection();
  const user = await getSessionUser().catch(() => null);
  return (
    <HeaderShell
      user={user ? { email: user.email, displayName: user.displayName } : null}
    />
  );
}

export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-3">
        <span className="h-7 w-36 rounded-lg bg-paper-3" aria-hidden="true" />
        <span className="h-8 w-8 rounded-full bg-paper-3" aria-hidden="true" />
      </div>
    </header>
  );
}
