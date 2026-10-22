import type { Metadata } from "next";
import { publicConfig } from "@/lib/env";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { ContactView } from "@/components/contact/contact-view";

export const metadata: Metadata = {
  title: dictionaries.bn.contact.title,
  description: dictionaries.bn.contact.intro,
};

export default function ContactPage() {
  return <ContactView contactEmail={publicConfig.contactEmail} />;
}
