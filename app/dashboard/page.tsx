import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser, getRepository } from "@/lib/auth/session";
import { configStatus } from "@/lib/env";
import { MAX_TRACKED_PROFILES } from "@/lib/services/sync";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardUnavailable } from "@/components/dashboard/dashboard-unavailable";
import type { DashboardData } from "@/lib/db/types";

export const instant = false;

export const metadata: Metadata = {
  title: "ড্যাশবোর্ড",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  await connection();
  const user = await requireUser("/dashboard");
  const config = configStatus();

  let data: DashboardData | null = null;
  let detail: string | undefined;
  try {
    data = await getRepository().getDashboard(user.id);
  } catch (error) {
    detail = error instanceof Error ? error.name : "repository_error";
  }

  if (!data) return <DashboardUnavailable detail={detail} />;

  return (
    <DashboardView
      user={{ email: user.email, displayName: user.displayName }}
      data={data}
      config={{
        backend: config.backend,
        metaOAuth: config.metaOAuth,
        metaServerToken: config.metaServerToken,
        demoMode: config.demoMode,
        issues: config.issues,
      }}
      trackedLimit={MAX_TRACKED_PROFILES}
    />
  );
}
