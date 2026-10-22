import type { Metadata } from "next";
import { isDemoMode } from "@/lib/env";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "পাবলিক প্রোফাইল আবিষ্কার ও সোশ্যাল অ্যানালিটিক্স",
};

export default function HomePage() {
  return <LandingPage demoMode={isDemoMode()} />;
}
