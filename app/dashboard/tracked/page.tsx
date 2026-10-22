import type { Metadata } from "next";
import { connection } from "next/server";
import { requireUser, getRepository } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { MAX_TRACKED_PROFILES } from "@/lib/services/sync";
import { TrackedView } from "@/components/tracked/tracked-view";
import type { TrackedProfile } from "@/lib/db/types";

export const instant = false;

export const metadata: Metadata = {
  title: "ট্র্যাক করা প্রোফাইল",
  robots: { index: false, follow: false },
};

export default async function TrackedPage() {
  await connection();
  const user = await requireUser("/dashboard/tracked");
  let profiles: TrackedProfile[] = [];
  try {
    profiles = await getRepository().listTracked(user.id, { limit: 100 });
  } catch {
    profiles = [];
  }
  return <TrackedView profiles={profiles} demoMode={isDemoMode()} limit={MAX_TRACKED_PROFILES} />;
}
