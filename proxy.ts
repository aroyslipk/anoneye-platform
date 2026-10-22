import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Refreshes Supabase auth cookies on navigation requests. When Supabase is not
 * configured this is a pass-through, so local development has no dependency on
 * it. See docs/SECURITY.md.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, images and the service worker.
    "/((?!_next/static|_next/image|favicon.ico|icons/|demo/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};

export function proxyFallback() {
  return NextResponse.next();
}
