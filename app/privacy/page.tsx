import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { dictionaries } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: dictionaries.bn.legal.privacyTitle,
  description: dictionaries.bn.legal.privacyIntro,
};

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
