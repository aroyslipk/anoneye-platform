import type { MetadataRoute } from "next";
import { publicConfig } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/privacy", "/terms", "/contact"],
        disallow: ["/dashboard", "/dashboard/", "/settings", "/api/", "/auth/", "/login", "/signup", "/offline"],
      },
    ],
    sitemap: `${publicConfig.siteUrl}/sitemap.xml`,
    host: publicConfig.siteUrl,
  };
}
