import type { Metadata } from "next";
import { connection } from "next/server";
import { authBackend, getRepository, requireUser } from "@/lib/auth/session";
import { configStatus } from "@/lib/env";
import { SettingsView } from "@/components/settings/settings-view";
import type { ConnectedAccount } from "@/lib/db/types";

export const instant = false;

export const metadata: Metadata = {
  title: "সেটিংস",
  robots: { index: false, follow: false },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireUser("/settings");
  const params = await searchParams;
  const oauthStatus = typeof params.oauth === "string" ? params.oauth : undefined;
  const oauthCount = typeof params.count === "string" ? params.count : undefined;
  let accounts: ConnectedAccount[] = [];
  let profile: Awaited<ReturnType<ReturnType<typeof getRepository>["getUserProfile"]>> = null;
  try {
    const repo = getRepository();
    [accounts, profile] = await Promise.all([repo.listConnectedAccounts(user.id), repo.getUserProfile(user.id)]);
  } catch {
    accounts = [];
    profile = null;
  }

  return (
    <SettingsView
      user={{ id: user.id, email: user.email, displayName: user.displayName }}
      profile={profile ? { displayName: profile.displayName, locale: profile.locale, theme: profile.theme } : null}
      accounts={accounts}
      config={configStatus()}
      backend={authBackend()}
      oauth={oauthStatus ? { status: oauthStatus, count: oauthCount } : undefined}
    />
  );
}
