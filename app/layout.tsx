import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { publicConfig } from "@/lib/env";
import { SiteHeader, HeaderFallback } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { PwaRegister } from "@/components/pwa/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.siteUrl),
  title: {
    default: "Anoneye — পাবলিক প্রোফাইল আবিষ্কার ও সোশ্যাল অ্যানালিটিক্স",
    template: "%s · Anoneye",
  },
  description:
    "Anoneye অফিসিয়াল Meta API দিয়ে পাবলিক Instagram ও Facebook প্রোফাইল দেখে, সময়-চিহ্নিত পর্যবেক্ষণ রাখে এবং সৎ রিপোর্ট তৈরি করে। কোনো স্ক্র্যাপিং বা বানানো ডেটা নেই।",
  applicationName: "Anoneye",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  appleWebApp: { capable: true, title: "Anoneye", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "Anoneye",
    title: "Anoneye — পাবলিক প্রোফাইল আবিষ্কার ও অ্যানালিটিক্স",
    description: "অফিসিয়াল API, সময়-চিহ্নিত পর্যবেক্ষণ, সৎ রিপোর্ট।",
    locale: "bn_BD",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#121218" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <I18nProvider>
          <SkipLink />
          <Suspense fallback={<HeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <PwaRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
