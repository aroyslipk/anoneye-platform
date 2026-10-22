import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authBackend, getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/security/request";
import { publicConfig } from "@/lib/env";
import { AuthForm } from "@/components/auth/auth-form";

export const instant = false;

export const metadata: Metadata = {
  title: "সাইন ইন",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/dashboard");
  const user = await getSessionUser().catch(() => null);
  if (user) redirect(next);
  return (
    <AuthForm mode="login" nextPath={next} authConfigured={authBackend() !== "unconfigured"} siteUrl={publicConfig.siteUrl} />
  );
}
