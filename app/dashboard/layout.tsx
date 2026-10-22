import type { ReactNode } from "react";
import { connection } from "next/server";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Personal pages must never be served from a build-time cache, regardless of
  // how the route segments are configured.
  await connection();
  return (
    <div>
      <DashboardNav />
      {children}
    </div>
  );
}
