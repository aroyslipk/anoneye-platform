import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { dictionaries } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: dictionaries.bn.legal.termsTitle,
  description: dictionaries.bn.legal.termsIntro,
};

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
