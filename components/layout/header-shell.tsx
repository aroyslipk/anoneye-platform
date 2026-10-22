"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";

export interface HeaderUser {
  email: string;
  displayName?: string;
}

export function HeaderShell({ user }: { user: HeaderUser | null }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/search", label: t.nav.search },
    ...(user ? [{ href: "/dashboard", label: t.nav.dashboard }] : []),
    { href: "/#how-data", label: t.nav.how },
  ];

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } finally {
      setSigningOut(false);
      setAccountOpen(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-3">
        <Link href="/" className="focus-ring rounded-lg" aria-label={t.brand.name}>
          <Wordmark compact />
        </Link>

        <nav aria-label={t.nav.mainNav} className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-2 text-sm transition-colors focus-ring",
                pathname === link.href ? "text-ink font-medium" : "text-ink-2 hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <LanguageSwitch className="hidden sm:inline-flex" />
          <ThemeToggle />
          {user ? (
            <div className="relative hidden md:block" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className={buttonClass({ variant: "secondary", size: "sm", className: "gap-1.5" })}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[0.625rem] font-bold uppercase text-accent">
                  {(user.displayName || user.email || "?").slice(0, 1)}
                </span>
                <span className="max-w-28 truncate">{user.displayName || user.email}</span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
              </button>
              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-paper-2 p-1.5 shadow-float"
                >
                  <p className="truncate px-3 py-2 text-xs text-ink-3">{user.email}</p>
                  {[
                    { href: "/dashboard", label: t.nav.dashboard, Icon: LayoutDashboard },
                    { href: "/dashboard/tracked", label: t.nav.tracked, Icon: Search },
                    { href: "/settings", label: t.nav.settings, Icon: Settings },
                  ].map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setAccountOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink focus-ring"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    disabled={signingOut}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-line px-3 py-2 text-start text-sm text-ink-2 hover:bg-paper-3 hover:text-ink focus-ring disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {signingOut ? t.common.loading : t.nav.logout}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 md:flex">
              <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {t.nav.login}
              </Link>
              <Link href="/signup" className={buttonClass({ variant: "primary", size: "sm" })}>
                {t.nav.signup}
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={buttonClass({ variant: "ghost", size: "icon", className: "md:hidden" })}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? t.nav.close : t.nav.menu}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-line bg-paper-2 md:hidden">
          <nav aria-label={t.nav.mainNav} className="shell flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-2 py-2.5 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink focus-ring"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-3">
              <LanguageSwitch />
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <Link href="/settings" className={buttonClass({ variant: "secondary", size: "sm" })}>
                      {t.nav.settings}
                    </Link>
                    <button type="button" onClick={signOut} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {t.nav.logout}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className={buttonClass({ variant: "ghost", size: "sm" })}>
                      {t.nav.login}
                    </Link>
                    <Link href="/signup" className={buttonClass({ variant: "primary", size: "sm" })}>
                      {t.nav.signup}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
